var Server = require('./lib/server');

process.addListener('uncaughtException', function (err, stack) {
  console.log('------------------------');
  console.log('Exception: ' + err);
  console.log(err.stack);
  console.log('------------------------');
});

new Server({
  url: "http://stream.pedromtavares.com:10000",
  port: 8000,
  reconnectTime: 5 // in seconds
});
