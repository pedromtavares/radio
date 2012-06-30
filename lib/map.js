var http = require('http');

function Map(chat, radio, pubSub){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.chat = chat;
  self.radio = radio;
  self.pubSub = pubSub;
};

Map.prototype.publishMessage = function(message){
  var self = this;
  var msg = {
    channels: ['map'],
    data: message
  }
  self.pubSub.publish('juggernaut', JSON.stringify(msg));
}

Map.prototype.ipToPosition = function (ip, callback) {
  var self = this;
  //var url = "http://geoip.peepcode.com/geoip/api/locate.json?ip="+ip;
  var url = "http://freegeoip.net/json/"+ip;
  var client = http.get(url, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {
     var json = JSON.parse(body);
     if (json && json.latitude && json.longitude) {
       callback(json.latitude, json.longitude, json.city);
     };
   });
  });
}

Map.prototype.publish = function(ip){
  var self = this;
  
  var listener = self.radio.getListener(ip);
  if (!listener){
    listener = {};
  }
  var chatUser = self.chat.getChatUser('ip', ip);
  if (chatUser){
    listener.name = chatUser.name;
  }
  
  if (!listener.latitude || !listener.longitude || !listener.city){
    self.ipToPosition(ip, function(latitude, longitude, city) {
      listener.latitude = latitude;
      listener.longitude = longitude;
      listener.city = city;
      listener.ip = ip;
      self.radio.setListener(listener);
      self.publishMessage(listener);
    });
  }else{
    self.publishMessage(listener);
  }
  
}

Map.prototype.allLocations = function(){
  var self = this;
  var locations = [];
  if (self.radio.listeners.length != 0){
    self.radio.listeners.forEach(function(listener) {
      if (listener){
        var chatUser = self.chat.getChatUser('ip', listener.ip);
        var name = null;
        if (chatUser){
          name = chatUser.name;
        }
        locations.push({city: listener.city, latitude: listener.latitude, longitude: listener.longitude, name: name});
        //locations.push({city: "João Pessoa", latitude: -7.11670017242432, longitude: -34.86669921875, name: 'Pedoca'});
      }
    });
  }
  return locations;
}

module.exports = Map;