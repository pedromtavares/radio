
/**
 * Module dependencies.
 */

var express = require('express'),
    Server = require('./lib/server'),
    settings;

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  var settings = {
    url: "http://stream.pedromtavares.com:10000",
    port: 8000,
    reconnectTime: 5 // in seconds
  }
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
  var settings = {
    url: "http://stream.pedromtavares.com:10000",
    port: 80,
    host: '173.255.227.12',
    reconnectTime: 60 // in seconds
  }
});

var settings = {
  url: "http://stream.pedromtavares.com:10000",
  port: 8000,
  reconnectTime: 5 // in seconds
}

var server = new Server(settings, app);

// Routes

app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});
/* Player related */
app.get('/stream.mp3', function(req, res){
  server.streamResponse(req, res, 'mp3');
});
app.get('/stream.ogg', function(req, res){
  server.streamResponse(req, res, 'ogg');
});
app.get('/track', function(req, res){
  server.plainResponse(res, server.radio.currentTrack ? server.radio.currentTrack : "");
});
app.get('/dj', function(req, res){
  server.plainResponse(res, server.radio.currentDJ ? server.radio.currentDJ : "");
});
/* Chat related */
app.get('/chat_user', function(req, res){
  var user = server.chat.getChatUser('ip', req.connection.remoteAddress);
  server.plainResponse(res, user ? user.name : "" );
});
app.get('/register', function(req, res){
  var success = server.chat.addChatUser(req);
  server.plainResponse(res, success ? 'ok' : 'taken');
});
app.get('/history', function(req, res){
  res.writeHead(200, {'Content-Type' : 'application/x-javascript'});
  res.end(JSON.stringify(server.chat.chatHistory));
});
/* Configs */
app.get('/config', function(req, res){
  res.writeHead(200, {'Content-Type' : 'application/x-javascript'});
  res.end(JSON.stringify({port: settings.port}));
});


app.listen(settings.port, settings.host);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
// after reserving priviled port, set process to run on a less privileged user
if (settings.host){
  process.setgid(50);
  process.setuid(1000); 
  console.log("Process now running under user: " + process.getuid());
}
