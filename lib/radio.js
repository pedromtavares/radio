var OAuth = require('oauth').OAuth
,   Track = require('../models/track');


function Radio(app, pubSub){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.app = app;
  self.pubSub = pubSub;
  self.init();
};

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
  if (dj && dj != ""){
    self.currentDJ =  dj.replace('DJ ', '').replace('dj ', '').replace('DJ', '').replace('dj', '');
  }
}

Radio.prototype.newTrack = function(title){
  var self = this;
  self.currentTrack = title;
  self.publishTrack({track: title, dj: self.currentDJ});
  self.updateTwitter();
  var result = Track.parseTitle(title);
  Track.findOne(result, function(err, track) {
    var now = new Date();
    if (!track){
      track = new Track(result);
    } else{
      // avoid multiple playings in a short time.
      var interval = 60 * 60 * 1000 // 1 hour
      var lastPlay = track.plays.pop();
      if (lastPlay && lastPlay.created_at){
        var limit = new Date(interval + lastPlay.created_at.getTime());
        if (limit > now){
          return;
        }
      }
    }
    track.plays.push({dj: self.currentDJ});
    track.updated_at = now;
    track.title = title;
    track.save(function (err) {}); 
  });
}

Radio.prototype.close = function(){
  var self = this;
  self.currentDJ = false;
  self.isNewDJ = true;
  self.listeners = [];
  self.publishTrack({track:'offline'});
}

Radio.prototype.getListener = function(ip){
  var self = this;
  if (self.listeners.length != 0){
    for(var index in self.listeners){
      var listener = self.listeners[index]; 
      if(listener && listener.ip == ip){
        return listener;
      }
    }
  }
  return false;
}

Radio.prototype.setListener = function(listener){
  var self = this;
  var listener = self.getListener(listener.ip);
  if (self.removeListener(listener.ip)){
    self.listeners.push(listener);
  }
}

Radio.prototype.addListener = function(ip){
  var self = this;
  if (self.getListener(ip)){
    return;
  }
  self.listeners.push({ip: ip});
  self.publishListenersLength();
}

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
}

Radio.prototype.publishMessage = function(message){
  var self = this;
  var msg = {
    channels: ['radio'],
    data: message
  }
  self.pubSub.publish('juggernaut', JSON.stringify(msg));
}


Radio.prototype.publishTrack = function(message){
  var self = this;
  if (!self.currentDJ){
    message.track = 'offline';
  }
  self.publishMessage(message);
};

Radio.prototype.publishListenersLength = function(){
  var self = this;
  var message = {};
  var length = self.listeners.length + self.streamListeners;
  if (!self.lastLength || self.lastLength != length){
    self.lastLength = length;
    message.listeners = length;
    self.publishMessage(message);
  }
}

Radio.prototype.getStreamListeners = function(callback){
  var self = this;
  var http = require('http');
  var htmlparser = require("htmlparser");
  var options = {host: self.app.settings.server.streamHost, port: self.app.settings.server.streamPort, path: '/index.html?sid=1', method: 'GET'}
  var request = http.request(options, function(response){
    response.on('data', function(data){
      var rawHtml = data.toString();
      var handler = new htmlparser.DefaultHandler(function (error, dom) {}, {verbose:false,  enforceEmptyTags: true});
      var parser = new htmlparser.Parser(handler);
      parser.parseComplete(rawHtml);
      if (handler.dom[7] && handler.dom[7].children[1]){
        var string = handler.dom[7].children[1].children[1].children[0].children[0].children[0].data
        var index = string.search(/\(.*\)/);
        var listeners = parseInt(string.substr(index+1, 2),10);
        if (listeners > 0){
          listeners -= 1; // one listener is this application itself
        }
        self.streamListeners = listeners;
        console.log("There are "+listeners+" stream listeners and "+self.listeners.length+" website listeners.");
        callback();
      }
    });
  });
  request.write('Hi');
  request.end();
}

Radio.prototype.reloadClients = function(){
  var self = this;
  self.publishMessage({track: 'reload'});
}

Radio.prototype.updateTwitter = function(){
  var self = this;
  if (!self.currentDJ || !self.currentTrack){
    return false;
  }
  if (self.isNewDJ){
    self.tweet("DJ " + self.currentDJ + " assumindo o comando agora ao som de " + self.currentTrack + ". Acessem! http://radiodagalere.com")
    self.isNewDJ = false;
    self.canTweet = false;
    self.setTwitterTimeout();
  }else{
    if (self.canTweet){
      self.tweet("No ar: " + self.currentTrack + " ao comando do DJ "+self.currentDJ+". Acessem! http://radiodagalere.com")
      self.canTweet = false;
      self.setTwitterTimeout();
    }
  }
}

Radio.prototype.setTwitterTimeout = function(){
  var self = this;
  clearTimeout(self.twitterTimeout);
  self.twitterTimeout = setTimeout(function() {
    self.canTweet = true;
  }, self.twitterInterval);
}

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
  if (message != ""){
    oAuth.post("http://api.twitter.com/1/statuses/update.json", keys.accessToken, keys.accessSecret, {"status":message}, errorCallback);
  }       
}

module.exports = Radio;