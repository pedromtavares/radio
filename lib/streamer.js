var icecast = require("icecast");
    
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
  process.addListener('uncaughtException', function (err, stack) {
    console.log('------------------------');
    console.log('Exception: ' + err);
    console.log(err.stack);
    console.log('------------------------');
    self.init();
  });
  self.init();
}

Streamer.prototype.init = function(){
  var self = this;
  self.createStream();
};

Streamer.prototype.createStream = function(){
  var self = this;
    
  icecast.get(self.settings.url, function(res) {
    self.stream = res;
    self.radio.newDJ(res.headers['icy-name']);
    if (self.radio.currentDJ){
      self.decoder.createStreams();
      self.provider.stop();
      console.log("New DJ connected: "+ self.radio.currentDJ);
      self.streamListenersInterval = setInterval(function() {
        self.radio.getStreamListeners(function(streamListeners, websiteListeners){
          console.log("There are "+streamListeners+" stream listeners and "+websiteListeners+" website listeners.");
        });
      }, 60000);

      self.stream.on('data', function(data) {
        self.decoder.mp3.decoder.write(data);
      });
    }


    self.stream.on('metadata', function(metadata) {
      var title = icecast.parse(metadata).StreamTitle;
      self.radio.newTrack(title);
      console.log("New track: " + self.radio.currentTrack);
    });

    self.stream.on('end', function() {
      self.radio.close();
      self.stream.removeAllListeners();
      clearInterval(self.streamListenersInterval);
      if (!self.provider.started){
        console.log("================================================================ DJ disconnected. Turning on Automatic DJ.");
        self.provider.start();
      }
      setTimeout(function() {
        self.createStream();
      }, self.settings.reconnectTime * 1000);
    });

  });
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

module.exports = Streamer;