var fs = require('fs'),
    Streamer = require('../lib/streamer'),
    Radio = require('../lib/radio'),
    Decoder = require('../lib/decoder'),
    Provider = require('../lib/provider');
 
module.exports = function(app){
  var radio = new Radio(app),
      decoder = new Decoder(app, radio),
      provider = new Provider(app, decoder),
      streamer = new Streamer(app, radio, decoder, provider);
  app.get('/', function(req, res){
    res.redirect('http://mixradio.fm');
  });
  app.get('/stream.mp3', function(req, res){
    streamer.streamResponse(req, res);
  });
  app.get('/track', function(req, res){
    if (radio.currentTrack){
      res.send(radio.currentTrack);
    }else{
      res.json(provider.currentSong);
    }
  });
  app.get('/dj', function(req, res){
    res.send(radio.currentDJ);
  });
  app.get('/playlist', function(req, res){
    res.json(provider.currentPlaylist);
  });
  app.post('/playlist', function(req, res) {
    provider.createPlaylist(req.body.name, req.body.ids, req.body.user_id, req.body.automatic, req.body.uid, function() {
      if (req.body.automatic){
        provider.start(true);
      }else{
        provider.jumpPlaylist();
      }  
      res.send('done');
    });
  });
  app.get('/playlists', function(req, res) {
    res.json(provider.playlists);
  });
  app.get('/check/:url', function(req, res) {
    provider.treatUrl(req.params.url, function(newUrl) {
      if (newUrl){
        res.send('ok');
      }else{
        res.send('bad');
      }
    });
  });
  app.get('/search/:query', function(req, res){
    // res.json([{url: 'http://www.tumblr.com/audio_file/alikhandro/9733034154/tumblr_lqcb2jm1pm1r15jcw?plead=please-dont-download-this-or-our-lawyers-wont-let-us-host-audio', title: 'Test Bad Track', artist: "Test Bad"}, {url: 'http://a.tumblr.com/tumblr_ltdvr0q0OW1r2bzqlo1.mp3', title: 'Test Good Track', artist: "Test Good"}]);
    provider.search(req.params.query, function(songs) {
      res.json(songs);
    });
  });
}