var assert = require('assert');
var Stream = require('stream').Stream;
var StreamStack = require('../').StreamStack;

exports['topStream-property'] = function() {
  var stream = new Stream();
  var stack = new StreamStack(stream);
  assert.equal(stream, stack.stream);
  assert.equal(stream, stack.topStream);
}

exports['topStream-property-2'] = function() {
  var stream = new Stream();
  var stack1 = new StreamStack(stream);
  var stack2 = new StreamStack(stack1);
  var stack3 = new StreamStack(stack2);
  var stack4 = new StreamStack(stream);
  assert.equal(stream, stack1.topStream);
  assert.equal(stream, stack2.topStream);
  assert.equal(stream, stack3.topStream);
  assert.equal(stream, stack4.topStream);
}
