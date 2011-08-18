var http = require("http"),
    icecast = require("icecast-stack"),
    nodeStatic = require('node-static'),
    faye = require('faye'),
    Decoder = require('./decoder');

function Radio(settings){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.settings = settings;
  self.init();
};

Radio.prototype.init = function(){
  var self = this;
  
  self.decoder = new Decoder();
  self.bayeux = self.createBayeuxServer();
  self.httpServer = self.createHttpServer();
  
  self.bayeux.attach(self.httpServer);
  
  self.currentDJ = false;
  self.currentTrack = false;
  
  self.connectToStream();
  self.httpServer.listen(self.settings.port, self.settings.host);
  console.log('Server started on  PORT ' + self.settings.port);
  // after reserving priviled port, set process to run on a less privileged user
  if (self.settings.host){
    process.setgid(50);
    process.setuid(1000); 
    console.log("Process now running under user: " + process.getuid());
  }

};

Radio.prototype.connectToStream = function(){
  var self = this;
  self.stream = require('radio-stream').createReadStream(self.settings.url);
  self.registerListeners();
}

Radio.prototype.publish = function(track){
  var self = this;
  if (!self.currentDJ){
    track = 'offline';
  }
  self.bayeux.getClient().publish('/track', {
    track: track
  });
};

Radio.prototype.registerListeners = function(){
  var self = this;
  
  self.stream.on("connect", function() {
    self.currentDJ = self.stream.headers['icy-name'];
    if (self.currentDJ){
      console.log("Stream successfully connected!");
    }
  });
  
  self.stream.on("data", function(chunk) {
    self.decoder.pcm.stdin.write(chunk);
  });

  self.stream.on("metadata", function(metadata) {
    self.currentTrack = icecast.parseMetadata(metadata).StreamTitle;
    self.publish(self.currentTrack);
    console.log("Received 'metadata' event: " + self.currentTrack);
  });

  self.stream.on('close', function() {
    self.currentDJ = false;
    self.publish('offline');
    console.log("Connection was closed! Reconnecting in "+self.settings.reconnectTime+" seconds.");
    self.stream.removeAllListeners();
    // Tries to reconnect to the stream.
    setTimeout(function() {
      self.connectToStream();
    }, self.settings.reconnectTime * 1000);
  });
};

Radio.prototype.createBayeuxServer = function(){
  var self = this;
  var bayeux = new faye.NodeAdapter({
    mount: '/faye',
    timeout: 45
  });
  return bayeux;
}

Radio.prototype.plainResponse = function(response, data){
  var self = this;
  response.writeHead(200, {'Content-Type': 'text/plain'})
  response.end(data);
}

Radio.prototype.streamResponse = function(request, response, format){
  var self = this;
  var contentType, callback, encoder;
  switch(format){
    case 'mp3':
      contentType = "audio/mpeg";
      encoder = self.decoder.createMp3Encoder(response);
      break;
    case 'ogg':
      contentType = "application/ogg";
      encoder = self.decoder.createOggEncoder(response);
      break;
  }

  
  self.publish(self.currentTrack);
  if (!self.currentDJ){
    request.connection.emit('close');
  }

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
    response.queueMetadata(self.currentTrack);
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

Radio.prototype.createHttpServer = function(){
  var self = this;
  
  var server = http.createServer(function(request, response) {
    if (request.url == "/stream.mp3") {
      self.streamResponse(request, response, 'mp3');
    } else if (request.url == "/stream.ogg") {
      self.streamResponse(request, response, 'ogg');
    } else if (request.url == "/track") {
      self.plainResponse(response, self.currentTrack ? self.currentTrack : "");
    } else if (request.url == "/dj"){
      self.plainResponse(response, self.currentDJ ? self.currentDJ : "");
    } else if (request.url == "/config"){
      response.writeHead(200, {'Content-Type' : 'application/x-javascript'});
      response.end(JSON.stringify({port: self.settings.port}))
    } else {
        var file = new nodeStatic.Server('./public', {cache: false});
        file.serve(request, response);
    }
  });
  return server; 
}

module.exports = Radio;