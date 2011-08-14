$(function(){

  //var url = "http://localhost:9000/faye"
  var url = "http://radio.pedromtavares.com/faye"
  
  var client = new Faye.Client(url, {
    timeout: 120
  });
  
  $.get('/dj', function(data) {
    $('#dj').html(data);
  });
  
  client.subscribe('/track', function (message) {
    var track = message.track;
    var current = $('#track').html();
    var time = 0;
    console.log(track);
    if (track == 'offline'){
      $('#current').text("Radio offline");
    }else{
      // Don't show the next track immediately since the stream delay is about 15 seconds, so we don't want to spoil out 
      // what the next track is gonna be 15 seconds before it actually starts. It's ok to show it immediately if 
      // there was nothing playing (or if you just connected to the stream).
      time = current == "" ? 1 : 20;
      setTimeout(function() {
        $('#track').html(track);
      }, time * 1000)
    }
  });
  
  $("#jplayer").jPlayer({
    ready: function () {
      $(this).jPlayer("setMedia", {
        mp3: "/stream.mp3",
        oga: "/stream.ogg"
      }).jPlayer("play");;
    },
    swfPath: "/public",
    supplied: "mp3, oga"
  });
});