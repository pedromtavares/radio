function RadioClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.unreadMsgCount = 0;
    self.hasFocus = true;
    self.onlineChatUsers = [];
    self.currentTrack = false;
    self.config = self.getServerConfigs();
    self.setupBayeuxHandlers();
    self.addOnlineChatUser($('#author').val());
    self.startRadio();
  };
  
  this.getServerConfigs = function(){
    var config = {
      port: JSON.parse($('#portConfig').val())
    , dj: $('#djConfig').val()
    };
    return config;
  };
  
  this.setupBayeuxHandlers = function() {
    self.fayeClient = new Faye.Client("http://" + window.location.hostname + ':' + self.config.port + '/faye', {
      timeout: 120
    });

    self.fayeClient.subscribe('/radio', function (message) {
      var track = message.track;
      var listeners = message.listeners;
      $('#listeners').html(listeners);
      if (track == 'offline'){
        self.goOffline();
      }else{
        if (track && track != ''){
          self.nextTrack(track);
        }
      }
    });
    
    self.fayeClient.subscribe('/chat', function (message) {
      var author = $('#author').val();
      $('#chatbox').append(self.renderChatRow(message, true));
      $("#chatbox").scrollTop($("#chatbox")[0].scrollHeight);
      if (author=='' || author != message.author){
        self.unreadMsgCount+=1;
        if (!self.hasFocus){
          self.updateTitle();
        }
      }
    });
  };
  
  /* Player Related */
  
  this.startRadio = function(){
    if (self.config.dj == 'false'){
      self.goOffline();
    }else{
      self.goOnline();
    }
  };
  
  this.startPlayer = function(){
    $("#jplayer").jPlayer({
      ready: function () {
        $(this).jPlayer("setMedia", {
          mp3: "/stream.mp3",
          oga: "/stream.ogg"
        }).jPlayer("play");
      },
      swfPath: "/public",
      supplied: "mp3, oga"
    });
  };
  
  this.stopPlayer = function(){
    $("#jplayer").jPlayer("clearMedia");
  };
  
  this.goOnline = function(){
    self.startPlayer();
  };
  
  this.goOffline = function(){
    $('#offline_msg').show();
    $('#current_dj').hide();
    $('#current_track').hide();
    self.stopPlayer();
    self.currentTrack = false;
    self.config.dj = 'false';
  };
  
  this.nextTrack = function(track){
    if (self.config.dj == 'false'){
      window.location.reload();
    }
    // Don't show the next track immediately since the stream delay is about 15 seconds, so we don't want to spoil out 
    // what the next track is gonna be 15 seconds before it actually starts. It's ok to show it immediately if 
    // there was nothing playing (or if you just connected to the stream).
    var current = $('#track').html();
    var time = self.currentTrack ? 15 : 1;
    setTimeout(function() {
      $('#track').html(track);
    }, time * 1000)
    self.currentTrack = track;
    console.log(track);
  };
  
  /* Chat related */
  
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
    self.fayeClient.publish('/broadchat', {
      author: author
    , message: message
    });
    self.unreadMsgCount = 0;
  }
  
  self.updateTitle = function(){
    if (self.unreadMsgCount!=0){
      document.title = 'Rádio da Galere ('+self.unreadMsgCount+')';
    }
  }
  
  self.getOnlineChatUser = function(name){
    if (self.onlineChatUsers.length != 0){
      for(var onlineChatUser in self.onlineChatUsers){
        if(self.onlineChatUsers[onlineChatUser] && self.onlineChatUsers[onlineChatUser].name == name){
          return self.onlineChatUsers[onlineChatUser];
        }
      }
    }
    return false;
  }
  
  self.removeOnlineChatUser = function(name){
    $('#'+encodeID(name)).detach();
    var onlineChatUser = self.getOnlineChatUser(name);
    var index = self.onlineChatUsers.indexOf(onlineChatUser);
    if (index != -1){
      self.onlineChatUsers.splice(index, 1);
      clearTimeout(onlineChatUser.timeout);
    }
  }
  
  self.addOnlineChatUser = function(name){
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
  
  this.init();
}

$(function(){
  var client = new RadioClient();
  
  /* Player Related */
  
  var stopStream = function(){
    client.stopPlayer();
  }

  var startStream = function(){
    window.location.reload();
  }

  $('.jp-stop').click(stopStream);
  $('.jp-pause').click(stopStream);
  $('.jp-mute').click(stopStream);

  $('.jp-play').click(startStream);
  $('.jp-unmute').click(startStream);



  
  /* Chat Related */
  
  var message = $('#message');
  var author = $('#author');
  var submit = $('#submit');
  
  author.keypress(function(e){
    if(e.which == 13){
      message.focus();
     }
  });
  
  message.keypress(function(e){
    if(e.which == 13){
      submit.click();
     }
  });
    
  submit.click(function(){
    if(message.val() != '' && author.val() != ''){
      if (author.attr('readonly') == 'readonly'){
        client.sendChatMessage(sanitizeHtml(author.val()), sanitizeHtml(message.val()));
        message.val('');
        message.focus();
      }else{
        $.get('/register', {name: sanitizeHtml(author.val())}, function(data) {
          if (data == 'taken'){
            alert('Este nome já foi registrado, tente outro.');
            author.focus();
          }else{
            author.attr('readonly', true);
            client.sendChatMessage(sanitizeHtml(author.val()), sanitizeHtml(message.val()));
            message.val('');
            message.focus();
          }
        });
      }    
    }

  });
  
  window.onblur = function() {
    client.hasFocus = false;
  };
  
  window.onfocus = function(){
    client.hasFocus = true;
    client.unreadMsgCount = 0;
    document.title = 'Rádio da Galere';
  }
  
  // window.onunload = function(){
  //   var name = author.val();
  //   if (name != ""){
  //     client.removeOnlineChatUser(name);
  //     self.sendChatMessage(data, "<div class='action_message'>"+name+" acabou de sair do chat.</div>");
  //   }
  // }

});

/* Helper functions */

function sanitizeHtml(text){
  return text.replace(/&/g,'&amp;').
     replace(/</g,'&lt;').
     replace(/"/g,'&quot;').
     replace(/'/g,'&#039;');
}

function addZero(number){
  if(number < 10){
    return '0'+number;
  }
  return number;
}

function replaceLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
}

function encodeID(s) {
    if (s==='') return '_';
    return s.replace(/[^a-zA-Z0-9.-]/g, function(match) {
        return '_'+match[0].charCodeAt(0).toString(16)+'_';
    });
}