var assert = require('assert');
var Stream = require('stream').Stream;
var StreamStack = require('../').StreamStack;

exports['no-handlers'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream);
  
  var oldEmit = stack.emit;
  var numEmits = 0;
  stack.emit = function() {
    switch(numEmits++) {
      case 0:
        assert.equal('event', arguments[0]);
        break;
      case 1:
        assert.equal('data', arguments[0]);
        assert.equal('Hello World!', arguments[1]);
        break;
      case 2:
        assert.equal('end', arguments[0]);
        break;
    }
    return oldEmit.apply(stack, arguments);
  }
  
  stream.emit('event');
  stream.emit('data', new Buffer('Hello World!'));
  stream.emit('end');
}

exports['with-empty-data-handler'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream, {
    data: function(chunk) {}
  });
  
  var gotData = false;
  stack.on('data', function() {
    gotData = true;
  });
  
  stream.emit('data', 'test');
  assert.equal(false, gotData);
}

exports['with-emitting-data-handler'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream, {
    data: function(chunk) {
      this.emit('data', chunk);
    }
  });
  
  var gotData = false;
  stack.on('data', function() {
    gotData = true;
  });
  
  stream.emit('data', 'test');
  assert.equal(true, gotData);
}

exports['with-crazy-event-name'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream);
  
  var gotZyx = false;
  stack.on('zyx', function() {
    gotZyx = true;
  });
  
  stream.emit('zyx');
  assert.equal(true, gotZyx);
}
