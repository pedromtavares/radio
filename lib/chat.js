var url = require('url');

function Chat(bayeux){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  self.bayeux = bayeux;
  self.init();
};

Chat.prototype.init = function(){
  var self = this;
  
  self.chatHistory = [];
  self.chatUsers = [];
  
  self.bayeux.getClient().subscribe('/broadchat', function(message) {
    self.saveChatHistory(message);
    self.broadchat(message);
  });
}

Chat.prototype.saveChatHistory = function(message){
  var self = this;
  var maximum = 7;
  if(self.chatHistory.length == maximum){
    self.chatHistory.shift();
  }
  self.chatHistory.push(message);
}

Chat.prototype.broadchat = function(message){
  var self = this;
  message.timestamp = new Date();
  self.bayeux.getClient().publish('/chat', message);
}

Chat.prototype.getChatUser = function(param, value){
  var self = this;
  if (self.chatUsers.length != 0){
    for(var chatUser in self.chatUsers){
      if(self.chatUsers[chatUser] && self.chatUsers[chatUser][param] == value){
        return self.chatUsers[chatUser];
      }
    }
  }
}

Chat.prototype.addChatUser = function(request){
  var self = this;
  var location = url.parse(request.url, true);
  var ip = request.connection.remoteAddress;
  
  if (self.getChatUser('ip', ip)){
    return false;
  }
  
  var user = {ip: ip};
  var name = location.query.name;
    
  if (!self.getChatUser('name', name)){
    user.name = name;
    self.chatUsers.push(user);
    return true; 
  }

  return false;
}


module.exports = Chat;
