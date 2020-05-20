/* global RTCPeerConnection */
const WEBSOCKET_SERVER = 'connect.websocket.in/v3';
const WEBSOCKET_CHANNEL = '1';
const WEBSOCKET_TOKEN = "ySGGACsat7vGEyQdDwrFSu0AoWCae2uNsZe418d7eh6AfJDr9U9nUcgp5MtS";

//
// RTCPeerConnection Config
// Note: Change to match your TURN and other webRTC settings.
//

var peerConnectionConfig = {
    offerToReceiveVideo: true,
    offerToReceiveAudio: true,
    //iceTransportPolicy: 'relay',
    //sdpSemantics: 'unified-plan',
    sdpSemantics: 'plan-b',
    bundlePolicy: 'max-compat',
    rtcpMuxPolicy: 'negotiate',
    iceServers: [
        {
            urls: "stun:stun.stunprotocol.org"
        }
    ]
};

var peerId = uuid4(),
    peerConnectionsCandicates = {};

var optionalsConstraints = [
    {"DtlsSrtpKeyAgreement": true},
    {"googImprovedWifiBwe": false},
    {"googDscp": false},
    {"googCpuOveruseDetection": false}
];

var offerConstraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
    optionals: optionalsConstraints,
};

var answerConstraints = {
    optional: optionalsConstraints,
    //iceRestart: true
};

//
// WebSocket Signaling
//

var webSocket,
    webSocketChannel = WEBSOCKET_CHANNEL,
    webSocketToken = WEBSOCKET_TOKEN,
    webSocketHostname = WEBSOCKET_SERVER;

function webSocketSendMessage(msg) {
    console.debug('webSocketSendMessage', msg);
    webSocket.send(JSON.stringify(msg));
}

function notifyWebSocketRoom() {
    webSocket.send(JSON.stringify({
        source: peerId,
        type: 'peer'
    }));
}

function joinWebSocketRoom() {

    var webSocketUrl = 'wss://' + webSocketHostname + '/' + webSocketChannel +
                        '?apiKey=' + webSocketToken;

    webSocket = new WebSocket(webSocketUrl);

    webSocket.onopen = function(e) {
        console.debug('socket.open', e);
        notifyWebSocketRoom();
    };

    webSocket.onclose = function(e) {
        webSocket = null;
        console.debug('socket.close', e);
        TestHangupRTCPeerConnections(peerConnections);
        //TestRTCPeerConnection();
    };

    webSocket.onmessage = function(e) {
        console.debug('socket.message', e);
        var data = JSON.parse(e.data);
        if (data.type == 'offer' && data.target === peerId) {
                TestCallAwnserPeer(data.source, {
                    type: data.type,
                    sdp: data.sdp
                });
                TestControlsOutgoingCall();
        } else if (data.type == 'answer' && data.target === peerId) {
            if (peerConnections[data.source]) {
                TestCallAcceptedByPeer(data.source, {
                    type: data.type,
                    sdp: data.sdp
                });
                TestControlsIncomingCall();
            } else {
                console.error('TestCallAcceptedByPeer.err', 'Invalid peer', data.source);
            }
        } else if (data.type == 'candidate' && data.target === peerId) {
            TestReceiveCandicate(data.source, data.candidate);
        } else if (data.type == 'peer') {
            TestCallOfferPeer(data.source);
        } else if (data.type == 'accepted') {

        } else if (data.type == 'rejected') {
            TestHangupRTCPeerConnection(data.source);
        } else if (data.type == 'closed') {
            TestHangupRTCPeerConnection(data.source);
        }
    };

    webSocket.onerror = function(e) {
        console.error('socket.error', e);
    };
}

//
//
//

var preferredCodec;// = 'VP8';

// Find the line in sdpLines that starts with |prefix|, and, if specified,
// contains |substr| (case-insensitive search).
function findLine(sdpLines, prefix, substr) {
  return findLineInRange(sdpLines, 0, -1, prefix, substr);
}

// Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
// and, if specified, contains |substr| (case-insensitive search).
function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
  var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
  for (var i = startLine; i < realEndLine; ++i) {
    if (sdpLines[i].indexOf(prefix) === 0) {
      if (!substr ||
          sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
        return i;
      }
    }
  }
  return null;
}

// Gets the codec payload type from sdp lines.
function getCodecPayloadType(sdpLines, codec) {
  var index = findLine(sdpLines, 'a=rtpmap', codec);
  return index ? getCodecPayloadTypeFromLine(sdpLines[index]) : null;
}

// Gets the codec payload type from an a=rtpmap:X line.
function getCodecPayloadTypeFromLine(sdpLine) {
  var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
  var result = sdpLine.match(pattern);
  return (result && result.length === 2) ? result[1] : null;
}

// Returns a new m= line with the specified codec as the first one.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');

  // Just copy the first three parameters; codec order starts on fourth.
  var newLine = elements.slice(0, 3);

  // Put target payload first and copy in the rest.
  newLine.push(payload);
  for (var i = 3; i < elements.length; i++) {
    if (elements[i] !== payload) {
      newLine.push(elements[i]);
    }
  }
  return newLine.join(' ');
}

// Sets |codec| as the default |type| codec if it's present.
// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
function maybePreferCodec(sdp, type, dir, codec) {
  var str = type + ' ' + dir + ' codec';
  if (!codec) {
    console.info('No preference on ' + str + '.');
    return sdp;
  }

  console.info('Prefer ' + str + ': ' + codec);

  var sdpLines = sdp.split('\r\n');

  // Search for m line.
  var mLineIndex = findLine(sdpLines, 'm=', type);
  if (mLineIndex === null) {
    return sdp;
  }

  // If the codec is available, set it as the default in m line.
  var payload = getCodecPayloadType(sdpLines, codec);
  if (payload) {
    sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], payload);
  }

  sdp = sdpLines.join('\r\n');
  return sdp;
}

// Promotes |audioSendCodec| to be the first in the m=audio line, if set.
function maybePreferAudioSendCodec(sdp, params) {
  return maybePreferCodec(sdp, 'audio', 'send', params.audioSendCodec);
}

// Promotes |audioRecvCodec| to be the first in the m=audio line, if set.
function maybePreferAudioReceiveCodec(sdp, params) {
  return maybePreferCodec(sdp, 'audio', 'receive', params.audioRecvCodec);
}

// Promotes |videoSendCodec| to be the first in the m=audio line, if set.
function maybePreferVideoSendCodec(sdp, params) {
  return maybePreferCodec(sdp, 'video', 'send', params.videoSendCodec);
}

// Promotes |videoRecvCodec| to be the first in the m=audio line, if set.
function maybePreferVideoReceiveCodec(sdp, params) {
  return maybePreferCodec(sdp, 'video', 'receive', params.videoRecvCodec);
}


//
// WebRTC Signaling
//

function TestCallOfferPeer(targetPeerId, constraints) {
    var peerConnection = peerConnections[targetPeerId] || new RTCPeerConnection(peerConnectionConfig);

    console.debug('TestCallOfferPeer', targetPeerId, peerConnection.connectionState);
    if (!peerConnection.TestListenEvents) {
        peerConnection.TestListenEvents = true;
        peerConnections[targetPeerId] = peerConnection;
        TestRemoveStreamToPeerConnection(peerConnection, localStream);
        TestAddStreamToPeerConnection(peerConnection, localStream);
        TestListenPeerConnection(targetPeerId, peerConnection);
    }

    return peerConnection.createOffer(constraints || offerConstraints).then(function(desc) {

        if (preferredCodec) {
            desc.sdp = maybePreferVideoReceiveCodec(desc.sdp, {
                videoRecvCodec: preferredCodec
            });

            desc.sdp = maybePreferVideoSendCodec(desc.sdp, {
                videoSendCodec: preferredCodec
            });
        }

        return peerConnection.setLocalDescription(desc).then(function() {
            webSocketSendMessage({
                source: peerId,
                target: targetPeerId,
                type: desc.type,
                sdp: desc.sdp
            });
        });
    }).catch(function(err) {
        console.error('TestCallOfferPeerError', err.message, err);
        TestHangupRTCPeerConnection(targetPeerId, peerConnection);
    });
}

function TestCallAwnserPeer(targetPeerId, desc, constraints) {
    var peerConnection = peerConnections[targetPeerId] || new RTCPeerConnection(peerConnectionConfig);

    console.debug('TestCallAwnserPeer', targetPeerId, peerConnection.connectionState);
    if (!peerConnection.TestListenEvents) {
        peerConnection.TestListenEvents = true;
        peerConnections[targetPeerId] = peerConnection;
        TestRemoveStreamToPeerConnection(peerConnection, localStream);
        TestAddStreamToPeerConnection(peerConnection, localStream);
        TestListenPeerConnection(targetPeerId, peerConnection);
    }

    return peerConnection.setRemoteDescription(desc).then(function() {
        return peerConnection.createAnswer(constraints || answerConstraints).then(function(desc) {

            if (preferredCodec) {
                desc.sdp = maybePreferVideoReceiveCodec(desc.sdp, {
                    videoRecvCodec: preferredCodec
                });

                desc.sdp = maybePreferVideoSendCodec(desc.sdp, {
                    videoSendCodec: preferredCodec
                });
            }

            return peerConnection.setLocalDescription(desc).then(function() {

                webSocketSendMessage({
                    source: peerId,
                    target: targetPeerId,
                    type: desc.type,
                    sdp: desc.sdp
                });
            });
        });
    }).catch(function(err) {
        console.error('TestCallAwnserPeerError', err);
        TestHangupRTCPeerConnection(targetPeerId, peerConnection);
    });
}

function TestProcessCandicate(targetPeerId) {
    var peerConnection = peerConnections[targetPeerId];
    if (peerConnection && peerConnectionsCandicates[targetPeerId]) {
        peerConnectionsCandicates[targetPeerId].forEach(function(can) {
            console.debug('peerConnection.addIceCandidate', peerConnection.signalingState, can);
            peerConnection.addIceCandidate(can).catch(function(err) {
                console.error('peerConnection.addIceCandidateError', err.message, err);
            });
        });
        peerConnectionsCandicates[targetPeerId].length = 0;
    }
}

function TestReceiveCandicate(targetPeerId, can) {
    var peerConnectionCandicate = peerConnectionsCandicates[targetPeerId] = peerConnectionsCandicates[targetPeerId] || [];
    peerConnectionCandicate.push(can);
    TestProcessCandicate(targetPeerId);
}

function TestListenPeerConnection(targetPeerId, peerConnection) {

    var isNegotiating = false;
    var disconnectedTimer;
    peerConnection.addEventListener('icecandidate', function(e) {
        var candidate = e.candidate;
        console.debug('peerConnection.icecandidate', peerConnection, candidate);

        if (candidate && isNegotiating) {
            webSocketSendMessage({
                source: peerId,
                target: targetPeerId,
                type: 'candidate',
                candidate: candidate
            });
        }
    });

    peerConnection.addEventListener('open', function(e) {
        console.debug('peerConnection.open', e);
        TestSetPeerStreamLoading(false);
    });

    peerConnection.addEventListener('close', function(e) {
        console.debug('peerConnection.close', e);
        TestHangupRTCPeerConnection(targetPeerId, peerConnection);
    });

    peerConnection.addEventListener('track', function(e) {
        console.debug('peerConnection.addTrack', e);
    });

    peerConnection.addEventListener('addstream', function(e) {
        console.debug('peerConnection.addStream', e);
        TestSetPeerStream(e.stream);
    });

    peerConnection.addEventListener('icegatheringstatechange', function(e) {
        console.debug('peerConnection.iceGatheringStateChange', e);
    });

    // https://stackoverflow.com/questions/48963787/failed-to-set-local-answer-sdp-called-in-wrong-state-kstable
    // https://bugs.chromium.org/p/chromium/issues/detail?id=740501
    peerConnection.addEventListener('signalingstatechange', function(e) {
        console.debug('peerConnection.signalingstatechange', peerConnection.signalingState, e);

        clearTimeout(disconnectedTimer);
        isNegotiating = (peerConnection.signalingState !== "stable" && peerConnection.signalingState !== "closed");

        if (peerConnection.signalingState === 'closed') {
            TestHangupRTCPeerConnection(targetPeerId, peerConnection);
        }
    });

    peerConnection.addEventListener('negotiationneeded', function(e) {
        console.debug('peerConnection.negotiationneeded', e);
        // TODO https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/negotiationneeded_event
    });
}

function TestCallAcceptedByPeer(targetPeerId, desc) {
    var peerConnection = peerConnections[targetPeerId];
    return peerConnection.setRemoteDescription(desc).then(function() {
        webSocketSendMessage({
            source: peerId,
            target: targetPeerId,
            type: 'accepted'
        });
    }).catch(function(err) {
        console.error('TestCallAcceptedByPeerError', err.message, err);
        webSocketSendMessage({
            source: peerId,
            target: targetPeerId,
            type: 'rejected'
        });
    });
}


function TestRTCPeerConnection() {
    if (webSocket) {
        notifyWebSocketRoom();
    } else {
        joinWebSocketRoom();
    }
}