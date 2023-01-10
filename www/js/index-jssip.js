/* global RTCPeerConnection */
// jshint unused:false

// Config
// Note: Change to match your SIP server and user credentials.

const FREESWITCH_URL = 'sip.example.com';
const FREESWITCH_PORT = '7443';
const FREESWITCH_USERNAME = 'test';
const FREESWITCH_CREDENTIALS = 'test';

var sipConfig = {
    display_name: 'iOSRTC',
    server: 'wss://' + FREESWITCH_URL + ':7443',
    uri: 'sip:' + FREESWITCH_USERNAME + '@' + FREESWITCH_URL,
    password: FREESWITCH_CREDENTIALS,
    authorization_user: null,
    realm: FREESWITCH_URL
};

// Set debug
window.localStorage.setItem('debug', '* -engine* -socket* *ERROR* *WARN*');

// Note: Select JsSip Implementation (JSSip and SIP.js supported).
var jsSipUrl = "https://cdnjs.cloudflare.com/ajax/libs/jssip/3.1.2/jssip.min.js";
//var jsSipUrl = "https://sipjs.com/download/sip-0.15.6.min.js";


//
// Test RTCPeerConnection
//

var peerConnectionsCandicates = [];

var webSocket,
    webSocketChannel = 'iosrtc',
    webSocketRoomID = 'jssip';

var mediaConstraints = {
    video: true,
    audio: true
};

function webSocketSendMessage(msg) {
    console.log('webSocketSendMessage', msg);
    webSocket.send(JSON.stringify(msg));
}

var sipUserAgent, sipSession;

function TestCallOfferPeer(callUri) {

    callUri = callUri || '3500';
    // 666, 9196

    console.log('jssip.call', callUri);

    var call;
    if (typeof sipUserAgent.invite === 'function') {
        call = sipUserAgent.invite.bind(sipUserAgent);
    } else {
        call = sipUserAgent.call.bind(sipUserAgent);
    }

    sipSession = call(callUri, {
        //mediaStream: localStream,
        // JSSIP
        mediaConstraints: mediaConstraints,
        eventHandlers: {
            'confirmed': function(data) {
                console.info('dialCall.confirmed', data);
            },
            'progress': function(data) {
                console.info('dialCall.progress', data);
            },
            'failed': function(data) {
                console.info('dialCall.failed', data);
            },
            'ended': function(data) {
                console.info('dialCall.ended', data);
            }
        },
        // Sip.JS
        sessionDescriptionHandlerOptions: {
            constraints: mediaConstraints
        },
        // Common
        pcConfig: {
            sdpSemantics: 'plan-b',
            tcpMuxPolicy: 'negotiate',
            bundlePolicy: 'balanced',
            iceServers: [
                {
                    urls: "stun:sip.example.com:3478"
                },
                {
                    urls: "turn:sip.example.com:5349",
                    username: "turnuser",
                    credential: "turnpwd"
                }, {
                    urls: "turn:sip.example.com:5349?transport=tcp",
                    username: "turnuser",
                    credential: "turnpwd"
                }
            ]
        }
    });

    sipSession.on('ended', function(e) {
        console.debug('sipSession.ended', e);
    });

    // Sip.js
    if (!isJsSip) {

        sipSession.on('trackAdded', function(e) {

            console.debug('sipSession.trackAdded', e);

            var peerConnection = sipSession.sessionDescriptionHandler.peerConnection;

            // Save peerConnection
            peerConnections[sipSession.id] = peerConnection;

            peerConnection.addEventListener('addstream', function(e) {
                console.debug('peerConnection.addStream', e);
                TestSetPeerStream(e.stream);
            });

            // Gets local tracks
            var localStream = new MediaStream();
            peerConnection.getSenders().forEach(function(sender) {
                localStream.addTrack(sender.track || sender);
            });

            TestSetLocalStream(localStream);
        });
    }
}

function TestCallAwnserPeer() {

    sipSession.answer({
        //mediaStream: localStream,
        // JSSIP
        mediaConstraints: mediaConstraints,
        // Sip.JS
        media: mediaConstraints,
        // Common
        pcConfig: peerConnectionConfig,
        rtcConstraints: {
            mandatory: {
                OfferToReceiveVideo: true,
                OfferToReceiveAudio: true
            }
        }
    });
}

function PatchPromiseToCallback(object, prototypeMethod) {

    var originalMethod = object.prototype[prototypeMethod];

    object.prototype[prototypeMethod] = function(arg) {
        var success, failure,
            args = Array.prototype.slice.call(arguments);

        console.log('PatchPromiseToCallback', prototypeMethod, args);

        var finalArgs = [];
        args.forEach(function(arg, idx) {
            if (typeof arg === 'function') {
                if (!success) {
                    success = arg;
                } else {
                    failure = arg;
                }
            } else {
                finalArgs.push(arg);
            }
        });

        return originalMethod.apply(this, finalArgs).then(success).catch(failure);
    };
}

var isJsSip;
function TestRTCPeerConnection() {

    loadScript(jsSipUrl).then(function() {

        isJsSip = typeof JsSIP !== 'undefined';

        var socket;
        if (typeof JsSIP === 'undefined') {
            JsSIP = SIP;
        } else {
            socket = new JsSIP.WebSocketInterface(sipConfig.server);
        }

        //JsSIP.debug.enable('JsSIP:*');

        sipUserAgent = new JsSIP.UA({
            display_name: sipConfig.display_name,
            connection_recovery_min_interval: 10,
            connection_recovery_max_interval: 60,
            sockets: [socket],
            session_timers: false,
            use_preloaded_route: false,
            uri: sipConfig.uri,
            password: sipConfig.password,
            authorization_user: sipConfig.authorization_user,
            realm: sipConfig.realm,
            //  Sip.JS
            hackWssInTransport: true,
            authorizationUser: sipConfig.authorization_user,
            transportOptions: {
                wsServers: sipConfig.server,
            },
            allowLegacyNotifications: true,
            displayName: 'iOSRTC'
        });

        sipUserAgent.on('registrationFailed', function(e) {
            console.log('jssip.registrationFailed', e);
        });

        sipUserAgent.on("registered", function(e) {
            console.log('jssip.registered', e);
            TestCallOfferPeer();
        });

        // JSSIP
        if (isJsSip) {

            sipUserAgent.on('unregistered', function(e) {
                console.log('jssip.unregistered', e);

            });

            sipUserAgent.on('disconnected', function(e) {
                console.log('jssip.disconnected', e);

            });

            sipUserAgent.on("newRTCSession", function(e) {
                console.log('jssip.newRTCSession', e);

                var session = e.session; // outgoing call session here

                if (session.direction === 'incoming') {

                    session.answer({
                        // JSSIP
                        //mediaStream: localStream,
                        mediaConstraints: mediaConstraints,
                        // Sip.JS
                        sessionDescriptionHandlerOptions: {
                            constraints: mediaConstraints
                        },
                        rtcOfferConstraints: {
                            OfferToReceiveAudio: true,
                            OfferToReceiveVideo: false
                        },
                        rtcAnswerConstraints: {
                            OfferToSendAudio: false,
                            OfferToSendVideo: true
                        }
                    });

                    peerConnection = session.connection;

                    peerConnection.addEventListener('addstream', function(e) {
                        console.debug('peerConnection.addStream', e);
                        TestSetPeerStream(e.stream);
                    });

                } else if (session.direction === 'outgoing') {

                    peerConnection = session.connection;

                    peerConnection.addEventListener('addstream', function(e) {
                        console.debug('peerConnection.addStream', e);
                        TestSetPeerStream(e.stream);
                    });
                }

                // Save peerConnection
                peerConnections[session.id] = peerConnection;

                // Gets local tracks
                session.on('connecting', function () {

                    var localStream = new MediaStream();
                    peerConnection.getSenders().forEach(function(sender) {
                        localStream.addTrack(sender.track || sender);
                    });

                    TestSetLocalStream(localStream);
                });
            });
        }

        sipUserAgent.start();

    });
}
