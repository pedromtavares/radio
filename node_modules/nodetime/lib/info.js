
var os = require('os');


var nt;
var lastCpuTime;

exports.init = function(_nt) {
  nt = _nt;

  nt.on("call", function(point, time) {
    if(!nt.history && nt.paused) return;

    if(point === "start") {
      nt.metric(time.scope, 'Requests per minute', 1, undefined, 'sum');
    }
    else if(point === "done") {
      nt.metric(time.scope, 'Errors per minute', (time.hasError ? 1 : 0), undefined, 'sum');
      nt.metric(time.scope, 'Average response time', time.ms, 'ms', 'avg');
      nt.metric(time.scope, 'Response time 95th percentile', time.ms, 'ms', '95th');
      nt.metric(time.scope, 'Response time histogram', time.ms, 'ms', 'hist');
      if(time.cputime) nt.metric(time.scope, 'Average CPU time', time.cputime, 'ms', 'avg');

      nt.metric('Process', 'Performance index', time.ms, undefined, 'histx');
    }
  });

  nt.setInterval(function() {
    try {
      exports.sendInfo();
      collectMetrics();
    }
    catch(e) {
      nt.error(e);
    }
  }, 60000);

  exports.sendInfo();
  collectMetrics();
};


exports.sendInfo = function() {
  var info = {};
  info._ts = nt.millis();
  info._ns = 'info';
  info['Application name'] = nt.appName;
  try { info['Hostname'] = os.hostname() } catch(err) { nt.error(err) } 
  try { info['OS type'] = os.type() } catch(err) { nt.error(err) } 
  try { info['Platform'] = os.platform() } catch(err) { nt.error(err) } 
  try { info['Total memory (MB)'] = os.totalmem() / 1000000 } catch(err) { nt.error(err) } 
  try { var cpus = os.cpus(); info['CPU'] = {architecture: os.arch(), model: cpus[0].model, speed: cpus[0].speed, cores: cpus.length} } catch(err) { nt.error(err) } 
  try { info['Interfaces'] = os.networkInterfaces() } catch(err) { nt.error(err) } 
  try { info['OS uptime (Hours)'] = Math.floor(os.uptime() / 3600) } catch(err) { nt.error(err) } 
  try { info['Node arguments'] = process.argv } catch(err) { nt.error(err) } 
  try { info['Node PID'] = process.pid; } catch(err) { nt.error(err) } 
  try { info['Node uptime (Hours)'] = Math.floor(process.uptime() / 3600); } catch(err) { nt.error(err) } 
  try { info['Node versions'] = process.versions } catch(err) { nt.error(err) } 
  info['Nodetime version'] = nt.version;
  info['Nodetime options'] = {
    debug: nt.debug,
    history: nt.history,
    filter: nt.filterOptions
  };

  try {
    nt.emit('info', info);
  }
  catch(err) {
    nt.error(err);
  }
}

var collectMetrics = function() {
  try { nt.metric('OS', 'Load average', os.loadavg()[0]); } catch(err) { nt.error(err); }
  try { nt.metric('OS', 'Free memory', os.freemem() / 1000000, 'MB'); } catch(err) { nt.error(err); }


  try {
    var mem = process.memoryUsage();
    nt.metric('Process', 'Node RSS', mem.rss / 1000000, 'MB');
    nt.metric('Process', 'V8 heap used', mem.heapUsed / 1000000, 'MB');
    nt.metric('Process', 'V8 heap total', mem.heapTotal / 1000000, 'MB');
  }
  catch(err) {
    nt.error(err);
  }

  var cpuTime = nt.cputime();
  if(cpuTime !== undefined && lastCpuTime !== undefined)
    nt.metric('Process', 'CPU time', (cpuTime - lastCpuTime) / 1000, 'ms');
  if(cpuTime !== undefined) 
    lastCpuTime = cpuTime;
};

