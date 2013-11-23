var OAuth = require('oauth').OAuth,
    request = require('request');


function Radio(app){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.app = app;
  self.init();
}

Radio.prototype.init = function(){
  var self = this;
  self.currentDJ = false;
  self.currentTrack = false;
  self.listeners = [];
  self.lastLength = false;
  self.isNewDJ = true;
  self.twitterInterval = self.app.settings.server.twitterInterval * 1000;
  self.canTweet = false;
  self.streamListeners = 0;
};

Radio.prototype.newDJ = function(dj){
  var self = this;
  if (dj && dj !== ""){
    self.currentDJ =  dj.replace('DJ ', '').replace('dj ', '').replace('DJ', '').replace('dj', '');
  }
};

Radio.prototype.newTrack = function(title){
  var self = this;
  self.currentTrack = title;
  // self.updateTwitter();
  console.log("New track: " + self.currentTrack);
  var data = {track: self.currentTrack, dj: self.currentDJ, token: self.app.settings.server.keys.token}
  request.post(
      self.app.settings.server.siteUrl + '/tracks',
      { form: data},
      function (error, response, body) {}
  );
};

Radio.prototype.close = function(){
  var self = this;
  self.currentDJ = false;
  self.isNewDJ = true;
  self.listeners = [];
  self.currentTrack = false;
};

Radio.prototype.getListener = function(ip){
  var self = this;
  if (self.listeners.length !== 0){
    for(var index in self.listeners){
      var listener = self.listeners[index];
      if(listener && listener.ip == ip){
        return listener;
      }
    }
  }
  return false;
};

Radio.prototype.setListener = function(updatedListener){
  var self = this;
  var listener = self.getListener(updatedListener.ip);
  if (listener.latitude && listener.logitude && listener.city){
    return;
  }
  if (self.removeListener(listener.ip)){
    self.listeners.push(updatedListener);
    self.publishListenersLength();
  }
};

Radio.prototype.addListener = function(ip){
  var self = this;
  if (self.getListener(ip)){
    return false;
  }
  self.listeners.push({ip: ip});
  self.publishListenersLength();
  return true;
};

Radio.prototype.removeListener = function(ip){
  var self = this;
  var listener = self.getListener(ip);
  var index = self.listeners.indexOf(listener);
  if (index != -1){
    self.listeners.splice(index, 1);
    self.publishListenersLength();
    return true;
  }
  return false;
};

Radio.prototype.publishListenersLength = function(){
  var self = this;
  var length = self.listeners.length + self.streamListeners;
  if (!self.lastLength || self.lastLength != length){
    self.lastLength = length;
    request.post(
        self.app.settings.server.siteUrl + '/listeners',
        { form: {listeners: length, token: self.app.settings.server.keys.token}},
        function (error, response, body) {}
    );
  }
};

Radio.prototype.getStreamListeners = function(callback){
  var self = this;
  var http = require('http');
  var htmlparser = require("htmlparser");
  var options = {host: self.app.settings.server.streamHost, port: self.app.settings.server.streamPort, path: '/index.html?sid=1'};
  var request = http.get(options, function(response){
    var rawHtml = '';
    response.on('data', function(data){
      rawHtml += data.toString();
    });
    response.on('end', function() {
      var handler = new htmlparser.DefaultHandler(function (error, dom) {}, {verbose:false,  enforceEmptyTags: true});
      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(rawHtml);
      // yes, this is a major copy and paste, seriously not worth the time to debug this crap
      if (handler.dom[0] && handler.dom[0].children[1] && handler.dom[0].children[1].children[0] && handler.dom[0].children[1].children[0].children[4] && handler.dom[0].children[1].children[0].children[4].children[1] && handler.dom[0].children[1].children[0].children[4].children[1].children[1] && handler.dom[0].children[1].children[0].children[4].children[1].children[1].children[0] && handler.dom[0].children[1].children[0].children[4].children[1].children[1].children[0].children[0] && handler.dom[0].children[1].children[0].children[4].children[1].children[1].children[0].children[0].children[0]){
        var string = handler.dom[0].children[1].children[0].children[4].children[1].children[1].children[0].children[0].children[0].data;
        var index = string.search(/\(.*\)/);
        var listeners = parseInt(string.substr(index+1, 2),10);
        if (listeners > 0){
          listeners -= 1; // one listener is this application itself
        }
        self.streamListeners = listeners;
        callback(listeners,  self.listeners.length);
      }
    });
  });
};

Radio.prototype.updateTwitter = function(){
  var self = this;
  if (!self.currentDJ || !self.currentTrack){
    return false;
  }
  if (self.isNewDJ){
    self.tweet("DJ " + self.currentDJ + " assumindo o comando agora ao som de " + self.currentTrack + ". Acessem! http://radiodagalere.com");
    self.isNewDJ = false;
    self.canTweet = false;
    self.setTwitterTimeout();
  }else{
    if (self.canTweet){
      self.tweet("No ar: " + self.currentTrack + " ao comando do DJ "+self.currentDJ+". Acessem! http://radiodagalere.com");
      self.canTweet = false;
      self.setTwitterTimeout();
    }
  }
};

Radio.prototype.setTwitterTimeout = function(){
  var self = this;
  clearTimeout(self.twitterTimeout);
  self.twitterTimeout = setTimeout(function() {
    self.canTweet = true;
  }, self.twitterInterval);
};

Radio.prototype.tweet = function(message){
  var self = this;
  if (self.app.settings.env == 'development'){
    console.log("Tweeted: "+message);
    return;
  }
  var errorCallback = function(error, data) {
    if(error){
      console.log(require('sys').inspect(error));
    }
    else{
      console.log("Tweeted: "+message);
    }
  };
  var keys = self.app.settings.server.keys;
  oAuth = new OAuth("https://api.twitter.com/oauth/request_token", "https://api.twitter.com/oauth/access_token", keys.consumerToken,  keys.consumerSecret, "1.0A", null, "HMAC-SHA1");
  if (message !== ""){
    oAuth.post("http://api.twitter.com/1/statuses/update.json", keys.accessToken, keys.accessSecret, {"status":message}, errorCallback);
  }
};

module.exports = Radio;