
if(global.nodetime) return global.nodetime;

var fs = require('fs');
var os = require('os');
var util = require('util');
var path = require('path');
var events = require('events');
var cluster = require('cluster');
var crypto = require('crypto');
var api = require('./api');
var AppData = require('./appdata').AppData;
var proxy = require('./proxy');
var samples = require('./samples');
var metrics = require('./metrics');
var info = require('./info');
var sender = require('./sender');
var stdout = require('./stdout');
var dtrace = require('./dtrace');
var filter = require('./filter');
var PredicateFilter = filter.PredicateFilter;
var v8profiler = require('./v8-profiler');


var Nodetime = function() {
  this.initialized = false;
  this.version = '0.6.8';
  this.master = cluster.isMaster;
  this.paused = true;
  this.pauseAt = undefined;
  this.nextId = Math.round(Math.random() * Math.pow(10, 6));
  this.filterFunc = undefined;
  this.filterOptions = undefined;
  this.times = {};
  this.timekit = undefined;

  this.appData = new AppData();

  this.timeoutIds = [];
  this.intervalIds = [];

  events.EventEmitter.call(this);
};
util.inherits(Nodetime, events.EventEmitter);


Nodetime.prototype.profile = function(opts) {
  if(this.initialized) return;
  this.initialized = true;

  var self = this;

  opts || (opts = {});
  opts.features || (opts.features = {});

  // registered accounts
  this.accountKey = opts.accountKey; 
  this.appName = opts.appName || 'Default Application'; 
  if(this.accountKey) {
    this.sessionId = 'pro:' + this.accountKey + ':' + sha1(this.appName);
  }

  this.history = opts.history === undefined || opts.history;
  this.headless = opts.headless;
  this.dtrace = opts.dtrace;
  this.stdout = opts.stdout;
  if(this.stdout && opts.headless === undefined) this.headless = true;
  this.debug = opts.debug;  
  this.silent = opts.silent && !opts.debug;
  this.proxyServer = opts.proxy;

  // compatibility
  if(opts.features.transactions === undefined && opts.transactions !== undefined) 
    opts.features.transactions = opts.transactions;
  if(opts.features.redisMetrics === undefined && opts.redisMetrics !== undefined) 
    opts.features.redisMetrics = opts.redisMetrics;
  if(opts.features.mongodbMetrics === undefined && opts.mongodbMetrics !== undefined) 
    opts.features.mongodbMetrics = opts.mongodbMetrics;

  this.features = {
    transactionProfiler: opts.features.transactionProfiler === undefined || opts.features.transactionProfiler,
    redisMetrics: opts.features.redisMetrics === undefined || opts.features.redisMetrics,
    mongodbMetrics: opts.features.mongodbMetrics === undefined || opts.features.mongodbMetrics
  };

  if(this.headless) {
    console.log('YOU ARE USING NODETIME AGENT IN HEADLESS MODE. THIS NODETIME AGENT IS DESIGNED AND OPTIMIZED TO BE USED WITH NODETIME.COM SERVICE ONLY. USE OF THE AGENT WITH OTHER SERVICE OR SERVER IS NOT SUPPORTED.');
  }

  // setup API client and request sessionId if not given
  if(!this.headless) {
    this.apiClient = api.createClient({
      server: 'https://api.nodetime.com', 
      proxy: this.proxyServer,
      headers: {'agent-version': this.version},
      group: this.sessionId,
      debug: this.debug});

    this.on('destroy', function() {
      self.apiClient.destroy();
    });

    this.apiClient.on('message', function(msg) {
      if(isValidCommand(msg)) {
        if(msg.cmd === 'newSession') {
          self.sessionId = msg.args;
          self.apiClient.setGroup(self.sessionId);
          self.message("profiler console for this instance is at \033[33m" + "https://nodetime.com/" + self.sessionId + "\033[0m");

          try {
            self.emit('session', self.sessionId);

            // session expires on server after 20 minutes
            self.setTimeout(function() {
              self.sessionId = undefined;
            }, 1200000);
          }
          catch(err) {
            self.error(err);
          }
        }
        else if(msg.cmd === 'pause') {
          self.pause();
        }
        else if(msg.cmd === 'resume') {
          self.resume();
        }
        else if(msg.cmd === 'filter') {
          if(msg.args) {
            var pf = new PredicateFilter();
            if(pf.preparePredicates(msg.args)) {
              self.filter(function(sample) {
                return pf.filter(sample);
              }, msg.args);
            }
          }
          else {
            self.filter(undefined);
          }
        }
        else if(msg.cmd === 'profileCpu') {
          try {
            if(typeof msg.args === 'number' && msg.args > 0 && msg.args <= 60) {
              v8profiler.startCpuProfiler(msg.args);
            }
          }
          catch(err) {
            self.error(err);
          }
        }
        else if(msg.cmd === 'takeHeapSnapshot') {
          try {
            v8profiler.takeHeapSnapshot();
          }
          catch(err) {
            self.error(err);
          }
        }

      }
      else {
        self.log("invalid command from server");
      }
    });

    if(this.master && !this.sessionId) {
      this.log("requesting session from server");
      this.apiClient.send({cmd: 'createSession'});
    }
  }


  // try to load timekit
  try { 
    this.timekit = require('timekit'); 
    if(!this.timekit.time() || !this.timekit.cputime()) throw new Error('timekit broken');
  } 
  catch(err) { 
    this.timekit = undefined;
    this.error(err);
  }


  // node >= 0.8
  this.hasHrtime = process.hasOwnProperty('hrtime');


  // init modules
  metrics.init(this);
  proxy.init(this);
  if(this.stdout) stdout.init(this);
  if(this.dtrace) dtrace.init(this);
  if(!this.headless) sender.init(this);
  filter.init(this);
  samples.init(this);
  info.init(this);
  v8profiler.init(this);

  // expose modules 
  this.tools = {
    proxy: proxy,
    samples: samples,
    info: info
  };


  // prepare probes
  var probes = {};
  var files = fs.readdirSync(path.dirname(require.resolve('./nodetime')) + '/probes');
  files.forEach(function(file) {
    var m = file.match('^(.*)+\.js$');
    if(m && m.length == 2) probes[m[1]] = true;
  });

  proxy.after(module.__proto__, 'require', function(obj, args, ret) {
    if(ret.__required__) return;

    if(probes[args[0]]) {
      ret.__required__ = true; 

      return require('./probes/' + args[0])(self, ret);
    }
  });
  
  require('./probes/process')(self, process);



  // broadcast sessionId to all workers in a cluster
  if(!this.headless && !this.sessionId) {
    if(this.master) {
      //cluster.on('fork', function(worker) { switch to this sometime in the future
      proxy.after(cluster, 'fork', function(obj, args, worker) {
        if(self.sessionId) {
            worker.send({nodetimeSessionId: self.sessionId});
            self.log('master ' + process.pid + ' sent sessionId ' + self.sessionId + ' to worker ' + worker.id)
        }
        else {
          self.once('session', function(sessionId) {
            worker.send({nodetimeSessionId: sessionId});
            self.log('master ' + process.pid + ' sent sessionId ' + sessionId + ' to worker ' + worker.id)
          });
        }
      });
    }
    else {
      process.on('message', function(msg) {
        if(!msg || !msg.nodetimeSessionId) return;

        self.sessionId = msg.nodetimeSessionId;
        self.apiClient.group = self.sessionId;
        self.log('worker ' + process.pid + ' received sessionId ' + msg.nodetimeSessionId + ' from master');
      });
    }  
  }


  // autopause profiler if not paused explicitly
  self.setInterval(function() {
    if(!self.paused && self.millis() > self.pauseAt) 
      self.pause(); 
  }, 1000);
};


Nodetime.prototype.switchApp = function(appName) {
  if(!this.initialized) return;

  this.appName = appName;
  if(this.accountKey) {
    this.sessionId = 'pro:' + this.accountKey + ':' + sha1(this.appName);
    this.apiClient.setGroup(this.sessionId);
  }

  // resend info
  try {
    this.tools.info.sendInfo();
  }
  catch(err) {
    this.error(err);
  }
};


Nodetime.prototype.destroy = function() {
  this.timeoutIds.forEach(function(timeoutId) {
    this.clearTimeout(timeoutId);
  });

  this.intervalIds.forEach(function(intervalId) {
    this.clearInterval(intervalId);
  });

  this.pause();

  this.emit('destroy');
  this.removeAllListeners();
};


Nodetime.prototype.pause = function(keepState) {
  if(!this.initialized || !this.features.transactionProfiler) return;

  this.paused = true;
 
  if(!keepState) {
    this.pauseAt = undefined;
    this.filterFunc = undefined;
    this.filterOptions = undefined;
  }

  this.emit('pause');
  this.log('profiler paused');
};


Nodetime.prototype.resume = function(seconds) {
  if(!this.initialized || !this.features.transactionProfiler) return;

  if(!seconds) seconds = 180;

  this.pauseAt = this.millis() + seconds * 1000;
  this.paused = false;

  this.emit('resume', seconds);
  this.log('profiler resumed for ' + seconds + ' seconds');
};


Nodetime.prototype.filter = function(func, options) {
  this.filterFunc = func;
  this.filterOptions = options
};


Nodetime.prototype.time = function(scope, label, context) {
  if(!this.initialized) return;

  return new TimePromise(
    samples.time(scope, label, true),
    samples.stackTrace(),
    context);
};

function TimePromise(time, stackTrace, context) {
  this.time = time;
  this.stackTrace = stackTrace;
  this.context = context;
};

TimePromise.prototype.end = function(context) {
  var type = 'Custom';

  if(!this.time.done()) return;
  if(samples.skip(this.time)) return;

  var sample = samples.sample();
  sample['Type'] = type;
  sample['Start context'] = this.context;
  sample['End context'] = context;
  sample['Stack trace'] = this.stackTrace;
  sample._group = type;
  sample._label = type + ': ' + this.time.command;

  samples.add(this.time, sample);
};


Nodetime.prototype.metric = function(scope, name, value, unit, op, history) {
  if(!this.initialized || (!this.history && this.paused)) return;

  metrics.add(scope, name, value, unit, op, history);
};


Nodetime.prototype.expressErrorHandler = function() {
  return function(err, req, res, next) {
    res.__caughtException__ = err;
    next(err);
  };
};


Nodetime.prototype.hrtime = function() {
  if(this.timekit) {
    return this.timekit.time();
  }
  else if(this.hasHrtime) {
    var ht = process.hrtime();
    return ht[0] * 1000000 + Math.round(ht[1] / 1000);
  }
  else {
    return new Date().getTime() * 1000;
  }
};


Nodetime.prototype.micros = function() {
  return this.timekit ? this.timekit.time() : new Date().getTime() * 1000;
};


Nodetime.prototype.millis = function() {
  return this.timekit ? this.timekit.time() / 1000 : new Date().getTime();
};


Nodetime.prototype.cputime = function() {
  return this.timekit ? this.timekit.cputime() : undefined;
};


Nodetime.prototype.log = function(msg) {
  if(this.debug && msg) console.log('nodetime:', msg);
};


Nodetime.prototype.error = function(e) {
  if(this.debug && e) console.error('nodetime error:', e, e.stack);
};


Nodetime.prototype.dump = function(obj) {
  if(this.debug) console.log(util.inspect(obj, false, 10, true));
};


Nodetime.prototype.message = function(msg) {
  if(!this.silent) util.log("\033[1;31mNodetime:\033[0m " + msg);
};


Nodetime.prototype.setTimeout = function(func, ms) {
  var self = this;

  var context = {timeoutId: undefined};

  var funcWrap = function() {
    func.apply(this, arguments);
    self.deleteTimeout(context.timeoutId);
  };

  context.timeoutId = setTimeout(funcWrap, ms);
  this.timeoutIds.push(context.timeoutId);

  return context.timeoutId;
};


Nodetime.prototype.setInterval = function(func, ms) {
  var intervalId = setInterval(func, ms);
  this.intervalIds.push(intervalId);
  return intervalId;
};


Nodetime.prototype.clearTimeout = function(timeoutId) {
  this.deleteTimeout(timeoutId);
  clearTimeout(timeoutId);
};


Nodetime.prototype.clearInterval = function(intervalId) {
  this.deleteInterval(intervalId);
  clearTimeout(intervalId);
};


Nodetime.prototype.deleteTimeout = function(timeoutId) {
  for (var i = 0; i < this.timeoutIds.length; i++) {
    if(this.timeoutIds[i] === timeoutId) {
      this.timeoutIds.splice(i, 1);
      break;
    }
  }
};


Nodetime.prototype.deleteInterval = function(intervalId) {
  for (var i = 0; i < this.intervalIds.length; i++) {
    if(this.intervalIds[i] === intervalId) {
      this.intervalIds.splice(i, 1);
      break;
    }
  }
};


var isValidCommand = function(obj) { 
  if(!obj) return false;
  if(typeof obj.cmd !== 'string' || obj.cmd.length > 256) return false;

  return true;
};


var sha1 = function(str) {
  var hash = crypto.createHash('sha1');
  hash.update(str);
  return hash.digest('hex');
};


var NodetimeExposed = function() {
  var self = this;

  var nodetime = new Nodetime();
  ['profile', 
    'switchApp', 
    'pause', 
    'resume', 
    'destroy', 
    'time', 
    'metric',
    'expressErrorHandler'].forEach(function(meth) {
    self[meth] = function() { 
      return nodetime[meth].apply(nodetime, arguments);
    };
  });

  ['on', 'addListener'].forEach(function(meth) {
    self[meth] = function() { 
      if(arguments[0] !== 'sample') return;

      return nodetime[meth].apply(nodetime, arguments);
    };
  }); 
};

exports = module.exports = global.nodetime = new NodetimeExposed(); 

