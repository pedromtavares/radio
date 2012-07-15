node-throttle
=============
### Throttle node Stream instances with "Bytes per Second".

This micro-module offers a `throttle(bytesPerSecond)` Function, which is compatible
with [node][NodeJS] `Stream` instances. It can be useful for throttling HTTP uploads
or to simulate reading from a file in real-time, etc.


Usage
-----

    var throttle = require('throttle'); // Extends `Stream.prototype`
    
    var bytesPerKilobyte = 1024;
    var unthrottle = throttle(process.stdin, 100 * bytesPerKilobyte);
    
    // "data" events from 'stdin' will only arrive at a rate of 100kbps...
    process.stdin.resume();

    // to remove the throttling, invoke the function returned from 'throttle'
    unthrottle();

That's it!

Installation
------------

    npm install throttle


[NodeJS]: http://nodejs.org
