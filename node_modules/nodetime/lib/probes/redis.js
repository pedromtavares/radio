
var commands = [
    "append",
    "auth",
    "bgrewriteaof",
    "bgsave",
    "blpop",
    "brpop",
    "brpoplpush",
    "config",
    "dbsize",
    "debug",
    "decr",
    "decrby",
    "del",
    "discard",
    "echo",
    "exec",
    "exists",
    "expire",
    "expireat",
    "flushall",
    "flushdb",
    "get",
    "getbit",
    "getrange",
    "getset",
    "hdel",
    "hexists",
    "hget",
    "hgetall",
    "hincrby",
    "hkeys",
    "hlen",
    "hmget",
    "hmset",
    "hset",
    "hsetnx",
    "hvals",
    "incr",
    "incrby",
    "info",
    "keys",
    "lastsave",
    "lindex",
    "linsert",
    "llen",
    "lpop",
    "lpush",
    "lpushx",
    "lrange",
    "lrem",
    "lset",
    "ltrim",
    "mget",
    "monitor",
    "move",
    "mset",
    "msetnx",
    "multi",
    "object",
    "persist",
    "ping",
    "psubscribe",
    "publish",
    "punsubscribe",
    "quit",
    "randomkey",
    "rename",
    "renamenx",
    "rpop",
    "rpoplpush",
    "rpush",
    "rpushx",
    "sadd",
    "save",
    "scard",
    "sdiff",
    "sdiffstore",
    "select",
    "set",
    "setbit",
    "setex",
    "setnx",
    "setrange",
    "shutdown",
    "sinter",
    "sinterstore",
    "sismember",
    "slaveof",
    "smembers",
    "smove",
    "sort",
    "spop",
    "srandmember",
    "srem",
    "strlen",
    "subscribe",
    "sunion",
    "sunionstore",
    "sync",
    "ttl",
    "type",
    "unsubscribe",
    "unwatch",
    "watch",
    "zadd",
    "zcard",
    "zcount",
    "zincrby",
    "zinterstore",
    "zrange",
    "zrangebyscore",
    "zrank",
    "zrem",
    "zremrangebyrank",
    "zremrangebyscore",
    "zrevrange",
    "zrevrangebyscore",
    "zrevrank",
    "zscore",
    "zunionstore"
];


module.exports = function(nt, obj) {
  var proxy = nt.tools.proxy;
  var samples = nt.tools.samples;
  var type = 'Redis';

  var clientsCount = 0;
  var clients = {};

  function monitorServer(host, port, password) {
    if(!nt.features.redisMetrics) return;

    var address = host + ':' + port;
    if(clients[address]) {
      if(password) {
       clients[address].password = password;
      }
    }
    else if(++clientsCount <= 10) {
      clients[address] = {
        host: host, 
        port: port, 
        password: password,
        lastValues: {}
      };
    }
  }

  function done(rClient, err) {
    try {
      rClient.quit();
    }
    catch(err2) {
      try {
        rClient.end();
      }
      catch(err3) {
        nt.error(err3);
      }

      nt.error(err2);
    }

    nt.error(err);      
  }

  function loadInfo(client) {
    var rClient = obj.createClient(client.port, client.host);
    
    rClient.on('error', function(err) {
      done(rClient, err);
    });

    if(client.password) {
      rClient.auth(client.password, function(err) {
        if(err) done(rClient, err);
      });
    }

    rClient.on('ready', function() {
      try { 
        var info = rClient.server_info;

        function metric(label, key, unit, isRelative) {
          var numVal = parseFloat(info[key]);
          if(typeof(numVal) !== 'number') return; 
          if(unit === 'KB') numVal /= 1000;
   
          if(isRelative) {
            if(client.lastValues[key]) {
              nt.metric(
                'Redis server ' + client.host + ':' + client.port, 
                label, 
                numVal - client.lastValues[key], 
                unit, 
                'gauge');
            }

            client.lastValues[key] = numVal;
          }
          else {
            nt.metric(
              'Redis server '  +  client.host + ':' + client.port, 
              label, 
              numVal, 
              unit,
              'gauge');
          }
        }

        metric('Used CPU sys' ,'used_cpu_sys' , null, true);
        metric('Used CPU user' ,'used_cpu_user' , null, true);
        metric('Connected clients' ,'connected_clients' , null, false);
        metric('Connected slaves' ,'connected_slaves' , null, false);
        metric('Blocked clients' ,'blocked_clients' , null, false);
        metric('Expired keys', 'expired_keys' , null, true);
        metric('Evicted keys' ,'evicted_keys' , null, true);
        metric('Keyspace hits' ,'keyspace_hits' , null, true);
        metric('Keyspace misses' ,'keyspace_misses' , null, true);
        metric('Connections received' ,'total_connections_received' , null, true);
        metric('Commands processed' ,'total_commands_processed' , null, true);
        metric('Rejected connections' ,'rejected_connections' , null, true);
        metric('Used memory', 'used_memory', 'KB', false);
        metric('Used memory RSS' , 'used_memory_rss', 'KB', false);
        metric('Memory fragmentation ratio' , 'mem_fragmentation_ratio', null, false);
        metric('PubSub channels' ,'pubsub_channels' , null, false);

        done(rClient);
      }
      catch(err) {
        done(rClient, err);
      }
    });
  }

  nt.setInterval(function() {
    for(var address in clients) {
      try {
        loadInfo(clients[address]);
      }
      catch(err) {
        nt.error(err);
      }
    }
  }, 60000);

 
  proxy.after(obj, 'createClient', function(obj, args, ret) {
    var client = ret;

    monitorServer(client.host, client.port);

    commands.forEach(function(command) {
      proxy.before(ret, command, function(obj, args) {
        var trace = samples.stackTrace();
        var time = samples.time(type, command);
        var params = args;

        if(command === 'auth' && args.length > 0) {
          monitorServer(client.host, client.port, args[0]);
        }

        proxy.callback(args, -1, function(obj, args) {
          if(!time.done(proxy.hasError(args))) return;
          if(samples.skip(time)) return;

          var error = proxy.getErrorMessage(args);
          var sample = samples.sample();
          sample['Type'] = type;
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
  });
};

