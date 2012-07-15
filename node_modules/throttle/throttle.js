module.exports = function throttle(stream, bytesPerSecond) {

  var startTime = Date.now();
  var totalBytes = 0;
  var timeoutId;

  stream.on("data", onData);

  function resume() {
    timeoutId = undefined;
    stream.resume();
  }

  function onData(chunk) {
    totalBytes += chunk.length;
    var totalSeconds = (Date.now() - startTime) / 1000;
    var expected = totalSeconds * bytesPerSecond;
    if (totalBytes > expected) {
      // Use this byte count to calculate how many seconds ahead we are.
      var remainder = totalBytes - expected;
      var sleepTime =  remainder / bytesPerSecond * 1000;
      //if (sleepTime > 40) {
        stream.pause();
        timeoutId = setTimeout(resume, sleepTime);
      //}
    }
  }

  // The return value is a Function that, when invoked, will cancel the throttling behavior
  return function unthrottle() {
    if (timeoutId) clearTimeout(timeoutId);
    stream.removeListener('data', onData);
  }
}
