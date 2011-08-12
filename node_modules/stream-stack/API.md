# API

## var ss = require('stream-stack')

The main module (`stream-stack`) contains the primary constructor function for StreamStacks.

### var streamStack = new ss.StreamStack(stream, [events])

Creates a new `StreamStack` instance. "stream" must be an instance of `Stream` (i.e. `net.Socket`,
`fs.ReadStream`, `fs.WriteStream`, `http.{Clinet,Server}{Request,Response}`, etc..), which will be
the "parent" stream of the new instance.

The optional "events" arg should be an Object with keys being the names of events that _WILL NOT_
be re-emitted on the new instance, and values being Functions that will be called instead when the
event is emitted. This gives the opportunity for subclasses to intercept event in order to perform
some filter or transformation first.

Usually, the `StreamStack` class is subclassed, rather than directly instantiated. A bare instance
of "StreamStack" will re-emit all events from it's parent Stream, and any `write()` calls on the
instance will be proxied up to the parent Stream.

    var parent = require('fs').createReadStream(__filename);
    var streamStack = new ss.StreamStack(parent, {
      data: function(chunk) {
        // Re-emit every other byte from the parent to `this`
        for (var i=0, l=chunk.length; i<l; i+=2) {
          this.emit('data', chunk[i]);
        }
      }
    });

### streamStack.stream

Provides an accessor for the "parent" stream. i.e. The `Stream` instance that was passed into
the constructor.

    streamStack.stream === parent;
      // returns true

### streamStack.topStream

Provides an accessor to the top-level `Stream` instance of the overall "stack". Since any number
of `StreamStack` instances can be stacked on top of each other, this ensures that the _first_
Stream is accessible.

    streamStack.topStream === streamStack.stream;
      // returns true
    var another = new ss.StreamStack(streamStack);
    another.topStream === another.stream;
      // returns false
    another.stream === streamStack;
      // returns true

### streamStack.cleanup()

Detaches the `StreamStack` instance from it's parent Stream. This should be called (usually, by a
subclass) when you're finished with the instance, and desire it to be garbage collected. After
calling this method, events from the parent stream will no longer be proxied to the stream stack
instance.

    ss.cleanup();
    ss.stream;
      // returns null
