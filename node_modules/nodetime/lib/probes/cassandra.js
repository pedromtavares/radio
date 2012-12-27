
var commands = [
  'get',
  'count',
  'set',
  'remove',
  'truncate',
  'use',
  'addKeySpace',
  'dropKeySpace'
];

module.exports = function(nt, obj) {
  // not tested, skip
  return;

  var proxy = nt.tools.proxy;
  var samples = nt.tools.samples;
  var type = 'Cassandra';

  commands.forEach(function(command) {
    proxy.before(obj.ColumnFamily.prototype, command, function(obj, args) {
      var cf = obj;
      var trace = samples.stackTrace();
      var params = args.length > 1 && Array.isArray(args[1]) ? args[1] : undefined;
      var time = samples.time(type, command);

      proxy.callback(args, -1, function(obj, args) {
        if(!time.done(proxy.hasError(args)))) return;
        if(samples.skip(time)) return;

        var error = proxy.getErrorMessage(args);
        var sample = samples.sample();
        sample['Type'] = type;
        sample['Connection'] = {host: cf.client_.host, port: cf.client_.port, keyspace: cf.client_.keyspace, columnFamily: cf.name};
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

