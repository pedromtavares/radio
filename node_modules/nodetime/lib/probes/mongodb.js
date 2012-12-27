
var internalCommands = [
  '_executeQueryCommand', 
  '_executeInsertCommand', 
  '_executeUpdateCommand', 
  '_executeRemoveCommand'
];

var commandMap = {
  '_executeQueryCommand': 'find', 
  '_executeInsertCommand': 'insert', 
  '_executeUpdateCommand': 'update', 
  '_executeRemoveCommand': 'remove'
};



module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;                                                                                                                                                                           
  var samples = nt.tools.samples;
  var type = 'MongoDB';


  var collsCount = 0;
  var colls = {};
  var collNameRegex = /[^\.\$]+\.([^\.\$]+)/;

  function monitorCollection(host, port, dbName, collName) {
    if(!nt.features.mongodbMetrics) return;

    var m = collNameRegex.exec(collName);
    if(!m || !m[1]) return;
    collName = m[1];

    var address = host + ':' + port + ':' + dbName + ':' + collName;
    if(colls[address] || ++collsCount > 40) return;

    colls[address] = {
      host: host, 
      port: port, 
      dbName: dbName,
      collName: collName
    };
  }

  function done(mClient, err) {
    try {
      if(mClient) mClient.close()
    }
    catch(err2) {
      nt.error(err2);
    }

    if(err) nt.error(err);      
  }

  function loadStats(coll) {
    var mClient = new obj.Db(
      coll.dbName, 
      new obj.Server(coll.host, coll.port, {'auto_reconnect': false, 'poolSize': 1}), 
      {safe: false});
    
    mClient.open(function(err) {
      if(err) return done(mClient, err);

      try {
        mClient.collection(coll.collName, function(err, collection) {
          if(err) return done(mClient, err);

          try {
            collection.stats(function(err, stats) {
              if(err) return done(mClient, err);
              if(!stats) return done(mClient);

              try {
                function metric(label, key, unit) {
                  var numVal = parseFloat(stats[key]);
                  if(typeof(numVal) !== 'number') return;
                  if(unit === 'KB') numVal /= 1000;
   
                  nt.metric(
                    'MongoDB collection ' + 
                      coll.host + ':' + 
                      coll.port + ':' + 
                      coll.dbName + ':' + 
                      coll.collName,                     
                    label, 
                    numVal, 
                    unit,
                    'gauge');
                }

                metric('Object count' ,'count' , null);
                metric('Collection size' ,'size' , 'KB');
                metric('Average object size' ,'avgObjSize' , 'KB');
                metric('Storage size' ,'storageSize' , 'KB');
                metric('Index size' ,'totalIndexSize' , 'KB');
                metric('Padding factor' ,'paddingFactor' , null);

                done(mClient);
              }
              catch(err) {
                done(mClient, err);
              }
            });
          }
          catch(err) {
            done(mClient, err);
          }
        });
      }
      catch(err) {
        done(mClient, err);
      }
    });
  }

  nt.setInterval(function() {
    for(var address in colls) {
      try {
        loadStats(colls[address]);
      }
      catch(err) {
        nt.error(err);
      }
    }
  }, 60000);

  internalCommands.forEach(function(internalCommand) {
    proxy.before(obj.Db.prototype, internalCommand, function(obj, args) {
      var trace = samples.stackTrace();
      var command = (args && args.length > 0) ? args[0] : undefined;
      var time = samples.time(type, commandMap[internalCommand]);

      proxy.callback(args, -1, function(obj, args) {
        if(!time.done()) return;
        if(samples.skip(time)) return;

        var conn = {};
        if(command.db) {
          var servers = command.db.serverConfig;
          if(servers) {
            if(Array.isArray(servers)) {
              conn.servers = [];
              servers.forEach(function(server) {
                conn.servers.push({host: server.host, port: server.port});

                monitorCollection(server.host, server.port, command.db.databaseName, command.collectionName);
              }); 
            }
            else {
              conn.host = servers.host;
              conn.port = servers.port;

              monitorCollection(servers.host, servers.port, command.db.databaseName, command.collectionName);
            }
          }
          
          conn.database = command.db.databaseName;
        }

        var commandName = commandMap[internalCommand];
        var query = command.query ? samples.truncate(JSON.stringify(command.query)) : '{}';
        var error = proxy.getErrorMessage(args);

        var sample = samples.sample();
        sample['Type'] = type;
        sample['Connection'] = conn;
        sample['Command'] = {
          collectionName: command.collectionName, 
          commandName: commandName, 
          query: query, 
          queryOptions: command.queryOptions, 
          numberToSkip: command.numberToSkip,
          numberToReturn: command.numberToReturn};
        sample['Stack trace'] = trace;
        sample['Error'] = error;
        sample._group = type + ': ' + commandName;
        sample._label = type + ': ' + commandName;

        samples.add(time, sample);
      });
    });
  });
};

