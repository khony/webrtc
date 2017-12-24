/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';


/**
 * Get URL Parameters
 */
var url_string = window.location.href;
var url = new URL(url_string);
var room = url.searchParams.get("room");


/**
 * 
 * Signaling client
 * 
 */



function onLocalSessionCreated(session){
  pc1.setLocalDescription(session);
  console.log('created and sending answer');
  socket.emit('answer',session);
  pc1.ontrack = gotRemoteStream;
}

function logError(error){
  console.log('error:');
  console.log(error);
}

// Logging utility function.
function trace(arg) {
  var now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ': ', arg);
}

var servers = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};;
var startTime;
var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');

localVideo.addEventListener('loadedmetadata', function() {
  trace('Local video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.addEventListener('loadedmetadata', function() {
  trace('Remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.onresize = function() {
  trace('Remote video size changed to ' +
    remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight);
  if (startTime) {
    var elapsedTime = window.performance.now() - startTime;
    trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

var localStream;
var pc1;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function gotStream(stream) {
  trace('Received local stream');
  localVideo.srcObject = stream;
  localStream = stream;
}

start();
function start(){
  pc1 = new RTCPeerConnection(servers);
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}

function call() {
  trace('Starting call');
  startTime = window.performance.now();  
  var videoTracks = localStream.getVideoTracks();
  var audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace('Using video device: ' + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace('Using audio device: ' + audioTracks[0].label);
  }
  trace('Created local peer connection object pc1');
  pc1.onicecandidate = function(e) {
    onIceCandidate(pc1, e);
  };
  pc1.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc1, e);
  };
  trace('Added local stream to pc1');
  trace('pc1 createOffer start');
  pc1.createOffer(
    offerOptions
  ).then(
    onCreateOfferSuccess,
    onCreateSessionDescriptionError
  );
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(desc) {
  trace('Offer from pc1\n' + desc.sdp);
  trace('pc1 setLocalDescription start');
  socket.emit('offer',desc);
  pc1.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc1);
    },
    onSetSessionDescriptionError
  );
  
}

function onSetLocalSuccess(pc) {
  trace(getName(pc) + ' setLocalDescription complete');
}

function onSetRemoteSuccess(pc) {
  trace(getName(pc) + ' setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
  }
}

function onIceCandidate(pc, event) {
  /** 
   * add ice candidate
   */
  
  if (event.candidate) {
    console.log('Send ICE candidate');
    console.log(event.candidate);
    socket.emit('candidate', event.candidate);
  }
}

function onAddIceCandidateSuccess(pc) {
  trace(getName(pc) + ' addIceCandidate success');
}

function onAddIceCandidateError(pc, error) {
  trace(getName(pc) + ' failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(pc, event) {
  if (pc) {
    trace(getName(pc) + ' ICE state: ' + pc.iceConnectionState);
    console.log('ICE state change event: ', event);
  }
}

function hangup() {
  trace('Ending call');
  pc1.close();
  pc1 = null;
  start();
}

if (localStorage.getItem("myfunction"+room) == "offer"){
  setTimeout(function(){ 
    call();}
    , 3000
  );
}

var socket = io.connect();

socket.on('connect', function(connection){
  socket.emit('create or join',room);
  console.log('Room: ' + room);
  setTimeout(function(){ 
    localStream.getTracks().forEach(
      function(track) {
        console.log(track);
        pc1.addTrack(
          track,
          localStream
        );
      }
    );
  }, 2000);
});

socket.on('ready', function(_socket){
  if (_socket.id != socket.id) {
    console.log('ready received');
    setTimeout(function(){ 
      localStorage.setItem("myfunction"+room, "offer");
      call(); 
    }, 5000);
  }
});

socket.on('call', function(message) {
  console.log('call received: ' + message);
});

socket.on('offer', function(message){
  if (message) {
    console.log('offer received');
    console.log(message);
    pc1.setRemoteDescription(new RTCSessionDescription(message), function() {},logError);
    pc1.createAnswer(onLocalSessionCreated, logError);
    pc1.ontrack = gotRemoteStream;
  }
});

socket.on('candidate', function(message){
  if (message) {
    console.log('candidate received');
    console.log(message);
    pc1.addIceCandidate(new RTCIceCandidate({
      sdpMLineIndex: message.sdpMLineIndex,
      candidate: message.candidate})
    );
  }
});

socket.on('answer', function(message){
  if (message) {
    console.log('answer received');
    console.log(message);
    pc1.setRemoteDescription(new RTCSessionDescription(message), function() {},logError);
    pc1.ontrack = gotRemoteStream;
  }
});