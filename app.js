
/**
 * Module dependencies.
 */

var express = require('express'),
    faye = require('faye'),
    Streamer = require('./lib/streamer'),
    Radio = require('./lib/radio'),
    Decoder = require('./lib/decoder'),
    Chat = require('./lib/chat'),
    app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.set('view options', {
    layout: false
  });
});



app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  app.set('settings', {
    url: "http://stream.pedromtavares.com:10000",
    port: 8000,
    reconnectTime: 5 // in seconds
  });
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
  app.set('settings', {
    url: "http://stream.pedromtavares.com:10000",
    port: 80,
    host: '173.255.227.12',
    reconnectTime: 60 // in seconds
  });
});

var bayeux = new faye.NodeAdapter({
  mount: '/faye',
  timeout: 45
});
bayeux.attach(app);

var radio = new Radio(bayeux);
var chat = new Chat(bayeux);
var decoder = new Decoder(radio);
var streamer = new Streamer(app.settings.settings, radio, chat, decoder);

// Routes

app.get('/', function(req, res){
  var user = chat.getChatUser('ip', req.connection.remoteAddress);
  res.render('index', {
    track: radio.currentTrack
  , dj: radio.currentDJ
  , chatUser: user ? user.name : false
  , history: chat.chatHistory
  , config: {port: app.settings.settings.port}
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

// Helpers

app.helpers({
  sanitizeHtml: function(text){
    return text.replace(/&/g,'&amp;').
       replace(/</g,'&lt;').
       replace(/"/g,'&quot;').
       replace(/'/g,'&#039;');
  },

  addZero: function(number){
    if(number < 10){
      return '0'+number;
    }
    return number;
  },

  replaceLinks: function(text) {
      var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
      return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
  },

  encodeID: function(s) {
      if (s==='') return '_';
      return s.replace(/[^a-zA-Z0-9.-]/g, function(match) {
          return '_'+match[0].charCodeAt(0).toString(16)+'_';
      });
  }
  
});


app.listen(app.settings.settings.port, app.settings.settings.host);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
// after reserving priviled port, set process to run on a less privileged user
if (app.settings.settings.host){
  process.setgid(50);
  process.setuid(1000); 
  console.log("Process now running under user: " + process.getuid());
}
