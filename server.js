/**
 * Original example at: https://github.com/TooTallNate/node-icecast-stack/blob/master/examples/simpleProxy/proxy.js
 * Modified by me (Pedro Mateus Tavares) for my personal needs.
 
 * This example script demonstrates a basic proxy of the audio and metadata
 * through a Node HTTP server. The command-line tools `lame` and `oggenc` are
 * required for this to work. Invoking this script will start the HTTP server
 * on port 9000. If the browser requests:
 *
 *    "/stream"     - Returns the raw PCM data from the transcoded input radio stream.
 *    "/stream.mp3" - Returns the radio stream, fed through `lame` and sent to the
 *                    client as MP3 audio data.
 *    "/stream.ogg" - Returns the radio stream, fed through `oggenc` and sent to
 *                    the client as OGG Vorbis audio data.
 */
require("colors");
var fs = require("fs");
var util = require("util");
var http = require("http");
var spawn = require("child_process").spawn;
var icecast = require("icecast-stack");
var nodeStatic = require('node-static');
var faye = require('faye');
var domain = 'stream.pedromtavares.com'
var port = '10000';
var url = 'http://' + domain + ':' + port;

// Connect to the remote radio stream, and pass the raw audio data to any
// client requesting the "/stream" URL (will be an <audio> tag).
//var stream = require('icecast-stack/client').createClient(station.url);
var stream = require('radio-stream').createReadStream(url);
var streamOnline = false;


// Decode the MP3 stream to raw PCM data, signed 16-bit Little-endian
var pcm = spawn("lame", [
  "-S", // Operate silently (nothing to stderr)
  "--mp3input", // Decode the MP3 input
  "-", // Input from stdin
  "--decode",
  "-t", // Don't include WAV header info (i.e. output raw PCM)
  "-s", "44,1", // Sampling rate: 48,000
  "--bitwidth", "16", // Bits per Sample: 16
  "--signed", "--little-endian", // Signed, little-endian samples
  "-" // Output to stdout
]);
stream.on("data", function(chunk) {
  pcm.stdin.write(chunk);
});

// A simple "Burst-on-Connect" implementation. We'll store the previous 2mb
// of raw PCM data, and send it each time a new connection is made.
var bocData = [];
var bocSize = 2097152; // 2mb in bytes
pcm.stdout.on("data", function(chunk) {
  while (currentBocSize() > bocSize) {
    bocData.shift();
  }
  bocData.push(chunk);
});
function currentBocSize() {
  var size = 0, i=0, l=bocData.length;
  for (; i<l; i++) {
    size += bocData[i].length;
  }
  return size;
}

// I'm using Faye to exchange messages with the client, such as which is the current track playing (instead of the example's original polling through constant AJAX requests)
var bayeux = new faye.NodeAdapter({
  mount: '/faye',
  timeout: 45
});


function publish(track){
  if (!streamOnline){
    track = 'offline';
  }
  bayeux.getClient().publish('/track', {
    track: track
  });
}

// Keep track of the current track playing, which gets updated when the stream receives metadata.
var currentTrack;
stream.on("metadata", function(metadata) {
  currentTrack = icecast.parseMetadata(metadata).StreamTitle;
  publish(currentTrack);
  console.error(("Received 'metadata' event: ".bold + currentTrack).blue);
});


stream.on("connect", function() {
  // Request the stream to see if there is a song playing, this way we can immediately message the user that the stream is offline because as soon as /stream.ogg or /stream.mp3 is requested, publish() is called
  var request = http.createClient(port, domain).request('GET', "/currentsong?sid=1", {});
  request.on('response', function(response) {
        response.on('data', function(data) {
                streamOnline = true;
                currentTrack = ""+data;
                console.error("Stream successfully connected!".green.italic.bold);
        });
  });
  request.end();
});


// Now we create the HTTP server.
http.createServer(function(req, res) {
  
  bayeux.attach(this);
  
  stream.on('close', function() {
    publish('offline');
    streamOnline = false;
    console.error(("Connection to was closed!").red.bold);
  });

  // Does the client support icecast metadata?
  var acceptsMetadata = req.headers['icy-metadata'] == 1;

  // If the client simply requests '/', then send back the raw PCM data.
  // I use this for debugging; piping the output to other command-line encoders.
  if (req.url == "/stream") {
    var connected = function() {
      var headers = {};
      for (var key in stream.headers) {
        if (key == 'icy-metaint') continue;
        headers[key] = stream.headers[key];
      }
      res.writeHead(200, headers);
      var callback = function(chunk) {
        res.write(chunk);
      }
      pcm.stdout.on("data", callback);
      req.connection.on("close", function() {
        // This occurs when the HTTP client closes the connection.
        pcm.stdout.removeListener("data", callback);
      });      
    }
    if (stream.headers) {
      connected();
    } else {
      stream.on("response", connected);
    }

  // If "/stream.mp3" is requested, fire up an MP3 encoder (lame), and start
  // streaming the MP3 data to the client.
  } else if (req.url == "/stream.mp3") {
    
    publish(currentTrack);
    if (!streamOnline){
      req.connection.emit('close');
    }
    
    var headers = {
      "Content-Type": "audio/mpeg",
      "Connection": "close",
      "Transfer-Encoding": "identity"
    };
    if (acceptsMetadata) {
      headers['icy-name'] = stream.headers['icy-name'];
      headers['icy-metaint'] = 10000;
    }
    res.writeHead(200, headers);
    
    if (acceptsMetadata) {
      res = new icecast.IcecastWriteStack(res, 10000);
      res.queueMetadata(currentTrack);
      var metadataCallback = function(metadata) {
        res.queueMetadata(metadata);
      }
      stream.on('metadata', metadataCallback);
    }

    var mp3 = spawn("lame", [
      "-S", // Operate silently (nothing to stderr)
      "-r", // Input is raw PCM
      "-s", "44,1", // Input sampling rate: 48,000
      "-", // Input from stdin
      "-" // Output to stderr
    ]);
    mp3.on("exit", function(exitCode) {
      console.error("mp3.onExit: "+ exitCode);
    });
    mp3.on("error", function(error) {
      console.error("mp3.onError: ", error);
    });
    mp3.stdin.on("error", function(error) {
      console.error("mp3.stdin.onError: ", error);
    });
    mp3.stdout.on("error", function(error) {
      console.error("mp3.stdout.onError: ", error);
    });
    mp3.stdout.on("data", function(chunk) {
      res.write(chunk);
    });

    // First, send what's inside the "Burst-on-Connect" buffers.
    if (streamOnline){
      for (var i=0, l=bocData.length; i<l; i++) {
        mp3.stdin.write(bocData[i]);
      }
    }
    

    // Then start sending the incoming PCM data to the MP3 encoder
    var callback = function(chunk) {
      mp3.stdin.write(chunk);
    }
    pcm.stdout.on("data", callback);

    req.connection.on("close", function() {
      // This occurs when the HTTP client closes the connection.
      pcm.stdout.removeListener("data", callback);
      mp3.kill();
      if (metadataCallback) {
        stream.removeListener('metadata', metadataCallback);
      }
    });

  // If "/stream.ogg" is requested, fire up an OGG encoder (oggenc), and start
  // streaming the OGG vorbis data to the client.
  } else if (req.url == "/stream.ogg") {
    publish(currentTrack);
    if (!streamOnline){
      req.connection.emit('close');
    }

    var headers = {
      "Content-Type": "application/ogg",
      "Connection": "close",
      "Transfer-Encoding": "identity"
    };
    if (acceptsMetadata) {
      headers['icy-name'] = stream.headers['icy-name'];
      headers['icy-metaint'] = 10000;
    }
    res.writeHead(200, headers);
    
    if (acceptsMetadata) {
      res = new icecast.IcecastWriteStack(res, 10000);
      res.queueMetadata(currentTrack);
      var metadataCallback = function(metadata) {
        res.queueMetadata(metadata);
      }
      stream.on('metadata', metadataCallback);
    }

    var ogg = spawn("oggenc", [
      "--silent", // Operate silently (nothing to stderr)
      "-r", // Raw input
      "--ignorelength", // Ignore length
      "--raw-rate=44100", // Raw input rate: 48000
      "-" // Input from stdin, Output to stderr
    ]);
    ogg.on("exit", function(exitCode) {
      console.error("ogg.onExit: "+ exitCode);
    });
    ogg.on("error", function(error) {
      console.error(error);
    });
    ogg.stdin.on("error", function(error) {
      console.error("ogg.stdin.onError: ", error);
    });
    ogg.stdout.on("error", function(error) {
      console.error("ogg.stdout.onError: ", error);
    });
    ogg.stdout.on("data", function(chunk) {
      res.write(chunk);
    });

    // First, send what's inside the "Burst-on-Connect" buffers.
    if (streamOnline){
      for (var i=0, l=bocData.length; i<l; i++) {
        ogg.stdin.write(bocData[i]);
      }
    }
    

    // Then start sending the incoming PCM data to the OGG encoder
    var callback = function(chunk) {
      ogg.stdin.write(chunk);
    }
    pcm.stdout.on("data", callback);

    req.connection.on("close", function() {
      // This occurs when the HTTP client closes the connection.
      pcm.stdout.removeListener("data", callback);
      ogg.kill();
      if (metadataCallback) {
        stream.removeListener('metadata', metadataCallback);
      }
    });

  // Return the currentTrack in plain text
  } else if (req.url == "/track") {
    if (!currentTrack){
      currentTrack = icecast.parseMetadata(metadata).StreamTitle;
    }
    res.writeHead(200, {'Content-Type': 'text/plain'})
    res.end(currentTrack);
  // Return stream status in plain text
  } else if (req.url == "/status"){
    var result = streamOnline ? "online" : "offline";
    res.writeHead(200, {'Content-Type': 'text/plain'})
    res.end(result);
    
  // Otherwise serve static files.
    }else {
      var file = new nodeStatic.Server('./public', {
        cache: false
      });
      file.serve(req, res);
    }

}).listen(9000, function() {
  console.error(("HTTP Icecast proxy server listening at: ".bold + "http://*:" + this.address().port).cyan);
});

