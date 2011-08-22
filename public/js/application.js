function RadioClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.setupBayeuxHandlers();
    self.currentDJ = false;
    self.getDJ();
    self.renderChatHistory();
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
          self.nextTrack(track);
        }
      });
      
      self.fayeClient.subscribe('/chat', function (message) {
        $('#chatbox').append(self.renderChatRow(message));
        $("#chatbox").scrollTop($("#chatbox")[0].scrollHeight);
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
  }
  
  this.init();
}

$(function(){
  var client = new RadioClient();
  
  var message = $('#message');
  var author = $('#author');
  var submit = $('#submit');
  
  
  submit.click(function(){
    if(message.val() != '' && author.val() != ''){
      client.sendChatMessage(sanitizeHtml(author.val()), sanitizeHtml(message.val()));
      message.val('');
      message.focus();
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
