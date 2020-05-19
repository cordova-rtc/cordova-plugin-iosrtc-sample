/* global RTCPeerConnection */
// jshint unused:false

// Config
// Note: Change to match your Janus server
var server = "https://janus.conf.meetecho.com/janus";

// Note: Override common.js adapterVersion and adapterUrl
var adapterVersion = 'latest';
var adapterUrl = "https://webrtc.github.io/adapter/adapter-" + adapterVersion + ".js";

//
// Test RTCPeerConnection
//

var janus = null,
    echotest = null;

function TestRTCPeerConnection() {
    return loadScript('https://janus.conf.meetecho.com/janus.js').then(function() {

        // Make sure the browser supports WebRTC
        if (!Janus.isWebrtcSupported()) {
            alert("No WebRTC support... ");
            return;
        }

        var opaqueId = "echotest-" + Janus.randomString(12);

        // Initialize the library (all console debuggers enabled)
        Janus.init({
            debug: "all",
            callback: function() {


                // TODO overide unifiedPlan from Janus.init
                // Janus.unifiedPlan = false;

                // Create session
                janus = new Janus({
                    server: server,
                    iceServers: peerConnectionConfig.iceServers,
                    success: function() {
                        // Attach to echo test plugin
                        janus.attach({
                            plugin: "janus.plugin.echotest",
                            opaqueId: opaqueId,
                            success: function(pluginHandle) {
                                echotest = pluginHandle;
                                Janus.log("Plugin attached! (" + echotest.getPlugin() + ", id=" + echotest.getId() + ")");

                                // Negotiate WebRTC
                                var body = {
                                    "audio": true,
                                    "video": true
                                };
                                Janus.debug("Sending message (" + JSON.stringify(body) + ")");
                                echotest.send({
                                    "message": body
                                });

                                Janus.debug("Trying a createOffer too (audio/video sendrecv)");
                                echotest.createOffer({
                                    // No media provided: by default, it's sendrecv for audio and video
                                    //media: { data: false },  // Let's negotiate data channels as well
                                    stream: localStream,
                                    success: function(jsep) {
                                        Janus.debug("Got SDP!");
                                        Janus.debug(jsep);
                                        echotest.send({
                                            "message": body,
                                            "jsep": jsep
                                        });
                                    },
                                    error: function(error) {
                                        Janus.error("WebRTC error:", error);
                                    }
                                });
                            },
                            error: function(error) {
                                console.error("  -- Error attaching plugin...", error);
                            },
                            consentDialog: function(on) {
                                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
                            },
                            iceState: function(state) {
                                Janus.log("ICE state changed to " + state);
                            },
                            mediaState: function(medium, on) {
                                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                            },
                            webrtcState: function(on) {
                                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                            },
                            slowLink: function(uplink, nacks) {
                                Janus.warn("Janus reports problems " + (uplink ? "sending" : "receiving") +
                                    " packets on this PeerConnection (" + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
                            },
                            onmessage: function(msg, jsep) {
                                Janus.debug(" ::: Got a message :::");
                                Janus.debug(msg);
                                if (jsep !== undefined && jsep !== null) {
                                    Janus.debug("Handling SDP as well...");
                                    Janus.debug(jsep);
                                    echotest.handleRemoteJsep({
                                        jsep: jsep
                                    });
                                }
                            },
                            onlocalstream: function(stream) {
                                Janus.debug(" ::: Got a local stream :::");
                                Janus.debug(stream);

                                localVideoEl = appContainer.querySelector('.local-video');

                                // Note: Expose for debug
                                localStream = stream;

                                // Attach local stream to video element
                                localVideoEl.srcObject = localStream;
                            },
                            onremotestream: function(stream) {
                                Janus.debug(" ::: Got a remote stream :::");
                                Janus.debug(stream);
                                TestSetPeerStream(stream);
                            },
                            ondataopen: function(data) {
                                Janus.log("The DataChannel is available!");
                            },
                            ondata: function(data) {
                                Janus.debug("We got data from the DataChannel! " + data);
                            },
                            oncleanup: function() {
                                Janus.log(" ::: Got a cleanup notification :::");
                            }
                        });
                    },
                    error: function(error) {
                        console.error('Janus.error', error);
                    }
                });
            }
        });
    });
}