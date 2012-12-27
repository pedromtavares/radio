
module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;
  var samples = nt.tools.samples;
  var type = 'Cassandra';

  // connect
  [obj.Connection.prototype, obj.PooledConnection.prototype].forEach(function(proto) {
    proxy.before(proto, 'connect', function(obj, args) {
      var client = obj;
      var trace = samples.stackTrace();
      var time = samples.time(type, 'connect');

      proxy.callback(args, -1, function(obj, args) {
        if(!time.done(proxy.hasError(args))) return;
        if(samples.skip(time)) return;

        var error = proxy.getErrorMessage(args);
        var sample = samples.sample();
        sample['Type'] = type;
        sample['Connection'] = connection(client);
        sample['Command'] = 'connect';
        sample['Stack trace'] = trace;
        sample['Error'] = error;
        sample._group = type + ': connect';
        sample._label = type + ': connect';

        samples.add(time, sample);
      });
    });
  });


  // execute
  [obj.Connection.prototype, obj.PooledConnection.prototype].forEach(function(proto) {
    proxy.before(proto, 'execute', function(obj, args) {
      var client = obj;
      var trace = samples.stackTrace();
      var command = args.length > 0 ? args[0] : undefined;
      var params = args.length > 1 && Array.isArray(args[1]) ? args[1] : undefined;
      var time = samples.time(type, 'execute');

      proxy.callback(args, -1, function(obj, args) {
        if(!time.done()) return;
        if(samples.skip(time)) return;

        var error = args.length > 0 ? (args[0] ? args[0].message : undefined) : undefined;
        var sample = samples.sample();
        sample['Type'] = type;
        sample['Connection'] = connection(client);
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


var connection = function(client) {
  var connection = undefined;

  if(client.connectionInfo) {
    connection = {
      host: client.connectionInfo.host,
      port: client.connectionInfo.port,
      keyspace: client.connectionInfo.keyspace,
      user: client.connectionInfo.user
    };
  }
  else if(client.connections && client.connections.length > 0) {
    connection = [];
    conn.connections.forEach(function(conn) {
      connection.push({
        host: conn.host,
        port: conn.port,
        keyspace: conn.keyspace,
        user: conn.user
      });
    });
  }

  return connection;
};

