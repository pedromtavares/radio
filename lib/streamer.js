var icecast = require("icecast-stack"),
    Track = require('../models/track');
    
function Streamer(settings, radio, chat, decoder){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.settings = settings;
  self.radio = radio;
  self.chat = chat;
  self.decoder = decoder;
  self.init();
};

Streamer.prototype.init = function(){
  var self = this;  
  self.connectToStream();
};

Streamer.prototype.connectToStream = function(){
  var self = this;
  self.stream = require('radio-stream').createReadStream(self.settings.url);
  self.registerStreamListeners();
}

Streamer.prototype.registerStreamListeners = function(){
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
    var result = Track.parseTitle(self.radio.currentTrack);
    Track.findOne(result, function(err, track) {
      var now = new Date();
      if (!track){
        track = new Track(result);
      } else{
        // avoid multiple playings in a short time.
        var interval = 60 * 60 * 1000 // 1 hour
        var lastPlay = track.plays.pop();
        if (lastPlay && lastPlay.created_at){
          var limit = new Date(interval + lastPlay.created_at.getTime());
          if (limit > now){
            return;
          }
          track.plays.push(lastPlay);
        }
      }
      track.plays.push({dj: self.radio.currentDJ});
      track.updated_at = now;
      track.save(function (err) {}); 
    });
    console.log("Received 'metadata' event: " + self.radio.currentTrack);
  });

  self.stream.on('close', function() {
    self.radio.currentDJ = false;
    self.radio.listeners = [];
    self.chat.chatUsers = [];
    self.radio.publishTrack({track:'offline'});
    console.log("Connection was closed! Reconnecting in "+self.settings.reconnectTime+" seconds.");
    self.stream.removeAllListeners();
    // Tries to reconnect to the stream.
    setTimeout(function() {
      self.connectToStream();
    }, self.settings.reconnectTime * 1000);
  });
};

Streamer.prototype.streamResponse = function(request, response, format){
  var self = this;
  
  if (!self.radio.currentDJ){
    request.connection.emit('close');
  }
  
  self.radio.publishTrack({track:self.radio.currentTrack});

  var headers = {
    "Content-Type": self.decoder.getContentType(format),
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
  
  var encoder = self.decoder.getEncoder(format, request, response);
  
  var callback = function(data){
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

module.exports = Streamer;