function RadioClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.setupBayeuxHandlers();
    self.currentDJ = false;
    self.unreadMsgCount = 0;
    self.hasFocus = true;
    self.onlineChatUsers = [];
    self.getDJ();
    self.renderChatHistory();
    self.getChatUser();
  };
  
  this.setupBayeuxHandlers = function() {
    $.getJSON("/config", function (config) {
      self.fayeClient = new Faye.Client("http://" + window.location.hostname + ':' + config.port + '/faye', {
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
    });
  };
  
  /* Player Related */
  
  this.getDJ = function(){
    $.get('/dj', function(data) {
      if (data == ''){
        self.goOffline();
      }else{
        self.goOnline(data);
        self.currentDJ = data;
      }
    });
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
  
  this.goOnline = function(dj){
    $('#dj').html(dj);
    self.startPlayer();
  };
  
  this.goOffline = function(){
    $('#offline_msg').show();
    $('#current_dj').hide();
    $('#current_track').hide();
    self.currentDJ = false;
    self.stopPlayer();
  };
  
  this.nextTrack = function(track){
    if (!self.currentDJ){
      window.location.reload();
    }
    // Don't show the next track immediately since the stream delay is about 15 seconds, so we don't want to spoil out 
    // what the next track is gonna be 15 seconds before it actually starts. It's ok to show it immediately if 
    // there was nothing playing (or if you just connected to the stream).
    var current = $('#track').html();
    var time = current == "" ? 1 : 20;
    setTimeout(function() {
      $('#track').html(track);
    }, time * 1000)
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
  
  this.getChatUser = function(){
    $.get('/chat_user', function(data) {
      if (data != ''){
        $('#author').val(data);
        $('#author').attr('readonly', true);
        self.addOnlineChatUser(data);
      }
    });
  };
  
  this.renderChatHistory = function(){
    $.get('/history', function(messages) {
      messages = JSON.parse(messages);
      for(index in messages){
        if (messages[index].author){
          $('#chatbox').append("<div style='color:lightgray'>"+self.renderChatRow(messages[index], false)+"</div>");
        }
      }
    });
  }
  
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
  
  if (!isMobile()){
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
  }
  

  
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
        $.get('/register', {name: author.val()}, function(data) {
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
  
  window.onunload = function(){
    if (author.val() != ""){
      client.removeOnlineChatUser(author.val());
    }
  }

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

function isMobile(){
  var a = navigator.userAgent || navigator.vendor|| window.opera;
  /android.+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|e\-|e\/|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(di|rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|xda(\-|2|g)|yas\-|your|zeto|zte\-/i.test(a.substr(0,4));
}
