var spawn = require("child_process").spawn,
    lame = require('lame'),
    Parser = require('lame/lib/parser')

function Decoder(radio, multipleDecoders){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.radio = radio;
  self.init(multipleDecoders);
}

Decoder.prototype.init = function(multipleDecoders){
  var self = this;
  
  self.pcm = self.createRawStream();
  if (!multipleDecoders){
    self.mp3 = self.createMp3Encoder();
  }
  
  // A simple "Burst-on-Connect" implementation. We'll store the previous 2mb
  // of raw PCM data, and send it each time a new connection is made.
  self.bocData = [];
  self.bocSize = 2097152; // 2mb in bytes
  
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
    if (self.mp3 && self.mp3.encoder){
      //console.log("Into the encoder: " + chunk.length);
      self.mp3.encoder.write(chunk);
      //self.mp3.encoder.stdin.write(chunk);
    }else{
      while (self.currentBocSize() > self.bocSize) {
        self.bocData.shift();
      }
      self.bocData.push(chunk);
    }
  });
  
  return pcm;
}

Decoder.prototype.createMp3Encoder = function(request, response){
  var self = this;
  var mp3 = {};
  
  if (request && response){
    mp3.stream = spawn("lame", [
        "-S", // Operate silently (nothing to stderr)
        "-r", // Input is raw PCM
        "-s", "44,1", // Input sampling rate: 44,100
        "-", // Input from stdin
        "-" // Output to stderr
      ]);
    mp3.stream.on("exit", function(exitCode) {
      self.radio.removeListener(request.connection.remoteAddress);
    });
    mp3.stream.on("error", function(error) {});
    mp3.stream.stdin.on("error", function(error) {});
    mp3.stream.stdout.on("error", function(error) {});
    mp3.stream.stdout.on("data", function(chunk) {
      self.radio.addListener(request.connection.remoteAddress);
      response.write(chunk);
    });
  }else{
    mp3.clients = []; // {response: res, ip: ip}
    mp3.encoder = lame.createEncoder();
    //mp3.encoder = spawn("lame", ["-S","-r","-s", "44,1","-","-"]);
    mp3.parser = new Parser();
    mp3.encoder.pipe(mp3.parser);
    //mp3.encoder.stdout.on("data", function(chunk) {mp3.parser.write(chunk)});
    mp3.parser.on('header', function (chunk, meta) {
      //console.log("Out of encoder, into parser (header): "+ chunk.length);
      self.sendData(mp3, chunk, null, meta);
    });
    mp3.parser.on('frame', function (chunk) {
      //console.log("Out of encoder, into parser (frame): "+ chunk.length);
      self.sendData(mp3, chunk);
    });
  }
  return mp3;
}

Decoder.prototype.createOggEncoder = function(request, response){
  var self = this;
  var ogg = {};
  ogg.clients = [];
  ogg.stream = spawn("oggenc", [
    "--silent", // Operate silently (nothing to stderr)
    "-r", // Raw input
    "--ignorelength", // Ignore length
    "--raw-rate=44100", // Raw input rate: 44,100
    "-" // Input from stdin, Output to stderr
  ]);
  ogg.stream.on("exit", function(exitCode) {
    self.radio.removeListener(request.connection.remoteAddress);
  });
  ogg.stream.on("error", function(error) {});
  ogg.stream.stdin.on("error", function(error) {});
  ogg.stream.stdout.on("error", function(error) {});
  ogg.stream.stdout.on("data", function(chunk) {
    self.radio.addListener(request.connection.remoteAddress);
    response.write(chunk);
  });
  return ogg;
}

Decoder.prototype.currentBocSize = function(){
  var self = this,
      size = 0, 
      i = 0, 
      length = self.bocData.length;
      
  for (; i<length; i++) {
    size += self.bocData[i].length;
  }
  return size;
};

Decoder.prototype.sendData = function(encoder, chunk, callback, meta){
  var self = this;
  if (callback){
    for (var i=0, l=self.bocData.length; i<l; i++) {
      encoder.stream.stdin.write(self.bocData[i]);
    }
    self.pcm.stdout.on("data", callback);
  }else{
    if (encoder.clients.length > 0){
      encoder.clients.forEach(function(client) {
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
  }
}

Decoder.prototype.getContentType = function(format){
  var self = this;
  switch(format){
    case 'mp3':
      return "audio/mpeg";
    case 'ogg':
      return "application/ogg";
  }
}

Decoder.prototype.getDecoder = function(format){
  var self = this;
  switch(format){
    case 'mp3':
      return self.mp3;
    case 'ogg':
      return self.ogg;
  }
}

Decoder.prototype.addClient = function(format, request, response){
  var self = this;
  var ip = request.connection.remoteAddress;
  var decoder = self.getDecoder(format);
  decoder.clients.push({response: response, ip: ip, boc: true, headers: 0, frames: 0});
  self.radio.addListener(ip);
}

Decoder.prototype.removeClient = function(format, ip){
  var self = this;
  var decoder = self.getDecoder(format);
  if (decoder && decoder.clients && decoder.clients.length != 0){
    decoder.clients.forEach(function(client) {
      if (client && client.ip == ip){
        self.radio.removeListener(ip);
        var index = decoder.clients.indexOf(client);
        if (index != -1){
          decoder.clients.splice(index, 1);
          return true;
        }
      }
    });
  }
  
  return false;
}

Decoder.prototype.spawnEncoder = function(format, request, response){
  var self = this;
    switch(format){
      case 'mp3':
        return self.createMp3Encoder(request, response);
      case 'ogg':
        return self.createOggEncoder(request, response);
    }
}

module.exports = Decoder;