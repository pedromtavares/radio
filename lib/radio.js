function Radio(server){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.server = server;
  self.init();
};

Radio.prototype.init = function(){
  var self = this;
  
  self.currentDJ = false;
  self.currentTrack = false;
  self.listeners = [];

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

Radio.prototype.publish = function(message){
  var self = this;
  if (!self.currentDJ){
    message.track = 'offline';
  }
  message.listeners = self.listeners.length;
  self.server.bayeux.getClient().publish('/radio', message);
};




module.exports = Radio;