var spawn = require("child_process").spawn,
    lame = require('lame'),
    _ = require('../vendor/underscore')._;

function Decoder(app, radio){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.app = app;
  self.radio = radio;
  self.init();
}

Decoder.prototype.init = function(){
  var self = this;
  self.createStreams();
};

Decoder.prototype.createStreams = function() {
  var self = this;
  var clients = [];
  if (self.mp3){
    clients = self.mp3.clients;
  }
  self.mp3 = self.createMp3Streams();
  self.mp3.clients = clients;
};

Decoder.prototype.createMp3Streams = function(){
  var self = this;
  var mp3 = {};
  mp3.clients = []; // {response: res, ip: ip}
  mp3.encoder = lame.Encoder({channels: 2, bitDepth: 16, sampleRate: 44100});
  mp3.encoder.on("data", function(chunk) {
    self.sendData(chunk);
  });
  mp3.decoder = lame.Decoder();
  mp3.decoder.on('format', function(format) {
    mp3.decoder.pipe(mp3.encoder);
  });
  return mp3;
};


Decoder.prototype.sendData = function(chunk){
  var self = this;
  self.mp3.clients.forEach(function(client) {
    self.radio.addListener(client.ip);
    client.response.write(chunk);
  });
};

Decoder.prototype.getClient = function(ip) {
  var self = this;
  return _.find(self.mp3.clients, function(client){ return client.ip == ip; });
};

Decoder.prototype.addClient = function(request, response){
  var self = this;
  var ip = request.connection.remoteAddress;
  if (!self.getClient(ip)){
    self.mp3.clients.push({response: response, ip: ip});
    self.radio.addListener(ip);
  }
};

Decoder.prototype.removeClient = function(ip){
  var self = this;
  self.radio.removeListener(ip);
  self.mp3.clients = _.reject(self.mp3.clients, function(client){ return client.ip == ip; });
};

module.exports = Decoder;