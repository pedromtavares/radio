var assert = require('assert');
var Stream = require('stream').Stream;
var StreamStack = require('../').StreamStack;

// Calling `new StreamStack(stream)` on a Stream with a direct property 'emit'
// needs to be accounted for, since the StreamStack constructor monkey-patches
// the Stream's 'emit' itself.
exports['stream-with-monkey-patched-emit'] = function() {
  var stream = new Stream();

  var gotEmit = false;
  stream.emit = function(name) {
    gotEmit = true;
    return Stream.prototype.emit.apply(this, arguments);
  }

  var gotTest = false;
  stream.on('test', function() {
    gotTest = true;
  });

  var stack = new StreamStack(stream);

  stream.emit('test');
  assert.ok(gotEmit);
  assert.ok(gotTest);
}

