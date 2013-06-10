var fs = require('fs'),
    Streamer = require('../lib/streamer'),
    Radio = require('../lib/radio'),
    Decoder = require('../lib/decoder'),
    Chat = require('../lib/chat'),
    Map = require('../lib/map'),
    Provider = require('../lib/provider'),
    Track = require('../models/track');
 
module.exports = function(app, pubSub){
  var radio = new Radio(app, pubSub),
      chat = new Chat(pubSub),
      map = new Map(chat, radio, pubSub),
      decoder = new Decoder(app, radio),
      provider = new Provider(app, decoder, pubSub),
      streamer = new Streamer(app, radio, chat, decoder, map, provider);
  app.get('/', function(req, res){
    var user = chat.getChatUser('ip', req.connection.remoteAddress);
    Track.find({}).desc('updated_at').limit(50).run(function(err, tracks){
      res.render('index', {
        track: radio.currentTrack,
        dj: radio.currentDJ,
        user: user ? user.name : false,
        history: chat.chatHistory,
        config: {port: app.settings.server.port, listenerLimit: app.settings.server.listenerLimit},
        tracks: tracks,
        locations: map.allLocations(),
        chatUsers: chat.allChatUsers(),
        listeners: radio.listeners.length + radio.streamListeners,
        playlist: provider.currentPlaylist,
        song: provider.currentSong
      });
    });
  });
  app.get('/mobile', function(req, res){
    res.render('mobile', {
      track: radio.currentTrack,
      dj: radio.currentDJ,
      config: {port: app.settings.server.port, listenerLimit: app.settings.server.listenerLimit},
      listeners: radio.listeners.length + radio.streamListeners,
      playlist: provider.currentPlaylist
    });
  });
  app.get('/stream.mp3', function(req, res){
    streamer.streamResponse(req, res);
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
            show_name: true,
            tracks: tracks
          });
        });
        break;
      case 'most-played':
        Track.find().$where('this.plays.length > 4').exec(function(err, tracks){
          res.render('_tracks', {
            show_name: true,
            tracks: Track.mostPlayed(tracks)
          });
        });
        break;
      case 'by-artist':
        Track.byArtists(function(err, tracks){
          res.render('_tracks', {
            show_name: false,
            tracks: tracks
          });
        });
    }
  });
  app.get('/search/:query', function(req, res){
    // res.json([{url: 'http://www.tumblr.com/audio_file/alikhandro/9733034154/tumblr_lqcb2jm1pm1r15jcw?plead=please-dont-download-this-or-our-lawyers-wont-let-us-host-audio', title: 'Test Bad Track', artist: "Test Bad"}, {url: 'http://a.tumblr.com/tumblr_ltdvr0q0OW1r2bzqlo1.mp3', title: 'Test Good Track', artist: "Test Good"}]);
    provider.search(req.params.query, function(songs) {
      res.json(songs);
    });
  });
  app.post('/playlist', function(req, res) {
    provider.createPlaylist(req.body.name, req.body.ids, false, function() {
      provider.nextPlaylist();
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
  app.get('/admin/:token', function(req, res){
    if (req.params.token == app.settings.server.keys.token){
      res.send('oi');
    }else{
      res.send('sai daki lek afff');
    }
  });
  
}