var http = require("http"),
    icecast = require("icecast-stack"),
    nodeStatic = require('node-static'),
    faye = require('faye'),
    url = require('url'),
    Radio = require('./radio'),
    Decoder = require('./decoder'),
    Chat = require('./chat');

function Server(settings){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.settings = settings;
  self.init();
};

Server.prototype.init = function(){
  var self = this;
  
  self.bayeux = self.createBayeuxServer();
  self.httpServer = self.createHttpServer();
  self.bayeux.attach(self.httpServer);
  
  self.radio = new Radio(self)
  self.chat = new Chat(self);
  self.decoder = new Decoder(self);
  
  self.connectToStream();
  self.httpServer.listen(self.settings.port, self.settings.host);
  console.log('Server started on port ' + self.settings.port);
  // after reserving priviled port, set process to run on a less privileged user
  if (self.settings.host){
    process.setgid(50);
    process.setuid(1000); 
    console.log("Process now running under user: " + process.getuid());
  }

};

Server.prototype.createBayeuxServer = function(){
  var self = this;
  var bayeux = new faye.NodeAdapter({
    mount: '/faye',
    timeout: 45
  });
  return bayeux;
}

Server.prototype.connectToStream = function(){
  var self = this;
  self.stream = require('radio-stream').createReadStream(self.settings.url);
  self.registerListeners();
}

Server.prototype.registerListeners = function(){
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

Server.prototype.plainResponse = function(response, data){
  var self = this;
  response.writeHead(200, {'Content-Type': 'text/plain'})
  response.end(data);
}

Server.prototype.streamResponse = function(request, response, format){
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

Server.prototype.createHttpServer = function(){
  var self = this;
  
  var server = http.createServer(function(request, response) {
    var location = url.parse(request.url)
    /* Player related */
    if (location.pathname == "/stream.mp3") {
      self.streamResponse(request, response, 'mp3');
    } else if (location.pathname == "/stream.ogg") {
      self.streamResponse(request, response, 'ogg');
    } else if (location.pathname == "/track") {
      self.plainResponse(response, self.radio.currentTrack ? self.radio.currentTrack : "");
    } else if (location.pathname == "/dj"){
      self.plainResponse(response, self.radio.currentDJ ? self.radio.currentDJ : "");
    /* Chat related */
    } else if (location.pathname == "/chat_user"){
      var user = self.chat.getChatUser('ip', request.connection.remoteAddress);
      self.plainResponse(response, user ? user.name : "" );
    } else if (location.pathname == "/register"){
      var success = self.chat.addChatUser(request);
      self.plainResponse(response, success ? 'ok' : 'taken');
    } else if (location.pathname == "/history"){
      response.writeHead(200, {'Content-Type' : 'application/x-javascript'});
      response.end(JSON.stringify(self.chat.chatHistory));
    /* Configs */
    } else if (location.pathname == "/config"){
      response.writeHead(200, {'Content-Type' : 'application/x-javascript'});
      response.end(JSON.stringify({port: self.settings.port}))
    /* Static files */
    } else {
      var file = new nodeStatic.Server('./public', {cache: false});
      file.serve(request, response);
    }
  });
  return server; 
}

Server.prototype.mobileClient = function(request){
  var ua = request.headers['user-agent'].toLowerCase();
	if(/android.+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(ua)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|e\-|e\/|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|xda(\-|2|g)|yas\-|your|zeto|zte\-/i.test(ua.substr(0,4))) {
		return true;
	}
	return false;
}

module.exports = Server;