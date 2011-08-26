var http = require("http"),
    icecast = require("icecast-stack"),
    nodeStatic = require('node-static'),
    faye = require('faye'),
    url = require('url'),
    Radio = require('./radio'),
    Decoder = require('./decoder'),
    Chat = require('./chat');

function Server(settings){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.settings = settings;
  self.init();
};

Server.prototype.init = function(){
  var self = this;
  
  self.bayeux = self.createBayeuxServer();
  self.httpServer = self.createHttpServer();
  self.bayeux.attach(self.httpServer);
  
  self.radio = new Radio(self)
  self.chat = new Chat(self);
  self.decoder = new Decoder(self);
  
  self.connectToStream();
  self.httpServer.listen(self.settings.port, self.settings.host);
  console.log('Server started on port ' + self.settings.port);
  // after reserving priviled port, set process to run on a less privileged user
  if (self.settings.host){
    process.setgid(50);
    process.setuid(1000); 
    console.log("Process now running under user: " + process.getuid());
  }

};

Server.prototype.createBayeuxServer = function(){
  var self = this;
  var bayeux = new faye.NodeAdapter({
    mount: '/faye',
    timeout: 45
  });
  return bayeux;
}

Server.prototype.connectToStream = function(){
  var self = this;
  self.stream = require('radio-stream').createReadStream(self.settings.url);
  self.registerListeners();
}

Server.prototype.registerListeners = function(){
  var self = this;
  
  self.stream.on("connect", function() {
    self.radio.currentDJ = self.stream.headers['icy-name'];
    if (self.radio.currentDJ){
      console.log("Stream successfully connected!");
    }
  });
  
  self.stream.on("data", function(chunk) {
    self.decoder.pcm.stdin.write(chunk);
  });

  self.stream.on("metadata", function(metadata) {
    self.radio.currentTrack = icecast.parseMetadata(metadata).StreamTitle;
    self.radio.publishTrack({track: self.radio.currentTrack});
    console.log("Received 'metadata' event: " + self.radio.currentTrack);
  });

  self.stream.on('close', function() {
    self.radio.currentDJ = false;
    self.radio.listeners = [];
    self.radio.publishTrack({track:'offline'});
    console.log("Connection was closed! Reconnecting in "+self.settings.reconnectTime+" seconds.");
    self.stream.removeAllListeners();
    // Tries to reconnect to the stream.
    setTimeout(function() {
      self.connectToStream();
    }, self.settings.reconnectTime * 1000);
  });
};

Server.prototype.plainResponse = function(response, data){
  var self = this;
  response.writeHead(200, {'Content-Type': 'text/plain'})
  response.end(data);
}

Server.prototype.streamResponse = function(request, response, format){
  var self = this;
  
  if (!self.radio.currentDJ){
    request.connection.emit('close');
  }
  
  var contentType, callback, encoder;
  switch(format){
    case 'mp3':
      contentType = "audio/mpeg";
      encoder = self.decoder.createMp3Encoder(request, response);
      break;
    case 'ogg':
      contentType = "application/ogg";
      encoder = self.decoder.createOggEncoder(request, response);
      break;
  }

  self.radio.publishTrack({track:self.radio.currentTrack});

  var headers = {
    "Content-Type": contentType,
    "Connection": "close",
    "Transfer-Encoding": "identity"
  };
  
  var acceptsMetadata = request.headers['icy-metadata'] == 1;
  
  if (acceptsMetadata) {
    headers['icy-name'] = self.stream.headers['icy-name'];
    headers['icy-metaint'] = 10000;
  }
  response.writeHead(200, headers);

  if (acceptsMetadata) {
    response = new icecast.IcecastWriteStack(response, 10000);
    response.queueMetadata(self.radio.currentTrack);
    var metadataCallback = function(metadata) {
      response.queueMetadata(metadata);
    }
    self.stream.on('metadata', metadataCallback);
  }
  
  callback = function(data){
    encoder.stdin.write(data);
  };
  
  request.connection.on("close", function() {
    self.decoder.pcm.stdout.removeListener("data", callback);
    encoder.kill();
    if (metadataCallback) {
      self.stream.removeListener('metadata', metadataCallback);
    }
  });
  
  self.decoder.sendData(encoder, callback);
  
}

Server.prototype.createHttpServer = function(){
  var self = this;
  
  var server = http.createServer(function(request, response) {
    var location = url.parse(request.url)
    /* Player related */
    if (location.pathname == "/stream.mp3") {
      self.streamResponse(request, response, 'mp3');
    } else if (location.pathname == "/stream.ogg") {
      self.streamResponse(request, response, 'ogg');
    } else if (location.pathname == "/track") {
      self.plainResponse(response, self.radio.currentTrack ? self.radio.currentTrack : "");
    } else if (location.pathname == "/dj"){
      self.plainResponse(response, self.radio.currentDJ ? self.radio.currentDJ : "");
    /* Chat related */
    } else if (location.pathname == "/chat_user"){
      var user = self.chat.getChatUser('ip', request.connection.remoteAddress);
      self.plainResponse(response, user ? user.name : "" );
    } else if (location.pathname == "/register"){
      var success = self.chat.addChatUser(request);
      self.plainResponse(response, success ? 'ok' : 'taken');
    } else if (location.pathname == "/history"){
      response.writeHead(200, {'Content-Type' : 'application/x-javascript'});
      response.end(JSON.stringify(self.chat.chatHistory));
    /* Configs */
    } else if (location.pathname == "/config"){
      response.writeHead(200, {'Content-Type' : 'application/x-javascript'});
      response.end(JSON.stringify({port: self.settings.port}))
    /* Static files */
    } else {
      var file = new nodeStatic.Server('./public', {cache: false});
      file.serve(request, response);
    }
  });
  return server; 
}

module.exports = Server;