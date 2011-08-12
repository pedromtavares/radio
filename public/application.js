$(function(){

  //var url = "http://localhost:9000/faye"
  var url = "http://radio.pedromtavares.com/faye"
  
  var client = new Faye.Client(url, {
    timeout: 120
  });
  
  client.subscribe('/track', function (message) {
    var track = message.track;
    var current = $('#track').html();
    var time = 0;
    console.log(track);
    if (track == 'offline'){
      $('h1').text("Stream is currently offline");
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

  // We'll use 'canPlayType' to determine which file format to request
  var audio = $("audio")[0];
  if (audio.canPlayType('application/ogg; codecs="vorbis"') == "probably"
      && (/Chrome/i.test(navigator.userAgent) || !/Safari/i.test(navigator.userAgent))) {
    audio.src = "/stream.ogg";
  }
  audio.setAttribute("controls", true);
  audio.load();
  audio.play();
});