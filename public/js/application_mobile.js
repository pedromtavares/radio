function RadioClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.currentTrack = false;
    self.timeout = false;
    self.config = self.getServerConfigs();
    self.setupPubSub();
    // self.setupDOM();
    self.startRadio();
  };
  
  this.getServerConfigs = function(){
    var config = {
      port: JSON.parse($('#portConfig').val())
    , dj: $('#djConfig').val()
    , listenerLimit: JSON.parse($('#listenerLimit').val())
    };
    return config;
  };
  
  this.setupPubSub = function() {
    self.config.pubSub = new Juggernaut;
    self.config.pubSub.subscribe('radio', function (message) {
      var track = message.track;
      var listeners = message.listeners;
      $('#listeners').html(listeners);
      self.slideLimit(listeners);
      if (track == 'offline'){
        self.goOffline();
      }else{
        if (track && track != ''){
          self.nextTrack(track);
        }
      }
    });
  };
  
  this.slideLimit = function(count){
    if (!count) return;
    if (!self.timeout){
      self.timeout = setTimeout(function() {
        if (count >= self.config.listenerLimit){
          $('#limit-alert').slideDown();
        }else{
          $('#limit-alert').slideUp();
        }
        self.timeout = false;
      }, 1000)
    }
  };
    
  this.startRadio = function(){
    self.goOnline();
  };
  
  this.loadPlayer = function(){
    $("#jplayer").jPlayer("setMedia",{
      mp3: "/stream.mp3",
    }).jPlayer("play");
  }
  
  this.startPlayer = function(){
    $("#jplayer").jPlayer({
      ready: function (event) {
        if (self.config.listenerCount < self.config.listenerLimit){
          self.loadPlayer();
        }
      },
      swfPath: "../",
      supplied: "mp3",
      loadstart: function(event){
        $('.stream-loading').show();
      },
      playing: function(event){
        $('.stream-loading').hide();
      },
      error: function(event){
        if (event.jPlayer.error.type != $.jPlayer.error.URL_NOT_SET){
          $('.stream-loading').hide();
          self.reloadPlayer();
        }
      },
    });
  };
  
  this.stopPlayer = function(){
    $('.stream-loading').hide();
    $("#jplayer").jPlayer("clearMedia");
  };
  
  this.reloadPlayer = function(){
    self.stopPlayer();
    self.loadPlayer();
  }
  
  this.goOnline = function(){
    self.startPlayer();
  };
  
  this.goOffline = function(){
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
  };
  
  this.setupDOM = function(){
    $('#reload').click(self.reloadPlayer);

    $('.jp-stop').click(self.stopPlayer);
    $('.jp-pause').click(self.stopPlayer);
    $('.jp-mute').click(self.stopPlayer);

    $('.jp-play').click(self.loadPlayer);
    $('.jp-unmute').click(self.loadPlayer);
  }
  
  this.init();
}

$(function(){
  new RadioClient();
});