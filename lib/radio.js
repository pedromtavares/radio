var OAuth = require('oauth').OAuth
,   Track = require('../models/track');


function Radio(bayeux, app){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.bayeux = bayeux;
  self.app = app;
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
    for(var listener in self.listeners){
      if(self.listeners[listener] && self.listeners[listener].ip == ip){
        return self.listeners[listener];
      }
    }
  }
  return false;
}

Radio.prototype.addListener = function(ip){
  var self = this;
  if (self.getListener(ip)){
    return;
  }
  self.listeners.push({ip: ip});
}

Radio.prototype.removeListener = function(ip){
  var self = this;
  var listener = self.getListener(ip);
  var index = self.listeners.indexOf(listener);
  if (index != -1){
    self.listeners.splice(index, 1);
  }
}

Radio.prototype.publishTrack = function(message){
  var self = this;
  if (!self.currentDJ){
    message.track = 'offline';
  }
  self.bayeux.getClient().publish('/radio', message);
};

Radio.prototype.publishListenersLength = function(){
  var self = this;
  var message = {};
  var length = self.listeners.length;
  if (!self.lastLength || self.lastLength != length){
    self.lastLength = length;
    message.listeners = length;
    self.bayeux.getClient().publish('/radio', message);
  }
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