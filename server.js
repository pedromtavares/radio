/**
 * Original example at: https://github.com/TooTallNate/node-icecast-stack/blob/master/examples/simpleProxy/proxy.js
 * The command-line tools `lame` and `oggenc` are required for this app to work. 
 * If the browser requests:
 *    "/config"     - Returns the server configurations needed for client connection (just the port atm).
 *    "/dj"         - Returns the current DJ playing the stream.
 *    "/track"      - Returns the current track being played.
 *    "/stream.mp3" - Returns the radio stream, fed through `lame` and sent to the client as MP3 audio data.
 *    "/stream.ogg" - Returns the radio stream, fed through `oggenc` and sent to the client as OGG Vorbis audio data.
 */

var Radio = require('./lib/radio');

new Radio({
  url: "http://stream.pedromtavares.com:10000",
  port: 9000,
  reconnectTime: 60 // in seconds
});
