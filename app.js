var express = require('express')
  , form = require('connect-form')
  , app = module.exports = express.createServer(form({ keepExtensions: true }));
    
require('./config/environment')(app, express);
require('./config/routes')(app);
require('./helpers/application_helper')(app);

app.listen(app.settings.server.port, app.settings.server.host);

process.addListener('uncaughtException', function (err, stack) {
  console.log('------------------------');
  console.log('Exception: ' + err);
  console.log(err.stack);
  console.log('------------------------');
});