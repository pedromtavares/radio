var icecast = require("icecast"),
    request = require('request');
    
function Streamer(app, radio, decoder, provider){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.app = app;
  self.settings = app.settings.server;
  self.radio = radio;
  self.decoder = decoder;
  self.provider = provider;
  self.init();
}

Streamer.prototype.init = function(){
  var self = this;
  self.createStream();
  setInterval(function(){self.serverHeartbeat()}, 1 * 10000);
};

Streamer.prototype.createStream = function(){
  var self = this;
  var closeRadio = function(){
    self.radio.close();
    if (self.stream){self.stream.removeAllListeners()}
    clearInterval(self.streamListenersInterval);
    if (!self.provider.started){
      console.log("================================================================ DJ disconnected.");
      self.provider.start();
    }
    setTimeout(function() {
      self.createStream();
    }, self.settings.reconnectTime * 1000);
  }
  icecast.get(self.settings.url, function(res) {
    self.stream = res;
    self.radio.newDJ(res.headers['icy-name'], res.headers['icy-genre']);
    if (self.radio.currentDJ){
      self.decoder.createStreams();
      self.provider.stop();
      console.log("New DJ connected: "+ self.radio.currentDJ);
      self.streamListenersInterval = setInterval(function() {
        self.radio.getStreamListeners(function(streamListeners, websiteListeners){
          console.log("There are "+streamListeners+" stream listeners and "+websiteListeners+" website listeners.");
        });
      }, 60000);
      self.stream.pipe(self.decoder.mp3.decoder);
      self.stream.on('metadata', function(metadata) {
        self.radio.newTrack(icecast.parse(metadata).StreamTitle);
      });
      self.stream.on('end', closeRadio);
    }else{
      closeRadio();
    }
  }).on('error', function() {
      console.log("Radio server not online.")
      setTimeout(function() {closeRadio();}, 10 * 1000);
  });;
};

Streamer.prototype.streamResponse = function(request, response){
  var self = this,
      ip = request.connection.remoteAddress,
      headers = { "Content-Type": "audio/mpeg", "Connection": "close", "Transfer-Encoding": "identity"};

  if (self.radio.listeners.length > self.settings.listenerLimit){
    request.connection.emit('close');
    return;
  }
  
  if (!response.headers){
    response.writeHead(200, headers);
  }
  
  self.decoder.addClient(request, response);

  request.connection.on("close", function(){
    self.decoder.removeClient(ip);
  });
};

Streamer.prototype.serverHeartbeat = function(){
  var self = this;  
  var data =  {
                track: self.radio.currentTrack || self.provider.currentSong, 
                dj: self.radio.currentDJ, 
                show: self.radio.currentShow,
                listeners: self.radio.listeners.length + self.radio.streamListeners,
                playlist: self.provider.currentPlaylist,
                token: self.app.settings.server.keys.token
              }
  request.post(
      self.app.settings.server.siteUrl + '/heartbeat',
      { form: data},
      function (error, response, body) {}
  );
}

module.exports = Streamer;