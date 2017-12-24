'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var https = require('https');
var http = require('http');
var socketIO = require('socket.io');
var fs = require('fs');
var key = fs.readFileSync('encryption/private.key');
var cert = fs.readFileSync( 'encryption/server.crt' );
var options = {
  key: key,
  cert: cert
}

var fileServer = new(nodeStatic.Server)('./public');
// var app = http.createServer(function(req, res) {
//   fileServer.serve(req, res);
// }).listen(8080);

var app2 = https.createServer(options, function(req, res) {
  fileServer.serve(req, res);
}).listen(8443);

// var io = socketIO.listen(app);
var io = socketIO.listen(app2);

io.sockets.on('connection', function(socket) {
  console.log('connected - ' + socket.id);
  
  socket.on('offer', function(message){
    console.log('offer: ' + message);
    socket.broadcast.emit('offer', message);
  });

  socket.on('message', function(message) {
    log('client said: ' + message);
    socket.broadcast.emit('message', message);
  });

  socket.on('call', function(message){
    console.log('call received: ' + message);
    socket.broadcast.emit('call', message);
  });

  socket.on('candidate', function(message){
    console.log('candidate received: ' + message);
    socket.broadcast.emit('candidate', message);
  });

  socket.on('answer', function(message){
    console.log('answer: ' + message);
    socket.broadcast.emit('answer',message);
  });

  socket.on('hungup', function(message){

  });

  socket.on('create or join', function(room) {
    console.log('Received request to create or join room ' + room);
    var numClients = 0;
    try {
      var clientsInRoom = io.nsps['/'].adapter.rooms[room];
      numClients = clientsInRoom === undefined ? 0 : Object.keys(clientsInRoom.sockets).length;
    } catch (e) {
      numClients = 0;
    }
    console.log('Room ' + room + ' now has ' + numClients + ' client(s)');
    if (numClients <= 0 || numClients == undefined) {
      socket.join(room);
      console.log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
      io.sockets.socket(socket.id).emit('function','offer');
    } else if (numClients === 1) {
      socket.join(room);
      console.log('Client ID ' + socket.id + ' joined room ' + room);
      socket.broadcast.emit('ready', socket.id);
    } else {
      console.log('full');
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});
