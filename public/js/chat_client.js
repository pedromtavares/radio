function ChatClient (config) {
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  
  var self = this;
  
  self.config = config;
  
  this.init = function(){
    self.setupPubSub();
    self.setupDOM();
    self.unreadMsgCount = 0;
    self.hasFocus = true;
    self.onlineChatUsers = [];
    self.config.chatUsers.forEach(function(chatUser) {
      self.addOnlineChatUser(chatUser.name);
    });
  };
  
  this.setupPubSub = function(){
    self.config.pubSub.subscribe('chat', function (message) {
      var author = $('#author').val();
      $('#chatbox').append(self.renderChatRow(message, true));
      $("#chatbox").scrollTop($("#chatbox")[0].scrollHeight);
      if (author =='' || author != message.author){
        self.unreadMsgCount+=1;
        if (!self.hasFocus){
          self.updateTitle();
        }
      }
    });
  }
  
  this.renderChatRow = function(message, addOnlineUser){
    if (addOnlineUser){
      self.addOnlineChatUser(message.author);
    }
    var ts = new Date(message.timestamp);
    var author = "<div class='author'>"+message.author+"</div>";
    var time = "<div class='time'>("+addZero(ts.getHours())+":"+addZero(ts.getMinutes())+")</div>";
    var message = "<div class='message'>" + replaceLinks(message.message) + "</div>";
    var row = "<div class='chat_row'>"+author+time+message+"</div>";
    return row;
  };
  
  this.sendChatMessage = function(author, message){
    $.get('/broadchat?author='+author+'&message='+message);  
    self.unreadMsgCount = 0;
  }
  
  this.updateTitle = function(){
    if (self.unreadMsgCount!=0){
      document.title = '('+self.unreadMsgCount+') Rádio da Galere';
    }
  }
  
  this.getOnlineChatUser = function(name){
    if (self.onlineChatUsers.length != 0){
      for(var onlineChatUser in self.onlineChatUsers){
        if(self.onlineChatUsers[onlineChatUser] && self.onlineChatUsers[onlineChatUser].name == name){
          return self.onlineChatUsers[onlineChatUser];
        }
      }
    }
    return false;
  }
  
  this.removeOnlineChatUser = function(name){
    $('#'+encodeID(name)).detach();
    var onlineChatUser = self.getOnlineChatUser(name);
    var index = self.onlineChatUsers.indexOf(onlineChatUser);
    if (index != -1){
      self.onlineChatUsers.splice(index, 1);
      clearTimeout(onlineChatUser.timeout);
    }
  }
  
  this.addOnlineChatUser = function(name){
    if (name == "" || !name) { return false;}
    var onlineChatUser = self.getOnlineChatUser(name);
    var timer = setTimeout(function() {self.removeOnlineChatUser(name)}, 10 * 60 * 1000);
    
    if (onlineChatUser){
      clearTimeout(onlineChatUser.timeout);
      onlineChatUser.timeout = timer;
    }else{
      var li = "<li id='"+encodeID(name)+"'>"+name+"</li>"
      var onlineChatUser = {name:name};
      if ($('#'+encodeID(name)).length == 0){
        $('#online').append(li);
      }
      self.onlineChatUsers.push(onlineChatUser);
      onlineChatUser.timeout = timer;
    }
  }
  
  this.setupDOM = function(){
    var message = $('#message');
    var author = $('#author');

    author.keypress(function(e){
      if(e.which == 13){
        message.focus();
       }
    });

    message.keypress(function(e){
      if(e.which == 13){
        if(message.val() != '' && author.val() != ''){
          if (author.hasClass('registered')){
            self.sendChatMessage(sanitizeHtml(author.val()), sanitizeHtml(message.val()));
            message.val('');
            message.focus();
          }else{
            $.get('/register', {name: sanitizeHtml(author.val())}, function(data) {
              author.animate({
                  width: 'toggle',
                }, 'slow', function() {
                  message.animate({width:"+=11.3em"}, 'slow')
                }
              );
              author.addClass('registered');
              self.sendChatMessage(sanitizeHtml(author.val()), sanitizeHtml(message.val()));
              message.val('');
              message.focus();
            });
          }    
        }
       }
    });

    window.onblur = function() {
      self.hasFocus = false;
    };

    window.onfocus = function(){
      self.hasFocus = true;
      self.unreadMsgCount = 0;
      document.title = 'Rádio da Galere';
    }
    
    // window.onunload = function(){
    //   var name = author.val();
    //   if (name != ""){
    //     self.removeOnlineChatUser(name);
    //     self.sendChatMessage(data, "<div class='action_message'>"+name+" acabou de sair do chat.</div>");
    //   }
    // }
  }
  
  this.init();
}