var url = require('url');

function Chat(pubSub){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  self.pubSub = pubSub;
  self.init();
};

Chat.prototype.init = function(){
  var self = this;
  
  self.chatHistory = [];
  self.chatUsers = [];
  
  // self.bayeux.getClient().subscribe('/broadchat', function(message) {
  //   self.saveChatHistory(message);
  //   self.broadchat(message);
  // });
}

Chat.prototype.saveChatHistory = function(message){
  var self = this;
  var maximum = 7;
  if(self.chatHistory.length == maximum){
    self.chatHistory.shift();
  }
  self.chatHistory.push(message);
}

Chat.prototype.broadchat = function(request){
  var self = this;
  var location = url.parse(request.url, true);
  var message = {
    channels: ['chat'],
    data: {
      author: location.query.author,
      message: location.query.message,
      timestamp: new Date()
    }
  }
  self.pubSub.publish("juggernaut", JSON.stringify(message));
  self.saveChatHistory(message.data);
  //self.bayeux.getClient().publish('/chat', message);
}

Chat.prototype.getChatUser = function(param, value){
  var self = this;
  if (self.chatUsers.length != 0){
    for(var index in self.chatUsers){
      var chatUser = self.chatUsers[index];
      if(chatUser && chatUser[param] == value){
        return chatUser;
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

Chat.prototype.allChatUsers = function(){
  var self = this;
  var chatUsers = [];
  if (self.chatUsers.length != 0){
    self.chatUsers.forEach(function(chatUser) {
      chatUsers.push({name:chatUser.name});
    });
  }
  return chatUsers;
}


module.exports = Chat;
