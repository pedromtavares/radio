var spawn = require("child_process").spawn,
    lame = require('lame'),
    Parser = require('lame/lib/parser')

function Decoder(radio){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.radio = radio;
  self.init();
}

Decoder.prototype.init = function(){
  var self = this;
  
  self.pcm = self.createRawStream();
  self.mp3 = self.createMp3Encoder();
}

Decoder.prototype.createRawStream = function(){
  var self = this;
  // Decode the MP3 stream to raw PCM data, signed 16-bit Little-endian
  var pcm = spawn("lame", [
    "-S", // Operate silently (nothing to stderr)
    "--mp3input", // Decode the MP3 input
    "-", // Input from stdin
    "--decode",
    "-t", // Don't include WAV header info (i.e. output raw PCM)
    "-s", "44,1", // Sampling rate: 44,100
    "--bitwidth", "16", // Bits per Sample: 16
    "--signed", "--little-endian", // Signed, little-endian samples
    "-" // Output to stdout
  ]);
  
  pcm.stdout.on("data", function(chunk) {
    //console.log("Into the encoder: " + chunk.length);
    //self.mp3.encoder.write(chunk);
    self.mp3.encoder.stdin.write(chunk);
  });
  
  pcm.stdout.on('error', function() {
    self.init();
  });
  
  pcm.stdin.on('error', function() {
    self.init();
  });
  
  return pcm;
}

Decoder.prototype.createMp3Encoder = function(){
  var self = this;
  var mp3 = {};
  mp3.clients = []; // {response: res, ip: ip}
  //mp3.encoder = lame.createEncoder();
  mp3.encoder = spawn("lame", ["-S","-r","-s", "44,1","-","-"]);
  mp3.parser = Parser.createParser();
  //mp3.encoder.pipe(mp3.parser);
  mp3.encoder.stdout.on("data", function(chunk) {mp3.parser.write(chunk)});
  mp3.parser.on('header', function (chunk, meta) {
    //console.log("Out of encoder, into parser (header): "+ chunk.length);
    self.sendData(chunk, meta);
  });
  mp3.parser.on('frame', function (chunk) {
    //console.log("Out of encoder, into parser (frame): "+ chunk.length);
    self.sendData(chunk);
  });
  return mp3;
}


Decoder.prototype.sendData = function(chunk, meta){
  var self = this;
  self.mp3.clients.forEach(function(client) {
    self.radio.addListener(client.ip);
    // Only send frames case the headers count is greater than the frames count to avoid frames with no headers
    if (!meta){
      if (client.headers > client.frames){
        client.response.write(chunk);
        client.frames += 1;
      }
    }else{
      client.headers += 1;
      client.response.write(chunk);
    }
  });
}

Decoder.prototype.addClient = function(request, response){
  var self = this;
  var ip = request.connection.remoteAddress;
  self.mp3.clients.push({response: response, ip: ip, boc: true, headers: 0, frames: 0});
  self.radio.addListener(ip);
}

Decoder.prototype.removeClient = function(format, ip){
  var self = this;
  if (self.mp3.clients.length != 0){
    self.mp3.clients.forEach(function(client) {
      if (client && client.ip == ip){
        self.radio.removeListener(ip);
        var index = self.mp3.clients.indexOf(client);
        if (index != -1){
          self.mp3.clients.splice(index, 1);
          return true;
        }
      }
    });
  }
  
  return false;
}


Decoder.prototype.respawnRawStream = function() {
  var self = this;
  self.pcm.kill();
  self.pcm = self.createRawStream();
};

module.exports = Decoder;