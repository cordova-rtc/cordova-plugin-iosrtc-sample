const TWILIO_TOKEN = 'YOUR_TWILIO_TOKEN';
const TWILIO_GROUP = 'test';

function TestRTCPeerConnection() {

	// Patch MediaStreamTrack with clone
	MediaStreamTrack.prototype.clone = function () {
	    return this;
	};

	return loadScript('https://media.twiliocdn.com/sdk/js/video/releases/2.4.0/twilio-video.js').then(function () {
		return joinRoom({
			token: TWILIO_TOKEN,
			room: TWILIO_GROUP
		});
	});
}

function joinRoom(config) {

	const Video = Twilio.Video;
	Video.createLocalVideoTrack().then(track => {
	    //const localMediaContainer = document.querySelector('.local-stream');
	    ///localMediaContainer.appendChild(track.attach());
	});

	Video.connect(config.token, {
	    name: config.room,
	    //sdpSemantics: 'plan-b',
	    //bundlePolicy: 'max-compat'
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
	    const div = document.createElement('div');
	    div.id = participant.sid;
	    participant.on('trackSubscribed', (track) => {
	    	trackSubscribed(div, track)
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

	    var div = document.getElementById(participant.sid)
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
