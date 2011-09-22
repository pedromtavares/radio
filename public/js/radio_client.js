function RadioClient (config) {
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  
  var self = this;
  
  self.config = config;
  
  this.init = function(){
    self.currentTrack = false;
    self.setupBayeuxHandlers();
    self.setupDOMHandlers();
    self.startRadio();
  };
  
  this.setupBayeuxHandlers = function(){
    self.config.fayeClient.subscribe('/radio', function (message) {
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
  }
  
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
    $('.offline').show();
    $('.online').hide();
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
      if (current != track){
        $('#track').html(track);
        $('#recent').click();
      }
    }, time * 1000)
    self.currentTrack = track;
    console.log(track);
  };
  
  this.setupDOMHandlers = function(){
    var stopStream = function(){
      self.stopPlayer();
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
  
  this.init();
}