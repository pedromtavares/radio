var Stream = require('stream').Stream;

/**
 * "fakeDuplexStream" is meant to be used in testing StreamStack subclasses.
 * It simulates both ends (client and server) of a full-duplex `net.Stream`
 * connection, without acutally using any real TCP connections. Everything is
 * done in V8's memory.  Usage:
 *
 *    var streams = require('stream-stack/util').fakeDuplexStream();
 *    var client = new HttpRequestStack(streams[0]);
 *    var server = new HttpResponseStack(streams[1]);
 *
 */
function fakeDuplexStream() {
  var conn1 = new Stream();
  var conn2 = new Stream();
  setupFakeStream(conn1, conn2);
  setupFakeStream(conn2, conn1);
  return [conn1, conn2];
}
exports.fakeDuplexStream = fakeDuplexStream;

function setupFakeStream(readable, writable) {
  var encoding;
  var paused = false;
  var backlog = [];
  
  readable.readable = true;
  readable.setEncoding = function(enc) {
    encoding = enc;
  }
  readable.pause = function() {
    paused = true;
  }
  readable.resume = function() {
    paused = false;
    backlog.forEach(function(chunk) {
      readable.emit('data', encoding ? chunk.toString(encoding) : chunk);
    });
    backlog = [];
  }

  writable.writable = true;
  writable.write = function(chunk, enc) {
    if (!Buffer.isBuffer(chunk)) {
      chunk = new Buffer(chunk, enc);
    }
    if (paused) {
      backlog.push(chunk);
      return false;
    } else {
      readable.emit('data', encoding ? chunk.toString(encoding) : chunk);
      return true;      
    }
  }
  writable.end = function(chunk, enc) {
    if (chunk) this.write(chunk, enc);
    writable.writable = readable.readable = false;
    readable.emit('end');
  }
}
