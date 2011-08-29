var spawn = require("child_process").spawn;

function Decoder(server){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.server = server;
  self.init();
}

Decoder.prototype.init = function(){
  var self = this;
  
  // Decode the MP3 stream to raw PCM data, signed 16-bit Little-endian
  self.pcm = spawn("lame", [
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
  
  
  // A simple "Burst-on-Connect" implementation. We'll store the previous 2mb
  // of raw PCM data, and send it each time a new connection is made.
  self.bocData = [];
  self.bocSize = 2097152; // 2mb in bytes
  
  self.registerListeners();
}

Decoder.prototype.registerListeners = function(){
  var self = this;
  self.pcm.stdout.on("data", function(chunk) {
    while (self.currentBocSize() > self.bocSize) {
      self.bocData.shift();
    }
    self.bocData.push(chunk);
  });
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

Decoder.prototype.sendData = function(source, callback){
  var self = this;
  
  // First, send what's inside the "Burst-on-Connect" buffers.
  for (var i=0, l=self.bocData.length; i<l; i++) {
    source.stdin.write(self.bocData[i]);
  }
  // Then start sending the incoming PCM data to the OGG encoder
  self.pcm.stdout.on("data", callback);
}

Decoder.prototype.createMp3Encoder = function(request, response){
  var self = this;
  
  var mp3 = spawn("lame", [
    "-S", // Operate silently (nothing to stderr)
    "-r", // Input is raw PCM
    "-s", "44,1", // Input sampling rate: 44,100
    "-", // Input from stdin
    "-" // Output to stderr
  ]);
  mp3.on("exit", function(exitCode) {
    self.server.radio.removeListener(request.connection.remoteAddress);
    self.server.radio.publishListenersLength();
    // console.error("mp3.onExit: "+ exitCode);
  });
  mp3.on("error", function(error) {
    // console.error("mp3.onError: ", error);
  });
  mp3.stdin.on("error", function(error) {
    // console.error("mp3.stdin.onError: ", error);
  });
  mp3.stdout.on("error", function(error) {
    // console.error("mp3.stdout.onError: ", error);
  });
  mp3.stdout.on("data", function(chunk) {
    self.server.radio.addListener(request.connection.remoteAddress);
    self.server.radio.publishListenersLength();
    response.write(chunk);
  });
    
  return mp3;
}

Decoder.prototype.createOggEncoder = function(request, response){
  var self = this;
  
  var ogg = spawn("oggenc", [
    "--silent", // Operate silently (nothing to stderr)
    "-r", // Raw input
    "--ignorelength", // Ignore length
    "--raw-rate=44100", // Raw input rate: 44,100
    "-" // Input from stdin, Output to stderr
  ]);
  ogg.on("exit", function(exitCode) {
    self.server.radio.removeListener(request.connection.remoteAddress);
    self.server.radio.publishListenersLength();
    // console.error("ogg.onExit: "+ exitCode);
  });
  ogg.on("error", function(error) {
    // console.error(error);
  });
  ogg.stdin.on("error", function(error) {
    // console.error("ogg.stdin.onError: ", error);
  });
  ogg.stdout.on("error", function(error) {
    // console.error("ogg.stdout.onError: ", error);
  });
  ogg.stdout.on("data", function(chunk) {
    self.server.radio.addListener(request.connection.remoteAddress);
    self.server.radio.publishListenersLength();
    response.write(chunk);
  });
  
  return ogg;
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

Decoder.prototype.getEncoder = function(format, request, response){
  var self = this;
  switch(format){
    case 'mp3':
      return self.createMp3Encoder(request, response);
    case 'ogg':
      return self.createOggEncoder(request, response);
  }
}

module.exports = Decoder;