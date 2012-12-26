var icecast = require("icecast");
    
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
}

Streamer.prototype.init = function(){
  var self = this;
  self.createStream();
  if (self.app.settings.env && self.app.settings.env != 'production'){
    setTimeout(function() {
      var ips = ["200.97.8.95", "187.115.2.7", "189.59.73.181", "201.23.107.11", "187.84.226.147", "187.115.194.88", "201.20.89.11", "189.108.102.138", "189.127.165.233", "187.17.22.6", "187.6.86.3", "201.83.46.188", "187.11.229.55", "201.22.164.199", "187.115.52.40", "201.76.212.250", "187.35.144.173", "200.181.109.20", "186.201.109.10", "187.115.169.122", "187.58.65.6", "201.72.179.130", "189.44.35.106", "189.80.124.82", "187.4.128.10", "189.111.142.128", "187.33.80.178", "200.137.162.77", "189.77.31.84", "189.111.180.217"];
      var jp = '187.64.106.223';
      var rj = '189.4.196.179';
      ips.push(jp);
      ips.push(rj);
      ips.forEach(function(ip) {
        self.radio.addListener(ip);
        self.map.publish(ip);
      });
    }, 5000);

  }
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
      self.radio.reloadClients();
      var hd = new memwatch.HeapDiff();
      self.streamListenersInterval = setInterval(function() {
        self.radio.getStreamListeners(function(streamListeners, websiteListeners){
          console.log("There are "+streamListeners+" stream listeners and "+websiteListeners+" website listeners.");
        });
        console.log(JSON.stringify(hd.end(), null, 2));
        var hd = new memwatch.HeapDiff();
      }, 60000);


      self.stream.pipe(self.decoder.mp3.decoder);
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
        self.provider.reloadClients();
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
      headers = { "Content-Type": "audio/mpeg", "Connection": "close", "Transfer-Encoding": "identity"},
      acceptsMetadata = request.headers['icy-metadata'] == 1;

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

  if (!response.headers){
    response.writeHead(200, headers);
  }

  // if (acceptsMetadata) {
  //   response = new icecast.IcecastWriteStack(response, 10000);
  //   response.queueMetadata(self.radio.currentTrack);
  //   var metadataCallback = function(metadata) {
  //     response.queueMetadata(metadata);
  //   };
  //   self.stream.on('metadata', metadataCallback);
  // }
  
  self.decoder.addClient(request, response);

  request.connection.on("close", function(){
    self.decoder.removeClient(ip);
    // if (metadataCallback) {
    //   self.stream.removeListener('metadata', metadataCallback);
    // }
  });
};

module.exports = Streamer;