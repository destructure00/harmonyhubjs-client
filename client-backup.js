var harmony = require('./index.js')
var request = require('request')
var hubName = process.argv[2]
var harmonyIP
const makerLink = 'http://192.168.0.000/apps/api/[deviceID]/devices?access_token=[TOKEN]'
var hubXref = //create an array variable to associate command line arguments to IP addresses
				[
					//['HUB_NICKNAME','IP_ADDRESS']
					['MBR','192.168.0.001'],
					['LR','192.168.0.002']
				]
var activityXref = //create an array variable to associate activity names from Harmony to switch names from Hubitat
					[
						//['HUB_NICKNAME','ACTIVITY_NAME','SWITCH_NAME']
						['LR','Fire TV','Living Room Fire TV'],
						['LR','Broadcast TV','Living Room Broadcast TV'],
						['LR','Cast','Living Room Cast'],
						['LR','TV with Cast','Living Room TV with Cast'],
						['LR','Blu Ray','Living Room Blu Ray'],
						['LR','Bluetooth Audio','Living Room Bluetooth'],
						['MBR','Fire TV','Master Bedroom Fire TV'],
						['MBR','Broadcast TV','Master Bedroom Broadcast TV'],
						['MBR','Cast','Master Bedroom Cast'],
						['MBR','Blu Ray','Master Bedroom Blu Ray']
					]
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------

cleanXref()

function cleanXref() {
	var i
	var list = []
	for (i = 0; i < activityXref.length; i++) {
		if(activityXref[i][0] != hubName) {
			list.push(i)
		}
	}
	for (i = list.length - 1; i >= 0; i--) {
		activityXref.splice(list[i],1)
	}
	getIP()
}
					
function getIP () {
	for(i = 0; i < hubXref.length; i++) {
		if (hubXref[i][0] == hubName) {
			harmonyIP = hubXref[i][1]
			console.log('Found IP adress ' + harmonyIP + ' for hub ' + hubName)
		} 
	}
	if(harmonyIP == null)  {
		console.log('Could not find a match for hub ' + hubName + ', please try again')
	} else {
		getSwitchIds()
	}
}

function getSwitchIds () {
	var options = {
		uri: makerLink,
		method: 'GET',
		json: true
	}
	request(options, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			var i
			var j 
			for(i = 0; i < body.length; i++) {
				for (j = 0; j < activityXref.length; j++) {
					if(activityXref[j][2] == body[i].label) {
						activityXref[j][2] = body[i].id
					} 
				}
			}		
			startClient()
		} else {
			console.log('No response received from Hubitat - check that Maker API is enabled and URL is correct')
		}
 })
}
 
function startClient () {
	harmony(harmonyIP).then(function(harmonyClient){
		harmonyClient.getActivities().then(function(activities) {
			var i
			var j
			for(i = 0; i < activities.length; i++) {
				for (j = 0; j < activityXref.length; j++) {
					if(activities[i].label == activityXref[j][1]) {
						activityXref[j][1] = activities[i].id
					}
				}
			}
			console.log('----------------------------------------------------------')
			console.log('Using cross-reference list:')
			console.log(activityXref)
			console.log('----------------------------------------------------------')
			console.log('Listening for state digest...')
		})
		
		console.log('Starting Client...')		
		
		! function keepAlive(){
			harmonyClient.request('getCurrentActivity').timeout(5000).then(function(response) {
				setTimeout(keepAlive, 45000);
			}).catch(function(e){
				console.log('')
				console.log('Lost connection to hub  (' + new Date() + ')')
				harmonyClient.end()
				restartClient ()
			})
		}()
		
		
		harmonyClient.on('stateDigest', function(digest) {
			var statusCode = digest.activityStatus
			var currentlyOn = digest.runningActivityList
			var targetActivity = digest.activityId
			
			switch(String(statusCode)) {
				case '0': //Hub is off
					if(currentlyOn == '' && targetActivity == '-1') {
						console.log('- Hub is off')
					} else {
						console.log('- Activity ' + currentlyOn + ' is off')
						changeSwitch(currentlyOn, 'off')
					}
					break;
				case '1': //Activity is starting
					console.log('')
					console.log('Received state digest (' + new Date() + ')')
					console.log('- Activity is starting...')
					break;
				case '2': //Activity is started
					if(currentlyOn == targetActivity) {
						console.log('- Activity is started')
					} else {
						if(currentlyOn == '') {
							console.log('- Activity ' + targetActivity + ' is on')
							changeSwitch(targetActivity, 'on')
						}
						else {
							console.log('- Activity ' + targetActivity + ' is on')
							console.log('- Activity ' + currentlyOn + ' is off')	
							changeSwitch(targetActivity,'on')
						}
					}
					break;
				case '3': //Hub is turning off
					console.log('')
					console.log('Received state digest (' + new Date() + ')')
					console.log('- Hub is turning off...')
					break;
			}
		})
	}).catch(function(e){
		console.log('error')
	})
}

function changeSwitch (activityId, changeTo) {
	var activityCount = activityXref.length
	var i
	var switchId = ""
	var tokenLabelPos = makerLink.indexOf('access_token')
	var makerURL = makerLink.substring(0,tokenLabelPos - 1)
	var makerToken = makerLink.replace(makerURL,'')
	
	for(i = 0; i < activityCount; i++) {
		if (activityXref[i][1] == activityId) {
			switchId = activityXref[i][2]			
			console.log('- Cross-referencing activity ' + activityId + ' to switch ' + switchId)
		}
	}
	
	var options = {
		uri: makerURL + "/" + switchId + "/" + changeTo + makerToken,
		method: 'GET',
		json: true
		}
		
	request(options, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log("- Sending " + changeTo + " command to switch " + switchId)
		} 
	})
}

function restartClient () {
  var restartDelay = 10000
	console.log('Restarting in ' + restartDelay/1000 + ' seconds...')
	setTimeout(startClient,restartDelay)	
}

