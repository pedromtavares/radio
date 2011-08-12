var Stream = require('stream').Stream;

/**
 * StreamStack
 * -----------
 * Turns low-level `Stream` objects into stackable stream, meant
 * to fill out your desired protocol stack. But also allow for
 * the protocol to be implemented independent of the underlying
 * transport.
 *   An example overall stack could look like:
 *     - net.Stream                           <- TCP Layer
 *     - HttpRequestStack                     <- HTTP Layer
 *       - `write()`s an HTTP request upstream
 *       - Response comes back with 'gzip' transfer-encoding
 *     - GzipDecoderStack                     <- Decoding Layer
 *     - `.pipe()` into a 'fs.WriteStream'    <- Save to a File
 */
function StreamStack(stream, events) {
  if (!(stream instanceof Stream)) {
    throw new Error("StreamStack expects an instance of 'Stream' as an argument!");
  }
  if (!(this instanceof StreamStack)) {
    return new StreamStack(stream, events);
  }

  Stream.call(this);

  // If this is the first time the parent stream has been used in a
  // StreamStack, then a StackEmitter will need to be injected into the stream.
  if (!stream._stackEmitter) {
    StackEmitter.call(stream);
  }
  stream._stacks.push(this);
  
  // A reference to the parent stream for event handlers, etc.
  this.stream = stream;

  // TODO: Remove, if I can find a good reason to.
  events = events || {};
  if (!('data' in events))
    events.data = proxyEvent('data');
  if (!('end' in events))
    events.end = proxyEvent('end');
  if (!('error' in events))
    events.error = proxyEvent('error');
  if (!('close' in events))
    events.close = proxyEvent('close');
  if (!('fd' in events))
    events.fd = proxyEvent('fd');
  if (!('drain' in events))
    events.drain = proxyEvent('drain');
  
  // If the StreamStack instance intends on intercepting events emitted from
  // the parent stream, then the handlers need to be passed as a second 'events'
  // object in the constructor. It takes care of attaching them to the parent
  // stream. Handlers are invoked in 'this' StreamStack instance.
  if (events) {
    this._stackEvents = {};
    for (var ev in events) {
      this._stackEvents[ev] = events[ev].bind(this);
      stream.on(ev, this._stackEvents[ev]);
    }
  }
  
}
require('util').inherits(StreamStack, Stream);
exports.StreamStack = StreamStack;

// By default, just proxy all the standard ReadStream and WriteStream
// functions upstream. If the StreamStack implementation needs to overwrite
// or augment any of the behavior, then simply overwrite that function.
//   The most common is to augment the 'write()' function, such that the
//   passed data goes through some kind of filter before being passed to
//   the parent stream.
StreamStack.prototype.write = function(buf, type) {
  return this.stream.write(buf, type);
}
StreamStack.prototype.end = function(buf, type) {
  if (buf) {
    this.write(buf, type);
  }
  return this.stream.end();
}
StreamStack.prototype.pause = function() {
  if (this.stream.pause) {
    return this.stream.pause();
  } else {
    return this.stream.emit('pause');
  }
}
StreamStack.prototype.resume = function() {
  if (this.stream.resume) {
    return this.stream.resume();
  } else {
    return this.stream.emit('resume');
  }
}
StreamStack.prototype.destroy = function(error) {
  return this.stream.destory(error);
}

// The 'cleanup()' function should be called after a StreamStack instance is
// finished doing it's "thing", to cleanly allow another new StreamStack
// instance to be attached to the parent Stream.
StreamStack.prototype.cleanup = function() {
  // Remove 'this' from the parent Stream's '_stacks' Array
  var index = this.stream._stacks.indexOf(this);
  this.stream._stacks.splice(index, 1);
  // Set 'this.stream' to null.
  // If any events were binded through the constructor, they get unbinded here
  if (this._stackEvents) {
    for (var ev in this._stackEvents) {
      this.stream.removeListener(ev, this._stackEvents[ev]);
    }
    this._stackEvents = null;
  }
  // TODO: Maybe 'delete' instead? Is there any benefit?
  this.stream = null;
}

// By default, the 'readable' and 'writable' property lookups get proxied
// to the parent stream. You can set the variables if needed, and to relinquish
// control of the variable back upstream, set it to `undefined`.
Object.defineProperty(StreamStack.prototype, "readable", {
  get: function() {
    if (this._readable != undefined) {
      return this._readable;
    }
    return this.stream.readable;
  },
  set: function(value) {
    this._readable = value;
  },
  enumerable: true
});
Object.defineProperty(StreamStack.prototype, "writable", {
  get: function() {
    if (this._writable != undefined) {
      return this._writable;
    }
    return this.stream.writable;
  },
  set: function(value) {
    this._writable = value;
  },
  enumerable: true
});

// Walks up the 'stream' properties until it finds and returns the top-most
// stream. i.e. it gets the low-level stream this stack is based on.
Object.defineProperty(StreamStack.prototype, "topStream", {
  get: function() {
    var rtn = this.stream;
    while (rtn.stream) {
      rtn = rtn.stream;
    }
    return rtn;
  },
  enumerable: true
});

// Stupid workaround. Attach a listener for the given 'eventName'.
// The callback simply re-emits the events and all arguments on 'this'.
function proxyEvent(eventName) {
  return function() {
    var args = [eventName];
    args = args.concat(args.slice.call(arguments));
    this.emit.apply(this, args);
  }
}


// Parent streams need to have StackEmitter called on them the first time a
// StreamStack instance is attempting to use it. The __proto__ of the parent
// stream will be injected with StackEmitter's prototype, to benefit from
// the overwritten 'emit()' function.
function StackEmitter() {
  // The Array that holds the active StreamStack instances on a parent Stream.
  this._stacks = [];
  // Get a reference to the original 'emit' function, since we're about to
  // monkey-patch with our own 'emit' function.
  this._origEmit = this.emit;
  // Mix-in the rest of the StackEmitter properties.
  for (var prop in StackEmitter.prototype) {
    this[prop] = StackEmitter.prototype[prop];
  }
}

// A flag to indicate that the parent stream has already been injected.
StackEmitter.prototype._stackEmitter = true;

// The custom 'emit()' function is responsible for iterating through the list
// of active StreamStack instances, and IFF the StreamStack instance didn't
// pass a handler to the current event, it should re-emit on the child as well.
StackEmitter.prototype.emit = function(eventName) {
  var stack;
  // Emit on the parent Stream first
  var rtn = this._origEmit.apply(this, arguments);
  // Next re-emit on all the active StreamStack instances (if any)
  for (var i=0, l=this._stacks.length; i<l; i++) {
    stack = this._stacks[i];
    if (!stack._stackEvents || !(eventName in stack._stackEvents)) {
      if (!stack.emit.apply(stack, arguments)) {
        rtn = false;
      }
    }
  }
  return rtn;
}
