var assert = require('assert');
var fakeDuplexStream = require('../util').fakeDuplexStream;

exports['test fakeDuplexStream write()'] = function() {
  var streams = fakeDuplexStream();
  var client = streams[0];
  var server = streams[1];
  var gotClientData = false;
  var gotServerData = false;
  
  server.on('data', function(chunk) {
    gotServerData = true;
    assert.equal(chunk, 'hello server');
    assert.ok(Buffer.isBuffer(chunk));
  });
  
  client.on('data', function(chunk) {
    gotClientData = true;
    assert.equal(chunk, 'hello client');
    assert.ok(Buffer.isBuffer(chunk));
  });
  
  assert.ok(!gotServerData);
  client.write('hello server');
  assert.ok(gotServerData);
  
  assert.ok(!gotClientData);
  server.write('hello client');
  assert.ok(gotClientData);
}

exports['test fakeDuplexStream end()'] = function() {
  var streams = fakeDuplexStream();
  var client = streams[0];
  var server = streams[1];
  var gotClientEnd = false;
  var gotServerEnd = false;
  
  server.on('end', function() {
    gotServerEnd = true;
  });
  client.on('end', function() {
    gotClientEnd = true;
  });
  
  assert.ok(!gotServerEnd);
  client.end();
  assert.ok(gotServerEnd);
  
  assert.ok(!gotClientEnd);
  server.end();
  assert.ok(gotClientEnd);
}

exports['test fakeDuplexStream readable writable'] = function() {
  var streams = fakeDuplexStream();
  var client = streams[0];
  var server = streams[1];
  
  assert.ok(client.readable);
  assert.ok(client.writable);
  assert.ok(server.readable);
  assert.ok(server.writable);
  
  client.end();
  
  assert.ok(client.readable);
  assert.ok(!client.writable);
  assert.ok(!server.readable);
  assert.ok(server.writable);
  
  server.end();
  
  assert.ok(!client.readable);
  assert.ok(!client.writable);
  assert.ok(!server.readable);
  assert.ok(!server.writable);
}
