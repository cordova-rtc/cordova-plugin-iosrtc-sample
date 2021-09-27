const EASYRTC_SERVER = 'https://example.com';
const EASYRTC_APP_NAME = 'default';
const EASYRTC_ROOM_NAME = 'test';

function TestRTCPeerConnection() {
	return loadScript('https://unpkg.com/socket.io-client@2.2.0/dist/socket.io.js').then(function () {
		return loadScript('https://unpkg.com/open-easyrtc@2.0.5/api/easyrtc.js').then(function () {
			return joinRoom({
				server: EASYRTC_SERVER,
				appName: EASYRTC_APP_NAME,
				roomName: EASYRTC_ROOM_NAME
			});
		});
	});
}

function joinRoom(config) {
	// Set server socket url
    easyrtc.setSocketUrl(config.server);

    // Handle peer stream
    easyrtc.setStreamAcceptor(function (socketId, stream, streamName) {
    	TestSetPeerStream(stream);
    });

    // Register local stream
    easyrtc.register3rdPartyLocalMediaStream(localStream, 'default');

    // Connect to easyrtc server
    return new Promise(function (resolve, reject) {
    	easyrtc.connect(config.appName, resolve, reject);
    }).then(function () {
    	return new Promise(function (resolve, reject) {
    		easyrtc.joinRoom(config.roomName, {}, resolve, reject);
    	});
    });
}
