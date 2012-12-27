
var commands = [
  'rename',
  'truncate',
  'chown',
  'fchown',
  'lchown',
  'chmod',
  'fchmod',
  'lchmod',
  'stat',
  'lstat',
  'fstat',
  'link',
  'symlink',
  'readlink',
  'realpath',
  'unlink',
  'rmdir',
  'mkdir',
  'readdir',
  'close',
  'open',
  'utimes',
  'futimes',
  'fsync',
  'write',
  'read',
  'readFile',
  'writeFile',
  'appendFile',
  'exists'
];


module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;
  var samples = nt.tools.samples;
  var type = 'File System';

  commands.forEach(function(command) {
    proxy.before(obj, command, function(obj, args) {
      var trace = samples.stackTrace();
      var params = args;
      var time = samples.time(type, command);

      proxy.callback(args, -1, function(obj, args) {
        if(!time.done(proxy.hasError(args))) return;
        if(samples.skip(time)) return;

        var error = proxy.getErrorMessage(args);
        var sample = samples.sample();
        sample['Type'] = type;
        sample['Command'] = command;
        sample['Arguments'] = samples.truncate(params);
        sample['Stack trace'] = trace;
        sample['Error'] = error;
        sample._group = type + ': ' + command;
        sample._label = type + ': ' + command;

        samples.add(time, sample);
      });
    });

 
    var commandSync = command + 'Sync';
    proxy.around(obj, commandSync, function(obj, args, locals) {
      locals.stackTrace = samples.stackTrace();
      locals.params = args;
      locals.time = samples.time(type, commandSync);

    }, function(obj, args, ret, locals) {
      if(!locals.time.done()) return;
      if(samples.skip(locals.time)) return;

      var sample = samples.sample();
      sample['Type'] = type;
      sample['Command'] = commandSync; 
      sample['Arguments'] = samples.truncate(locals.params);
      sample['Stack trace'] = locals.stackTrace;
      sample._group = type + ': ' + commandSync;
      sample._label = type + ': ' + commandSync;

      samples.add(locals.time, sample);
    });
  });
};

