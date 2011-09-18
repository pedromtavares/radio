function RadioClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.currentTrack = false;
    self.config = self.getServerConfigs();
    self.setupBayeuxHandlers();
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
  };
    
  this.startRadio = function(){
    if (self.config.dj){
      self.goOnline();
    }else{
      self.goOffline();
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
  };
  
  this.nextTrack = function(track){
    if (!self.config.dj){
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
  
  this.init();
}

$(function(){
  var client = new RadioClient();
}
