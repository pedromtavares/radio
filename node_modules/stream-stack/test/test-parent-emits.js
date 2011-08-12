var assert = require('assert');
var Stream = require('stream').Stream;
var StreamStack = require('../').StreamStack;

exports['check-both-parent-and-streamstack-get-data-event'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream);
  
  var gotParentData = false;
  stream.on('data', function() {
    gotParentData = true;
  });
  var gotStackData = false;
  stack.on('data', function() {
    gotStackData = true;
  });
  
  stream.emit('data', new Buffer('Hello World!'));
  
  assert.equal(true, gotParentData);
  assert.equal(true, gotStackData);
}

exports['check-with-empty-streamstack-data-handler'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream, {
    data: function() {}
  });
  
  var gotParentData = false;
  stream.on('data', function() {
    gotParentData = true;
  });
  var gotStackData = false;
  stack.on('data', function() {
    gotStackData = true;
  });
  
  stream.emit('data', new Buffer('Hello World!'));
  
  assert.equal(true, gotParentData);
  assert.equal(false, gotStackData);
}

exports['check-with-proxying-streamstack-data-handler'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream, {
    data: function() {
      this.emit('data');
    }
  });
  
  var gotParentData = false;
  stream.on('data', function() {
    gotParentData = true;
  });
  var gotStackData = false;
  stack.on('data', function() {
    gotStackData = true;
  });
  
  stream.emit('data', new Buffer('Hello World!'));
  
  assert.equal(true, gotParentData);
  assert.equal(true, gotStackData);
}
