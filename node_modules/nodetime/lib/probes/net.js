
module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;

  var bytesWritten = 0;
  var bytesRead = 0;

  nt.setInterval(function() {
    nt.metric('Network', 'Data sent per minute', bytesWritten / 1000, 'KB', 'avg');
    nt.metric('Network', 'Data received per minute', bytesRead / 1000, 'KB', 'avg');

    bytesWritten = bytesRead = 0;
  }, 60000);


  proxy.after(obj, ['connect', 'createConnection'], function(obj, args, ret) {
    var socket = ret;
    var lastBytesWritten = 0;
    var lastBytesRead = 0;
    var currentBytesWritten = 0;
    var currentBytesRead = 0;

    proxy.before(ret, ['write', 'end'], function(obj, args) {
      currentBytesWritten = socket.bytesWritten || 0;
      bytesWritten += currentBytesWritten - lastBytesWritten;
      nt.appData.bytesWritten += currentBytesWritten - lastBytesWritten;
      lastBytesWritten = currentBytesWritten;
    });
  
    proxy.before(ret, 'on', function(obj, args) {
      if(args.length < 1 || args[0] !== 'data') return;
  
      proxy.callback(args, -1, function(obj, args) {  
        currentBytesRead = socket.bytesRead || 0;
        bytesRead += currentBytesRead - lastBytesRead;
        nt.appData.bytesRead += currentBytesRead - lastBytesRead;
        lastBytesRead = currentBytesRead;
      });
    });
  });
};

