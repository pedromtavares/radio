var http = require('http');

function Map(bayeux, chat, radio){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.bayeux = bayeux;
  self.chat = chat;
  self.radio = radio;
  self.geoIpServer = {port: 80, hostname: 'geoip.peepcode.com'}
};

Map.prototype.ipToPosition = function (ip, callback) {
  var self = this;
  var client = http.createClient(self.geoIpServer.port, 
                                 self.geoIpServer.hostname);
  var request = client.request('GET', '/geoip/api/locate.json?ip=' + ip, {
    'host': self.geoIpServer.hostname
  });
  request.end();

  request.on('response', function (response) { 
    response.setEncoding('utf8');

    var body = '';
    response.on('data', function (chunk) {
      body += chunk;
    });
    response.on('end', function () {
      var json = JSON.parse(body);

      if (json && json.latitude && json.longitude) {
        callback(json.latitude, json.longitude, json.city);
      }
    });
  });
};

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
      self.radio.setListener(listener);
      self.bayeux.getClient().publish('/map', listener);
    });
  }else{
    self.bayeux.getClient().publish('/map', listener);
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