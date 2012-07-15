var icecast = require("icecast-stack");
    
function Streamer(app, radio, chat, decoder, map, provider){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.app = app;
  self.settings = app.settings.server;
  self.radio = radio;
  self.chat = chat;
  self.decoder = decoder;
  self.map = map;
  self.provider = provider;
  self.init();
};

Streamer.prototype.init = function(){
  var self = this;
  self.provider.start();
  //self.createStream();
};

Streamer.prototype.createStream = function(){
  var self = this;
  
  self.stream = require('radio-stream').createReadStream(self.settings.url);
  
  self.stream.on("connect", function() {
    self.radio.newDJ(self.stream.headers['icy-name']);
    if (self.radio.currentDJ){
      console.log("New DJ connected: "+ self.radio.currentDJ);
      self.radio.reloadClients();
      self.streamListenersInterval = setInterval(function() {
        self.radio.getStreamListeners(function(streamListeners, websiteListeners){
          console.log("There are "+streamListeners+" stream listeners and "+websiteListeners+" website listeners.");
        });
      }, 60000)
    }
    if (self.app.settings.env && self.app.settings.env != 'production'){
      var jp = '187.64.106.223';
      self.radio.addListener(jp);
      self.map.publish(jp);
      var rj = '189.4.196.179';
      self.radio.addListener(rj);
      self.map.publish(rj);
    }
  });
  
  self.stream.on("data", function(chunk) {
    self.decoder.pcm.stdin.write(chunk);
  });

  self.stream.on("metadata", function(metadata) {
    var title = icecast.parseMetadata(metadata).StreamTitle;
    self.radio.newTrack(title);
    console.log("New track: " + self.radio.currentTrack);
  });

  self.stream.on('close', function() {
    self.radio.close();
    self.chat.chatUsers = [];
    self.stream.removeAllListeners();
    clearInterval(self.streamListenersInterval);
    setTimeout(function() {
      self.createStream();
    }, self.settings.reconnectTime * 1000);
  });
};

Streamer.prototype.streamResponse = function(request, response){
  var self = this
  ,   ip = request.connection.remoteAddress
  ,   headers = { "Content-Type": "audio/mpeg", "Connection": "close", "Transfer-Encoding": "identity"}
  ,   acceptsMetadata = request.headers['icy-metadata'] == 1;

  if (self.radio.listeners.length > self.settings.listenerLimit){
    request.connection.emit('close');
    return;
  }
    
  self.radio.publishTrack({track:self.radio.currentTrack, dj: self.radio.currentDJ});
  self.map.publish(ip);
  
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
  
  self.decoder.addClient(request, response);

  var onClose = function(){
    self.decoder.removeClient(ip);
    if (metadataCallback) {
      self.stream.removeListener('metadata', metadataCallback);
    }
  }  
  request.connection.on("close", onClose);  
}



module.exports = Streamer;