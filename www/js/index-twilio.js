/* jshint esversion: 6 */
const TWILIO_TOKEN = '';
const TWILIO_ROOM = 'test';
const TWILIO_API_URL = 'https://example.com';
const TWILIO_VERSION = '2.4.0';

function TestRTCPeerConnection(localStream) {

	// Patch MediaStreamTrack with clone
	MediaStreamTrack.prototype.clone = function () {
	    return this;
	};

	return loadScript('https://media.twiliocdn.com/sdk/js/video/releases/' + TWILIO_VERSION + '/twilio-video.js').then(function () {
		return getToken().then(function (token) {
			return joinRoom(localStream, {
				token: TWILIO_TOKEN,
				room: TWILIO_ROOM
			});
		});
	});
}

function getToken() {
	if (TWILIO_TOKEN && TWILIO_ROOM) {
		return Promise.resolve({
			token: TWILIO_TOKEN,
			room: TWILIO_ROOM
		});
	}

	// Example via fetch with XSRF TOKEN
	fetch(TWILIO_API_URL + "/auth/session", {
        method: 'get'
    }).then(function (res) {
        var xsrf = res.headers.get('X-XSRF-TOKEN');
        var opts = {
            room: TWILIO_ROOM,
            peerId: 'User-' + Date.now()
        };
        fetch(TWILIO_API_URL + "/api/twiml/room/token", {
            method: 'post',
            body: JSON.stringify(opts),
            headers: {
                'X-XSRF-TOKEN': xsrf,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }).then(function (res) {
            return res.json();
        });
    });
}

function _TestGetUserMedia(deviceId) {
	Video.createLocalTracks().then(tracks => {
    	var localMediaContainer = document.querySelector('.local-stream');
    	tracks.forEach(function(track) {
    		localMediaContainer.appendChild(track.attach());
    	});
	});
}

function joinRoom(localStream, config) {

	var Video = Twilio.Video;
	var audioTracks = localStream.getAudioTracks().map(track => new Video.LocalAudioTrack(track));
	var videoTracks = localStream.getVideoTracks().map(track => new Video.LocalVideoTrack(track));
	var tracks = audioTracks.concat(videoTracks);

	Video.connect(config.token, {
	    name: config.room,
	    tracks: tracks,
	    sdpSemantics: 'plan-b',
	    bundlePolicy: 'max-compat'
	}).then(room => {
	    console.log(`Successfully joined a Room: ${room}`);

		// Attach the Tracks of the Room's Participants.
		var remoteMediaContainer = document.querySelector('.remote-stream');
			room.participants.forEach(function(participant) {
			console.log("Already in Room: '" + participant.identity + "'");
			participantConnected(participant, remoteMediaContainer);
		});

	    room.on('participantConnected', participant => {
	        console.log(`A remote Participant connected: ${participant}`);
	        participantConnected(participant);
	    });

	    room.on('participantDisconnected', participant => {
	        console.log(`A remote Participant connected: ${participant}`);
	        participantDisconnected(participant);
	    });

	}, error => {
	    console.error(`Unable to connect to Room: ${error.message}`);
	});


	function participantConnected(participant) {
	    console.log('Participant "%s" connected', participant.identity);
	    var div = document.createElement('div');
	    div.id = participant.sid;
	    participant.on('trackSubscribed', (track) => {
	    	trackSubscribed(div, track);
	    });
	    participant.on('trackUnsubscribed', trackUnsubscribed);
	    participant.tracks.forEach(publication => {
	        if (publication.isSubscribed) {
	            trackSubscribed(div, publication.track);
	        }
	    });

        var remoteMediaContainer = document.querySelector('.remote-stream');
	    remoteMediaContainer.appendChild(div);
	}

	function participantDisconnected(participant) {
	    console.log('Participant "%s" disconnected', participant.identity);

	    var div = document.getElementById(participant.sid);
	    if (div) {
	    	div.remove();
	    }
	}

	function trackSubscribed(div, track) {
	    div.appendChild(track.attach());
	}

	function trackUnsubscribed(track) {
	    track.detach().forEach(element => element.remove());
	}
}
