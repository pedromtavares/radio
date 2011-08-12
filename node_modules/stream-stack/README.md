node-stream-stack
=================
### Filter low-level `Stream` instances into stackable, protocol-based streams.


This module exposes the `StreamStack` interface. It is meant to be subclassed,
using `util.inherits`, in order to implement protocols, or run a Stream's data
through some kind of filter.

By default, a `StreamStack` instance proxies all events downstream (from the
parent stream to the child stream), and proxies all functions calls upstream
(from the child stream to the parent stream). 

Keeping the `StreamStack` subclass' implementation independent of the parent
`Stream` instance allows for the backend transport to be easily swapped out
for flexibility and code re-use.

The overall __*goal*__ of `StreamStack`s is to be able to use it with the holy
grail of the `Stream` object: __*Stream#pipe(writable)*__.

A Simple Example
----------------

Here's a simple, kinda silly example:

    function DoubleWrite(stream) {
      StreamStack.call(this, stream);
    }
    util.inherits(DoubleWrite, StreamStack);
    
    // Overwrite the default `write()` function
    DoubleWrite.prototype.write = function(data) {
      this.stream.write(data);
      this.stream.write(data);
    }
    
    
    // How to Use:
    var doubleStdout = new DoubleWrite(process.stdout);
    doubleStdout.write("this will be printed twice!\n");

We've defined a `DoubleWrite` class. It accepts a writable stream, and
whenever `write()` is called on the DoubleWrite instance, then in return
`write()` get called _twice_ on the parent stream. In this example, our
writable stream, `process.stdout`, will get the string printed to it twice.
