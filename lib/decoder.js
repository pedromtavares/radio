var spawn = require("child_process").spawn;

function Decoder(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
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

Decoder.prototype.createEncoders = function(response){
  var self = this;
  if (!self.mp3){
    self.mp3 = spawn("lame", [
      "-S", // Operate silently (nothing to stderr)
      "-r", // Input is raw PCM
      "-s", "44,1", // Input sampling rate: 44,100
      "-", // Input from stdin
      "-" // Output to stderr
    ]);
    self.mp3.on("exit", function(exitCode) {
      console.error("mp3.onExit: "+ exitCode);
    });
    self.mp3.on("error", function(error) {
      console.error("mp3.onError: ", error);
    });
    self.mp3.stdin.on("error", function(error) {
      console.error("mp3.stdin.onError: ", error);
    });
    self.mp3.stdout.on("error", function(error) {
      console.error("mp3.stdout.onError: ", error);
    });
    self.mp3.stdout.on("data", function(chunk) {
      response.write(chunk);
    });
  }
  if (!self.ogg){
    self.ogg = spawn("oggenc", [
      "--silent", // Operate silently (nothing to stderr)
      "-r", // Raw input
      "--ignorelength", // Ignore length
      "--raw-rate=44100", // Raw input rate: 44,100
      "-" // Input from stdin, Output to stderr
    ]);
    self.ogg.on("exit", function(exitCode) {
      console.error("ogg.onExit: "+ exitCode);
    });
    self.ogg.on("error", function(error) {
      console.error(error);
    });
    self.ogg.stdin.on("error", function(error) {
      console.error("ogg.stdin.onError: ", error);
    });
    self.ogg.stdout.on("error", function(error) {
      console.error("ogg.stdout.onError: ", error);
    });
    self.ogg.stdout.on("data", function(chunk) {
      response.write(chunk);
    });
  }

}

Decoder.prototype.encodeMp3 = function(response, callback){
  var self = this;
  
  self.sendData(self.mp3, callback);
  
  return self.mp3;
}

Decoder.prototype.encodeOgg = function(response, callback){
  var self = this;

  self.sendData(self.ogg, callback);
  
  return self.ogg;
}


module.exports = Decoder;