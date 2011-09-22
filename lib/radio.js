var OAuth = require('oauth').OAuth
,   fs = require('fs');


function Radio(bayeux){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.bayeux = bayeux;
  self.init();
};

Radio.prototype.init = function(){
  var self = this;
  
  self.currentDJ = false;
  self.currentTrack = false;
  self.listeners = [];
  self.lastLength = false;
  self.twitterInterval = 30 * 60 * 1000 // 30 minutes
  //self.twitterInterval = 5 * 1000 // 5 secs
  self.canTweet = false;

};

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

Radio.prototype.updateTwitter = function(newDJ){
  var self = this;
  if (!self.currentDJ || !self.currentTrack){
    return false;
  }
  if (newDJ){
    self.tweet("DJ " + self.currentDJ + " assumindo o comando agora ao som de " + self.currentTrack + ". Acessem! http://radiodagalere.com")
    self.canTweet = false;
    setTimeout(function() {
      self.canTweet = true;
    }, self.twitterInterval);
  }else{
    if (self.canTweet){
      self.tweet("No ar: " + self.currentTrack + " ao comando do DJ "+self.currentDJ+". Acessem! http://radiodagalere.com")
    }
  }
}

Radio.prototype.tweet = function(message){
  var self = this;
  var keys = JSON.parse(fs.readFileSync(process.cwd()+'/config/keys.json', encoding='utf8'));
  var errorCallback = function(error, data) {
    if(error){
      console.log(require('sys').inspect(error));
    } 
    else{
      console.log("Tweeted: "+message);
    }  
  };
  
  oAuth = new OAuth("https://api.twitter.com/oauth/request_token", "https://api.twitter.com/oauth/access_token", keys.consumerToken,  keys.consumerSecret, "1.0A", null, "HMAC-SHA1");
  if (message != ""){
    oAuth.post("http://api.twitter.com/1/statuses/update.json", keys.accessToken, keys.accessSecret, {"status":message}, errorCallback);
  }       
}




module.exports = Radio;