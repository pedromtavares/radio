var express = require('express')
  , form = require('connect-form')
  , app = module.exports = express.createServer(form({ keepExtensions: true }));
    
require('./config/environment')(app, express);
require('./config/routes')(app);
require('./helpers/application_helper')(app);

app.listen(app.settings.server.port, app.settings.server.host);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
// after reserving priviled port, set process to run on a less privileged user
if (app.settings.server.host){
  process.setgid(50);
  process.setuid(1000); 
  console.log("Process now running under user: " + process.getuid());
}

process.addListener('uncaughtException', function (err, stack) {
  console.log('------------------------');
  console.log('Exception: ' + err);
  console.log(err.stack);
  console.log('------------------------');
});