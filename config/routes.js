var fs = require('fs')
 ,  Streamer = require('../lib/streamer')
 ,  Radio = require('../lib/radio')
 ,  Decoder = require('../lib/decoder')
 ,  Chat = require('../lib/chat')
 ,  Map = require('../lib/map')
 ,  Track = require('../models/track');
 
module.exports = function(app, pubSub){
  var radio = new Radio(app, pubSub)
  ,   chat = new Chat(pubSub)
  ,   map = new Map(chat, radio, pubSub)
  ,   decoder = new Decoder(radio, app.settings.server.multipleDecoders)
  ,   streamer = new Streamer(app, radio, chat, decoder, map);
  app.get('/', function(req, res){
    var user = chat.getChatUser('ip', req.connection.remoteAddress);
    Track.find({}).desc('updated_at').limit(50).run(function(err, tracks){
      res.render('index', {
        track: radio.currentTrack
      , dj: radio.currentDJ
      , user: user ? user.name : false
      , history: chat.chatHistory
      , config: {port: app.settings.server.port, listenerLimit: app.settings.server.listenerLimit}
      , tracks: tracks
      , locations: map.allLocations()
      , chatUsers: chat.allChatUsers()
      , listeners: radio.listeners.length
      });
    });
  });
  app.get('/mobile', function(req, res){
    res.render('mobile', {
      track: radio.currentTrack
    , dj: radio.currentDJ
    , config: {port: app.settings.server.port, listenerLimit: app.settings.server.listenerLimit}
    , listeners: radio.listeners.length
    });
  });
  app.get('/stream.mp3', function(req, res){
    streamer.streamResponse(req, res, 'mp3');
  });
  app.get('/stream.ogg', function(req, res){
    streamer.streamResponse(req, res, 'ogg');
  });
  app.get('/track', function(req, res){
    res.send(radio.currentTrack);
  });
  app.get('/dj', function(req, res){
    res.send(radio.currentDJ);
  });
  app.get('/register', function(req, res){
    var success = chat.addChatUser(req);
    res.send(success ? 'ok' : 'taken');
  });
  app.get('/broadchat', function(req, res) {
    chat.broadchat(req);
    res.send('ok');
  });
  app.get('/tracks/:filter', function(req, res){
    switch(req.params.filter){
      case 'recent':
        Track.find().desc('updated_at').limit(50).run(function(err, tracks){
          res.render('_tracks', {
            show_name: true
          , tracks: tracks
          });
        });
        break;
      case 'most-played':
        Track.find().$where('this.plays.length >  1').limit(50).exec(function(err, tracks){
          res.render('_tracks', {
            show_name: true
          , tracks: Track.mostPlayed(tracks)
          });
        });
        break;
      case 'by-artist':
        Track.byArtists(function(err, tracks){
          res.render('_tracks', {
            show_name: false
          , tracks: tracks
          });
        });        
    };
  });
  app.get('/upload', function(req, res){
    res.render('upload');
  });
  app.post('/upload', function(req, res, next){
    req.form.complete(function(err, fields, files){
        if (err) {
          next(err);
        } else {
          fs.rename(files.track.path, process.cwd() + '/public/system/tmp/' + fields.genre + '/' + files.track.filename, function(){
            res.send('<script>alert("Música enviada com sucesso.");window.location.href = "/upload"</script>');
          });
        }
      });
  });
  app.get('/admin/:token', function(req, res){
    if (req.params.token == app.settings.server.keys.token){
      res.send('oi');
    }else{
      res.send('sai daki lek afff');
    }
  });

}