var harmony = require('./index.js')
var request = require('request')
var hubName = process.argv[2]
var harmonyIP
var deviceID
const refreshDelay = 2000
const restartDelay = 5000
const makerLink = 'http://192.168.0.000/apps/api/[DEVICE ID]/devices?access_token=[TOKEN]'
var hubXref = //create an array variable to associate command line arguments to IP addresses
				[
					//['HUB_NICKNAME','IP_ADDRESS','HUBITAT_DEVICE_ID']
					['MBR','192.168.0.001','998'],
					['LR','192.168.0.002','999']
				]

//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------------------------

console.log('Starting Client...')
getIP()

					
function getIP () {
	for(i = 0; i < hubXref.length; i++) {
		if (hubXref[i][0] == hubName) {
			harmonyIP = hubXref[i][1]
			deviceID = hubXref[i][2]
			console.log('Found IP address ' + harmonyIP + ' and device ID ' + deviceID + ' for hub ' + hubName)
		} 
	}
	if(harmonyIP == null)  {
		console.log('Could not find a match for hub ' + hubName + ', please try again')
	} else {
		startClient()
	}
}

 
function startClient () {
	harmony(harmonyIP).then(function(harmonyClient){		
				
		console.log('Listening for state digest...')
		
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
						setTimeout(waitForIt, refreshDelay)
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
							setTimeout(waitForIt, refreshDelay)
						}
						else {
							console.log('- Activity ' + targetActivity + ' is on')
							console.log('- Activity ' + currentlyOn + ' is off')	
							setTimeout(waitForIt, refreshDelay)
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

function waitForIt () {
	console.log('- Refreshing hub in ' + refreshDelay/1000 + ' seconds...')
	refreshHub ()	
}

function refreshHub() {
	var tokenLabelPos = makerLink.indexOf('access_token')
	var makerURL = makerLink.substring(0,tokenLabelPos - 1)
	var makerToken = makerLink.replace(makerURL,'')	
	
	var options = {
		uri: makerURL + "/" + deviceID + "/refresh" + makerToken,
		method: 'GET',
		json: true
		}
		
	request(options, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log('- Refreshing hub')
		} 
	})
}

function restartClient () {
	console.log('Restarting in ' + restartDelay/1000 + ' seconds...')
	setTimeout(startClient,restartDelay)	
}
