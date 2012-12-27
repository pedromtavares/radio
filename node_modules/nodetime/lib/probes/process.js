
module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;

  var bytesToStdout = 0;
  var bytesToStderr = 0;
  var uncaughtExceptions = undefined;

  nt.setInterval(function() {
    nt.metric('Process', 'Data written to STDOUT per minute', bytesToStdout / 1000, 'KB', 'avg');
    nt.metric('Process', 'Data written to STDERR per minute', bytesToStderr / 1000, 'KB', 'avg');
    bytesToStdout = bytesToStderr = 0;

    if(uncaughtExceptions !== undefined) {
      nt.metric('Process', 'Uncaught exceptions', uncaughtExceptions, undefined, 'avg');
      uncaughtExceptions = 0;
    }
  }, 60000);

  proxy.before(obj.stdout, ['write', 'end'], function(obj, args) {
    bytesToStdout += calculateSize(args[0]);
  });

  if(obj.stdout !== obj.stderr) {
    proxy.before(obj.stderr, ['write', 'end'], function(obj, args) {
      bytesToStderr += calculateSize(args[0]);
    });
  }

  proxy.before(obj, ['on', 'addListener'], function(obj, args) {
    if(args[0] !== 'uncaughtException') return;

    if(uncaughtExceptions === undefined) {
      uncaughtExceptions = 0;
    }

    proxy.callback(args, -1, function(obj, args) {
      uncaughtExceptions++;
    });
  });
};


function calculateSize(args) {
  if(args.length < 1) return 0;

  return args[0].length || 0; // approximate for strings
}

