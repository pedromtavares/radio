var icecast = require("icecast-stack");
    
function Streamer(app, radio, chat, decoder, map){
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
    self.radio.newDJ(self.stream.headers['icy-name']);
    if (self.radio.currentDJ){
      console.log("New DJ connected: "+ self.radio.currentDJ);
    }
    if (self.app.settings.env && self.app.settings.env != 'production'){
      self.radio.addListener('187.64.106.223'); //jp
      self.radio.addListener('189.4.196.179'); //rj
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
  var ip = request.connection.remoteAddress;
  
  if (!self.radio.currentDJ){
    request.connection.emit('close');
  }
  
  self.radio.publishTrack({track:self.radio.currentTrack, dj: self.radio.currentDJ});
  self.map.publish(ip);

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
  if (self.fromMobileBrowser(request) || self.settings.multipleDecoders || format == 'ogg'){
    var encoder = self.decoder.spawnEncoder(format, request, response);
    var callback = function(data){
      encoder.stream.stdin.write(data);
    };
    var onClose = function(){
      self.decoder.pcm.stdout.removeListener("data", callback);
      encoder.stream.kill();
      if (metadataCallback) {
        self.stream.removeListener('metadata', metadataCallback);
      }
    }
    self.decoder.sendData(encoder, null, callback);
  }else{
    self.decoder.addClient(format, request, response);
    var onClose = function(){
      self.decoder.removeClient(format, ip);
      if (metadataCallback) {
        self.stream.removeListener('metadata', metadataCallback);
      }
    }
  }
  
  request.connection.on("close", onClose);  
}

Streamer.prototype.fromMobileBrowser = function(request){
  var ua = request.headers['user-agent'].toLowerCase();
	if(/android.+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(ua)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|e\-|e\/|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|xda(\-|2|g)|yas\-|your|zeto|zte\-/i.test(ua.substr(0,4))) {
		return true;
	}else{
	  return false;
	}
}

module.exports = Streamer;