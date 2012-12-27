
var commands = [
  'get',
  'set',
  'delete',
  'add',
  'replace',
  'append',
  'prepend',
  'cas',
  'increment',
  'decrement',
  'samples'
];


var findCallback = function(args) {
  for(var i = 0; i < args.length; i++)
    if(typeof args[i] === 'function') return i;
};


module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;                                                                                                                                                                           
  var samples = nt.tools.samples;
  var type = 'Memcached';

  // connect
  proxy.after(obj.Client.prototype, 'connect', function(obj, args, ret) {
    obj.__trace__ = samples.stackTrace();
    obj.__time__ = samples.time(type, "connect");
  });

  proxy.before(obj.Client.prototype, 'on', function(obj, args) {
    var client = obj;
    var event = args[0];
    if(event !== 'connect' && event !== 'timeout' && event !== 'error') return;

    proxy.callback(args, -1, function(obj, args) {
      var time = client.__time__;
      if(!time || !time.done(proxy.hasError(args))) return;
      if(samples.skip(time)) return;

      var error = undefined;
      if(event === 'timeout') {
        error = 'socket timeout';
      }
      else if(event === 'error') {
        error = proxy.getErrorMessage(args);
      }

      var command = 'connect';
      var sample = samples.sample();
      sample['Type'] = type;
      sample['Connection'] = {host: client.host, port: client.port};
      sample['Command'] = command;
      sample['Stack trace'] = client.__trace__;
      sample['Error'] = error;
      sample._group = type + ': ' + command;
      sample._label = type + ': ' + command;

      samples.add(time, sample);
    });
  });
 

  // commands
  commands.forEach(function(command) {
    proxy.before(obj.Client.prototype, command, function(obj, args) {
      var client = obj;
      var trace = samples.stackTrace();
      var params = args;
      var time = samples.time(type, command);

      // there might be args after callback, need to do extra callback search
      var pos = findCallback(args);
      if(pos == undefined) return;

      proxy.callback(args, pos, function(obj, args) {
        if(!time.done(proxy.hasError(args))) return;
        if(samples.skip(time)) return;

        var error = proxy.getErrorMessage(args);
        var sample = samples.sample();
        sample['Type'] = 'Memcached';
        sample['Connection'] = {host: client.host, port: client.port};
        sample['Command'] = command;
        sample['Arguments'] = samples.truncate(params);
        sample['Stack trace'] = trace;
        sample['Error'] = error;
        sample._group = type + ': ' + command;
        sample._label = type + ': ' + command;

        samples.add(time, sample);
      });
    });
  });
};

