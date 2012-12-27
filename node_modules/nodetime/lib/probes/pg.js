
module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;
  var samples = nt.tools.samples;
  var type = 'PostgreSQL';

  function probe(obj) {
    if(obj.__probeInstalled__) return;
    obj.__probeInstalled__ = true;

    // Callback API
    proxy.before(obj, 'query', function(obj, args, ret) {
      var client = obj;
      var trace = samples.stackTrace();
      var command = args.length > 0 ? args[0] : undefined;
      var params = args.length > 1 && Array.isArray(args[1]) ? args[1] : undefined;
      var time = samples.time(type, "query");

      proxy.callback(args, -1, function(obj, args) {
        if(!time.done(proxy.hasError(args))) return;
        if(samples.skip(time)) return;

        var error = proxy.getErrorMessage(args);
        var sample = samples.sample();
        sample['Type'] = type;
        sample['Connection'] = {
          host: client.host, 
          port: client.port, 
          user: client.user, 
          database: client.database ? client.database : undefined}; 
        sample['Command'] = samples.truncate(command);
        sample['Arguments'] = samples.truncate(params);
        sample['Stack trace'] = trace;
        sample['Error'] = error;
        sample._group = type + ': query';
        sample._label = type + ': ' + sample['Command'];

        samples.add(time, sample);
      });
    });


    // Evented API
    proxy.after(obj, 'query', function(obj, args, ret) {
      // If has a callback, ignore
      if(args.length > 0 && typeof args[args.length - 1] === 'function') return;

      var client = obj;
      var trace = samples.stackTrace();
      var command = args.length > 0 ? args[0] : undefined;
      var params = args.length > 1 && Array.isArray(args[1]) ? args[1] : undefined;
      var time = samples.time(type, "query");

      proxy.before(ret, 'on', function(obj, args) {
        var event = args[0];
        if(event !== 'end' && event !== 'error') return;

        proxy.callback(args, -1, function(obj, args) {
          if(!time.done(proxy.hasError(args))) return;
          if(samples.skip(time)) return;

          var error = proxy.getErrorMessage(args);
          var sample = samples.sample();
          sample['Type'] = type;
          sample['Connection'] = {
            host: client.host, 
            port: client.port, 
            user: client.user, 
            database: client.database ? client.database : undefined};
          sample['Command'] = samples.truncate(command);
          sample['Arguments'] = samples.truncate(params);
          sample['Stack trace'] = trace;
          sample['Error'] = error;
          sample._group = type + ': query';
          sample._label = type + ': ' + sample['Command'];

          samples.add(time, sample);
        });
      });
    });
  }


  // Native, reinitialize probe 
  proxy.getter(obj, 'native', function(obj, ret) {
    proxy.after(ret, 'Client', function(obj, args, ret) {
      probe(ret.__proto__); 
    });
  });

  probe(obj.Client.prototype);
};

