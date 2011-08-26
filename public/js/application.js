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
        $('#chatbox').append(self.renderChatRow(message));
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
  
  this.renderChatRow = function(message){
    var ts = new Date(message.timestamp);
    var author = "<div class='author'>"+message.author+"</div>";
    var time = "<div class='time'>("+addZero(ts.getHours())+":"+addZero(ts.getMinutes())+")</div>";
    var message = "<div class='message'>" + message.message + "</div>";
    var row = "<div class='chat_row'>"+author+time+message+"</div>";
    return row;
  };
  
  this.getChatUser = function(){
    $.get('/chat_user', function(data) {
      if (data != ''){
        $('#author').val(data);
        $('#author').attr('readonly', true);
      }
    });
  };
  
  this.renderChatHistory = function(){
    $.get('/history', function(messages) {
      messages = JSON.parse(messages);
      for(index in messages){
        if (messages[index].author){
          $('#chatbox').append("<div style='color:lightgray'>"+self.renderChatRow(messages[index])+"</div>");
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
    if (client.unreadMsgCount!=0){
      document.title = 'Rádio da Galere ('+client.unreadMsgCount+')';
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
  
  message.keypress(function(e){
    if(e.which == 13){
      submit.click();
     }
  });
  
  author.keypress(function(e){
    if(e.which == 13){
      message.focus();
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

});

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
