var faye = require('faye')
 ,  Streamer = require('../lib/streamer')
 ,  Radio = require('../lib/radio')
 ,  Decoder = require('../lib/decoder')
 ,  Chat = require('../lib/chat')
 ,  Map = require('../lib/map')
 ,  Track = require('../models/track');
 
module.exports = function(app){
  var bayeux = new faye.NodeAdapter({mount: '/faye',timeout: 45}); bayeux.attach(app);
  var radio = new Radio(bayeux)
  ,   chat = new Chat(bayeux)
  ,   map = new Map(bayeux, chat, radio)
  ,   decoder = new Decoder(radio)
  ,   streamer = new Streamer(app.settings.server, radio, chat, decoder, map);
  
  app.get('/', function(req, res){
    var user = chat.getChatUser('ip', req.connection.remoteAddress);
    Track.find({}).desc('updated_at').limit(50).run(function(err, tracks){
      res.render('index', {
        track: radio.currentTrack
      , dj: radio.currentDJ
      , user: user ? user.name : false
      , history: chat.chatHistory
      , config: {port: app.settings.server.port}
      , tracks: tracks
      , locations: map.allLocations()
      });
    });
  });
  app.get('/mobile', function(req, res){
    res.render('mobile', {
      track: radio.currentTrack
    , dj: radio.currentDJ
    , config: {port: app.settings.server.port}
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
  app.get('/tracks/:filter', function(req, res){
    switch(req.params.filter){
      case 'recent':
        Track.find({}).desc('updated_at').limit(50).run(function(err, tracks){
          res.render('_tracks', {
            show_name: true
          , tracks: tracks
          });
        });
        break;
      case 'most-played':
        Track.find({}).run(function(err, tracks){
          res.render('_tracks', {
            show_name: true
          , tracks: Track.mostPlayed(tracks)
          });
        });
        break;
      case 'by-artist':
        Track.find({}).asc('artist').run(function(err, tracks){
          res.render('_tracks', {
            show_name: false
          , tracks: Track.byArtists(tracks)
          });
        });
    };
  });
}