// Config
// Note: Change to match your adapter version

var adapterVersion = 'latest';
var adapterUrl = "https://webrtc.github.io/adapter/adapter-" + adapterVersion + ".js";

// Detect if current enviroment is cordova
var isCordova = !document.URL.includes('http');

//
// Container
//

var appContainer = document.querySelector('.app');

//
// Utils
//

function uuid4() {
    function hex(s, b) {
        return s +
            (b >>> 4).toString(16) + // high nibble
            (b & 0b1111).toString(16); // low nibble
    }

    var r = crypto.getRandomValues(new Uint8Array(16));

    r[6] = r[6] >>> 4 | 0b01000000; // Set type 4: 0100
    r[8] = r[8] >>> 3 | 0b10000000; // Set variant: 100

    return r.slice(0, 4).reduce(hex, '') +
        r.slice(4, 6).reduce(hex, '-') +
        r.slice(6, 8).reduce(hex, '-') +
        r.slice(8, 10).reduce(hex, '-') +
        r.slice(10, 16).reduce(hex, '-');
}

function loadScript(scriptUrl) {
    return new Promise(function(resolve, reject) {
        // load adapter.js
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.src = scriptUrl;
        script.async = false;
        document.getElementsByTagName("head")[0].appendChild(script);
        script.onload = function() {
            console.debug('loadScript.loaded', script.src);
            resolve();
        };
    });
}

//
// Event debug
//

var excludeEvents = [
    'ontimeupdate', 'onprogress',
    'onmousemove', 'onmouseover', 'onmouseout', 'onmouseenter', 'onmouseleave',
    'onpointermove', 'onpointerover', 'onpointerenter', 'onpointerrawupdate', 'onpointerout', 'onpointerleave',
    'onpointerdown', 'onmousedown', 'onclick', 'onmouseup', 'onpointerup'
];

function TestListenEvents(eventTarget) {

    if (eventTarget.TestListenEvents) {
        return;
    }
    eventTarget.TestListenEvents = true;

    function eventTriggered(event) {
       console.debug('event.triggered', event, eventTarget);
    }

    for(var eventName in eventTarget) {
        if (eventName.search('on') === 0 && excludeEvents.indexOf(eventName) == -1) {
           eventTarget.addEventListener(eventName.slice(2), eventTriggered.bind(eventTarget, eventName));
        }
    }
}

//
// MediaStreams
//

var localStream, localVideoEl, localDeviceId;
function TestGetUserMedia(deviceId) {

    if (!deviceId) {
        return navigator.mediaDevices.enumerateDevices().then(function(devices) {
            var newDevice = devices.filter(function(device) {
                return device.kind === 'videoinput';
            }).find(function(device, idx) {
                return device.deviceId !== 'default';
            });

            localDeviceId = newDevice ? newDevice.deviceId : null;
            return TestGetUserMedia(localDeviceId || 'default');
        });
    }

    console.debug('TestGetUserMedia', deviceId);
    return navigator.mediaDevices.getUserMedia({
        /*
        video: true,
        */
        video: {
            deviceId: deviceId,

            /*
            width: {
                max: 1280,
                min: 640
            },
            height: {
                max: 720,
                min: 480
            },
            */
                                               /*
            height: {
                ideal: 240,
                min: 180,
                max: 480
            },
                                                */
            //facingMode: 'environment'
            //height: 480,
            //width: 1280,
            //height: 720,
            //width: 1280,
            //height: 960,
            //aspectRatio: 16/9,
            //aspectRatio: 11/9,
            //aspectRatio: 4/3,
            //frameRate:{ min: 30.0, max: 30.0 }
        },
        audio: true
        /*
        video: {
          // Test Back Camera
          //deviceId: 'com.apple.avfoundation.avcapturedevice.built-in_video:0'
          //sourceId: 'com.apple.avfoundation.avcapturedevice.built-in_video:0'
          deviceId: {
            exact: 'com.apple.avfoundation.avcapturedevice.built-in_video:0'
          }
        },
        audio: {
          deviceId: {
            exact: 'Built-In Microphone'
          }
        }*/
    }).then(function(stream) {

        console.debug('getUserMedia.stream', stream);
        console.debug('getUserMedia.stream.getTracks', stream.getTracks());

        TestSetLocalStream(stream);

        // Test mute at Start
        /*
        localStream.getAudioTracks().forEach(function (track) {
            track.enabled = false;
        });
        */
        return localStream;

    }).catch(function(err) {
        console.error('getUserMediaError', err, err.stack);
    });
}

function TestGetDisplayMedia() {
    console.debug('getDisplayMedia');
    return navigator.mediaDevices.getDisplayMedia({}).then(function(stream) {

        console.debug('getDisplayMedia.stream', stream);
        console.debug('getDisplayMedia.stream.getTracks', stream.getTracks());

        TestSetLocalStream(stream);

        // Test mute at Start
        /*
        localStream.getAudioTracks().forEach(function (track) {
            track.enabled = false;
        });
        */

        return localStream;

    }).catch(function(err) {
        console.error('getDisplayMedia', err, err.stack);
    });
}

function TestSetLocalStream(localStreamMedia) {

    localVideoEl = appContainer.querySelector('.local-video');

    // Note: Expose for debug
    localStream = localStreamMedia;

    // Listen to all events
    TestListenEvents(localStream);
    TestListenEvents(localVideoEl);

    // Attach local stream to video element
    localVideoEl.srcObject = localStream;
}

var peerVideoEl, peerVideoElLoader, peerStream;

function TestSetPeerStreamLoading(loaded) {
    console.debug('TestSetPeerStreamLoading', loaded);

    peerVideoEl = appContainer.querySelector('.remote-video');
    peerVideoElLoader = appContainer.querySelector('.remote-video-loader');

    if (!loaded) {
        peerVideoElLoader.classList.remove('hidden');
        peerVideoEl.classList.add('hidden');
    } else {
        peerVideoElLoader.classList.add('hidden');
        peerVideoEl.classList.remove('hidden');

        if (isCordova) {
            appContainer.style.background = "transparent";
        }
    }
}

function TestSetPeerTracks(peerConnection) {
  var peerStreamMedia = new MediaStream();
  peerConnection.getReceivers().forEach(function (receiver) {
    console.debug('peerStreamMedia.addTrack', receiver, peerStreamMedia);
    peerStreamMedia.addTrack(receiver.track);
  });

  TestSetPeerStream(peerStreamMedia);
}

function TestSetPeerStream(peerStreamMedia) {

    peerVideoEl = appContainer.querySelector('.remote-video');

    TestSetPeerStreamLoading(true);
    peerVideoEl.removeEventListener('canplay', TestSetPeerStreamLoading);
    peerVideoEl.addEventListener('canplay', TestSetPeerStreamLoading);

    // Note: Expose for debug
    peerStream = peerStreamMedia;

    // Listen to all events
    TestListenEvents(peerStream);
    TestListenEvents(peerVideoEl);

    // Attach peer stream to video element
    peerVideoEl.srcObject = peerStream;

    // Display
    peerVideoEl.classList.remove('hidden');

    function isVideoOnly() {
        // Handle video only display
        if (peerStreamMedia.getAudioTracks().length) {
            peerVideoEl.classList.remove('video-only');
        } else {
            peerVideoEl.classList.add('video-only');
        }
    };

    isVideoOnly();

    peerStreamMedia.addEventListener('addtrack', isVideoOnly);
    peerStreamMedia.addEventListener('removetrack', isVideoOnly);

    if (isCordova) {
        appContainer.style.background = "transparent";
    }
}

function TestStopLocalMediaStream(localStream) {

    // Stop previous stream tracks
    if (localStream) {
        localStream.getTracks().forEach(function(track) {
            track.stop();
        });

        if (localVideoEl.srcObject === localStream) {
            localVideoEl.srcObject = null;
        }
    }
}

function TestSwitchCamera() {

    if (localStream) {
        TestStopLocalMediaStream(localStream);
    }

    return navigator.mediaDevices.enumerateDevices().then(function(devices) {
        var idx = 0;
        var newDevice = devices.filter(function(device) {
            return device.kind === 'videoinput';
        }).find(function(device, idx) {
            return device.deviceId !== localDeviceId;
        });


        localDeviceId = newDevice ? newDevice.deviceId : null;

        console.debug('TestSwitchCamera', localDeviceId);

        if (localDeviceId) {
            return TestGetUserMedia(localDeviceId);
        } else if (typeof navigator.mediaDevices.getDisplayMedia !== 'undefined') {
            return TestGetDisplayMedia();
        }

    }, function(err) {
        console.error('enumerateDevices.err', err);
    });
}

function TestAddStreamToPeerConnection(peerConnection, localStream) {
    try {
        if (!isCordova && typeof peerConnection.addStream === 'function') {
            peerConnection.addStream(localStream);
        } else {
            var localPeerStream = new MediaStream();
            localStream.getTracks().forEach(function(track) {
                console.debug('peerConnection.addTrack', peerConnection, track);
                peerConnection.addTrack(track, localPeerStream);
            });
        }
    } catch (err) {
        console.error('TestAddStreamToPeerConnection.err', err);
    }
}

function TestRemoveStreamToPeerConnection(peerConnection, localStream) {
    try {
        if (typeof peerConnection.removeStream === 'function') {
            peerConnection.removeStream(localStream);
        } else {
            peerConnection.getSenders().forEach(function(track) {
                console.debug('peerConnection.removeTrack', peerConnection, track);
                peerConnection.removeTrack(track);
            });
        }
    } catch (err) {
        console.error('TestRemoveStreamToPeerConnection.err', err);
    }
}

//
// PeerConnections
//

var peerConnections = {};

function TestHangupRTCPeerConnection(targetId, peerConnection) {
    peerConnection = peerConnection || peerConnections[targetId];
    console.debug('TestHangupRTCPeerConnection', targetId, peerConnection);
    delete peerConnections[targetId];
    delete peerConnectionsCandicates[targetId];
    peerConnection.close();

    if (Object.keys(peerConnections).length === 0) {
        TestControlsClosingCall();
    }
}

function TestHangupRTCPeerConnections(peerConnections) {
    Object.keys(peerConnections).forEach(function(targetId) {
        var peerConnection = peerConnections[targetId];
        TestHangupRTCPeerConnection(targetId, peerConnection);
    });
}

function selectControlByName(name) {
    return appContainer.querySelector('.controls .btn[name=' + name + ']');
}

function TestControlsIncomingCall() {
    selectControlByName('call_remote').classList.add('hidden');
    selectControlByName('hangup_remote').classList.remove('hidden');
    appContainer.querySelector('.notice-alone').classList.add('hidden');

    if (isCordova) {
        appContainer.style.background = "transparent";
    }
}

function TestControlsOutgoingCall() {
    selectControlByName('call_remote').classList.add('hidden');
    selectControlByName('hangup_remote').classList.remove('hidden');
    appContainer.querySelector('.notice-alone').classList.add('hidden');

    if (isCordova) {
        appContainer.style.background = "transparent";
    }
}

function TestControlsClosingCall() {
    selectControlByName('hangup_remote').classList.add('hidden');
    selectControlByName('call_remote').classList.remove('hidden');
    appContainer.querySelector('.notice-alone').classList.remove('hidden');


    peerVideoEl = appContainer.querySelector('.remote-video');
    peerVideoElLoader = appContainer.querySelector('.remote-video-loader');


    if (peerVideoEl) {
        peerVideoEl.classList.add('hidden');
        peerVideoEl.srcObject = null;
    }

    if (peerVideoElLoader) {
        peerVideoElLoader.classList.add('hidden');
    }

    if (isCordova) {
        appContainer.style.background = "";
    }
}

function TestControls() {

    navigator.mediaDevices.enumerateDevices().then(function(devices) {
        console.debug('enumerateDevices', devices);
        var canSwitchDevice = devices.filter(function(device) {
            return device.kind === 'videoinput';
        }).length > 1;


        if (!canSwitchDevice && typeof navigator.mediaDevices.getDisplayMedia === 'undefined') {
            selectControlByName('switch_camera').classList.add('hidden');
        }
    });

    if (!isCordova || typeof cordova.plugins.iosrtc.selectAudioOutput === 'undefined') {
        selectControlByName('speaker').classList.add('hidden');
        selectControlByName('earpiece').classList.add('hidden');
    }

    if (!isCordova || typeof cordova.plugins.iosrtc.selectAudioOutput === 'undefined') {
        selectControlByName('speaker').classList.add('hidden');
        selectControlByName('earpiece').classList.add('hidden');
    }

    if (!isCordova || typeof cordova.plugins.iosrtc.turnOnSpeaker === 'undefined') {
        selectControlByName('speaker').classList.add('hidden');
    }

    function handleControlsEvent(event) {
        var targetEl = event.target;

        if (!targetEl.classList.contains('btn')) {
            targetEl = targetEl.closest('.btn');
        }

        if (targetEl && targetEl.classList.contains('btn')) {
            var actionName = targetEl.getAttribute('name');
            switch (actionName) {
                case 'mic_on':
                    selectControlByName('mic_on').classList.add('hidden');
                    selectControlByName('mic_off').classList.remove('hidden');
                    localStream.getAudioTracks().forEach(function(track) {
                        track.enabled = true;
                    });
                    break;
                case 'mic_off':
                    selectControlByName('mic_off').classList.add('hidden');
                    selectControlByName('mic_on').classList.remove('hidden');
                    localStream.getAudioTracks().forEach(function(track) {
                        track.enabled = false;
                    });
                    break;
                case 'hangup_remote':

                    TestControlsClosingCall();

                    Object.values(peerConnections).forEach(function(peerConnection) {
                        TestRemoveStreamToPeerConnection(peerConnection, localStream);
                    });

                    TestHangupRTCPeerConnections(peerConnections);
                    break;
                case 'call_remote':
                    TestControlsIncomingCall();

                    TestHangupRTCPeerConnections(peerConnections);

                    TestRTCPeerConnection(localStream);
                    break;
                case 'camera_on':
                    selectControlByName('camera_on').classList.add('hidden');
                    selectControlByName('camera_off').classList.remove('hidden');
                    localVideoEl.classList.remove('hidden');
                    localStream.getVideoTracks().forEach(function(track) {
                        track.enabled = true;
                    });
                    break;
                case 'camera_off':
                    selectControlByName('camera_off').classList.add('hidden');
                    selectControlByName('camera_on').classList.remove('hidden');
                    localVideoEl.classList.add('hidden');
                    localStream.getVideoTracks().forEach(function(track) {
                        track.enabled = false;
                    });
                    break;
                case 'switch_camera':
                    selectControlByName('switch_camera').classList.toggle('btn-active');


                    localVideoEl.classList.remove('hidden');
                    localVideoEl.srcObject = null;
                    /*
                    localStream.getTracks().forEach(function (track) {
                      localStream.removeTrack(track);
                    });
                    */

                    var oldLocalStream = localStream;
                    TestSwitchCamera().then(function() {

                        if (typeof pc1 !== 'undefined' && typeof pc2 !== 'undefined') {

                            pc1.createOffer({
                                iceRestart: true
                            }).then(function(desc) {

                                TestRemoveStreamToPeerConnection(pc1, oldLocalStream);
                                TestAddStreamToPeerConnection(pc1, localStream);

                                return pc1.setLocalDescription(desc).then(function() {
                                    return pc2.setRemoteDescription(desc).then(function() {
                                        return pc2.createAnswer(answerConstraints).then(function(desc) {
                                            return pc2.setLocalDescription(desc).then(function() {
                                                return pc1.setRemoteDescription(desc);
                                            });
                                        });
                                    });
                                });
                            }).catch(function(err) {
                                console.error('TestCallAwnserPeerError', err);
                            });

                        } else {
                            Object.keys(peerConnections).forEach(function(targetPeerId) {
                                var peerConnection = peerConnections[targetPeerId];
                                TestRemoveStreamToPeerConnection(peerConnection, oldLocalStream);
                                TestAddStreamToPeerConnection(peerConnection, localStream);
                                return peerConnection.createOffer({
                                    iceRestart: true
                                }).then(function(desc) {
                                    return peerConnection.setLocalDescription(desc).then(function() {
                                        webSocketSendMessage({
                                            source: peerId,
                                            target: targetPeerId,
                                            type: desc.type,
                                            sdp: desc.sdp
                                        });
                                    });
                                });
                            });
                        }


                    });
                    break;
                case 'speaker':
                    selectControlByName('earpiece').classList.remove('btn-active');
                    selectControlByName('speaker').classList.add('btn-active');
                    cordova.plugins.iosrtc.turnOnSpeaker(true);
                    break;
                case 'earpiece':
                    selectControlByName('speaker').classList.remove('btn-active');
                    selectControlByName('earpiece').classList.add('btn-active');
                    cordova.plugins.iosrtc.selectAudioOutput('earpiece');
                    break;
                case 'mute_remote':
                    selectControlByName('mute_remote').classList.add('hidden');
                    selectControlByName('unmute_remote').classList.remove('hidden');
                    peerStream.getAudioTracks().forEach(function(track) {
                        if (track.kind == 'audio') {
                            track.enabled = false;
                        }
                    });
                    break;
                case 'unmute_remote':
                    selectControlByName('unmute_remote').classList.add('hidden');
                    selectControlByName('mute_remote').classList.remove('hidden');
                    peerStream.getAudioTracks().forEach(function(track) {
                        if (track.kind == 'audio') {
                            track.enabled = true;
                        }
                    });
                    break;
                case 'report':
                    window.location = 'https://github.com/cordova-rtc/cordova-plugin-iosrtc/issues/new';
                    break;

                default:
                    console.error('Unknow button name', targetEl);
            }
        }
    }

    appContainer.addEventListener('click', handleControlsEvent, false);
}

function TestIosRTCSample(event) {

    if (isCordova == false) {
        TestControls();

        loadScript(adapterUrl).then(function() {
            return TestGetUserMedia().then(function(localStream) {
                return TestRTCPeerConnection(localStream);
            });
        }).catch(function (err) {
            console.error(err);
        });

    } else {
        document.addEventListener('deviceready', function() {

            // Init cordova plugins
            if (window.device && window.device.platform == 'iOS') {

                var cordova = window.cordova;

                // Expose WebRTC Globals
                if (cordova && cordova.plugins && cordova.plugins.iosrtc) {

                    //cordova.plugins.iosrtc.debug.enable('*', true);

                    cordova.plugins.iosrtc.registerGlobals();

                    cordova.plugins.iosrtc.turnOnSpeaker(true);

                    // Implement iosrtc HTML over video trick
                    document.documentElement.style.background = "transparent";
                    document.body.style.background = "transparent";
                    //appContainer.style.background = "transparent";
                    appContainer.querySelector('.remote-video').style.zIndex = '-1';
                }

                // Enable Background audio
                if (cordova && cordova.plugins && cordova.plugins.backgroundMode) {
                    cordova.plugins.backgroundMode.enable();
                }
            }

            TestControls();
            loadScript(adapterUrl).then(function () {
                return TestGetUserMedia().then(function(localStream) {
                    return TestRTCPeerConnection(localStream);
                });
            }).catch(function (err) {
                console.error(err);
            });
        });
    }
}

if (document.readyState === "complete" || document.readyState === "loaded") {
  TestIosRTCSample();
} else {
  window.addEventListener("DOMContentLoaded", TestIosRTCSample);
}
