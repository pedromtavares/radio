var fs = require('fs')

module.exports = function(app, express){
  app.configure(function(){
    app.set('views', __dirname + '/../views');
    app.set('view engine', 'jade');
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(__dirname + '/../public'));
    app.set('view options', {
      layout: false
    });
  });

  app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
    app.set('server', {
      url: "http://stream.pedromtavares.com:20000"
    , port: 8000
    , reconnectTime: 5 // in seconds
    , twitterInterval: 5 // in seconds
    , keys : JSON.parse(fs.readFileSync(process.cwd()+'/config/keys.json', encoding='utf8'))
    , multipleDecoders: true
    , listenerLimit: 3
    });
  });

  app.configure('production', function(){
    app.use(express.errorHandler()); 
    app.set('server', {
      url: "http://stream.pedromtavares.com:10000"
    , port: 80
    , host: '173.255.227.12'
    , reconnectTime: 60 // in seconds (1 min)
    , twitterInterval: 30 * 60 // in seconds (30 min)
    , keys : JSON.parse(fs.readFileSync(process.cwd()+'/config/keys.json', encoding='utf8'))
    , multipleDecoders: true
    , listenerLimit: 100
    });
  });
}