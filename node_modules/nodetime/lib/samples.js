
var Time = require('./time').Time;


var nt;
var info;
var state = {};
var roots = [];
var operations = [];
var rootCallTimestamps = {};
var stackTraceCalls = 0;
var stackTraceFilter = /nodetime/;
var skipCounter = {};


exports.init = function(_nt) {
  nt = _nt;

  nt.on('info', function(_info) {
    info = _info;
  });

  nt.on('call', function(point, time) {
    if(time.isMacro) rootCallTimestamps[time.id] = time.begin;
  });

  nt.on('metric', function(metric) {
    if(!state[metric.scope]) state[metric.scope] = {};
    state[metric.scope][metric.name + (metric.unit ? ' (' + metric.unit + ')' : '')] = metric.value;
  });


  // reset skip counter
  nt.setInterval(function() {
    skipCounter = {};
  }, 60000);


  // cleanup operations
  nt.setInterval(function() {
    try {
      // expire root calls
      var now = nt.millis();
      for(var prop in rootCallTimestamps) {
        if(rootCallTimestamps[prop] + 60000 < now) {
          delete rootCallTimestamps[prop];
        }
      }

      var firstCall = undefined;
      for(var prop in rootCallTimestamps) {
          firstCall = rootCallTimestamps[prop];
          break;
      }

      operations = operations.filter(function(o) {
        return (firstCall && o._begin >= firstCall);
      });
    }
    catch(e) {
      nt.error(e);
    }
  }, 10000);
}


exports.sample = function() {
  return { 
    'Type': undefined,
    'Connection': undefined,
    'Command': undefined,
    'Arguments': undefined,
    'Stack trace': undefined,
    'Error': undefined,
    'URL': undefined,
    'Method': undefined,
    'Request headers': undefined,
    'Response headers': undefined,
    'Status code': undefined,
    _group: undefined,
    _version: undefined,
    _ns: undefined,
    _id: undefined,
    _isMacro: undefined,
    _begin: undefined,
    _end: undefined,
    _ms: undefined,
    _ts: undefined,
    _cputime: undefined,
    'Response time (ms)': undefined,
    'Timestamp (ms)': undefined,
    'CPU time (ms)': undefined,
    'Bytes read (KB)': undefined,
    'Bytes written (KB)': undefined,
    'Start context': undefined,
    'End context': undefined,
    'Operations': undefined,
    'Node state': undefined,
    'Node information': undefined,
    _filtered: undefined,
    _realtime: undefined,
    _slow: undefined
  };
};


exports.time = function(scope, command, isMacro) {
  var t =  new Time(nt, scope, command, isMacro);
  t.start();

  return t;
}; 

exports.skip = function(time) {
  skipCounter[time.scope] || (skipCounter[time.scope] = 0);
  if(++skipCounter[time.scope] > 250) return true;

  return false;
};

exports.truncate = function(args) {
  if(!args) return undefined;

  if(typeof args === 'string') {
    return (args.length > 80 ? (args.substr(0, 80) + '...') : args); 
  }
  
  if(!args.length) return undefined;

  var arr = [];
  var argsLen = (args.length > 10 ? 10 : args.length); 
  for(var i = 0; i < argsLen; i++) {
   if(typeof args[i] === 'string') {
      if(args[i].length > 80) {
        arr.push(args[i].substr(0, 80) + '...'); 
      }
      else {
        arr.push(args[i]); 
      }
    }
    else if(typeof args[i] === 'number') {
      arr.push(args[i]); 
    }
    else if(args[i] === undefined) {
      arr.push('[undefined]');
    }
    else if(args[i] === null) {
      arr.push('[null]');
    }
    else if(typeof args[i] === 'object') {
      arr.push('[object]');
    }
    if(typeof args[i] === 'function') {
      arr.push('[function]');
    }
  } 

  if(argsLen < args.length) arr.push('...');

  return arr;
};


exports.formatStackTrace = function(err) {
  if(err && err.stack) {
    var lines = err.stack.split("\n");
    lines.shift();
    lines = lines.filter(function(line) {
      return !stackTraceFilter.exec(line)
    });

    return lines; 
  }

  return undefined;
};


exports.stackTrace = function() {
  if(nt.paused || stackTraceCalls++ > 1000) return undefined;

  var err = new Error();
  Error.captureStackTrace(err);

  return exports.formatStackTrace(err);
};


exports.add = function(time, sample, label) {
  process.nextTick(function() {
    try {
      _add(time, sample);
    }
    catch(err) {
      nt.error(err);
    }
  });
};


var _add = function(time, sample) {
  sample._version = nt.version;
  sample._ns = 'samples';
  sample._id = time.id;
  sample._isMacro = time.isMacro;
  sample._begin = time.begin;
  sample._end = time.end;
  sample._ms = time.ms;
  sample._ts = time.begin;
  sample._cputime = time.cputime;
  
  if(sample._label.length > 80) sample._label = sample._label.substring(0, 80) + '...';

  sample['Response time (ms)'] = sample._ms;
  sample['Timestamp (ms)'] = sample._ts;
  if(sample._cputime !== undefined) sample['CPU time (ms)'] = sample._cputime;
  if(!time.isMacro) {
    sample['Bytes read (KB)'] = time.bytesRead / 1000;
    sample['Bytes written (KB)'] = time.bytesWritten / 1000;
  }

  if(sample._isMacro) {
    sample['Operations'] = findOperations(sample);
    sample['Node state'] = state;
    sample['Node information'] = info;

    try {
      if(!nt.filterFunc || nt.filterFunc(sample)) {
        sample._filtered = true;
      }
      
      nt.emit('sample', sample);
    }
    catch(err) {
      nt.error(err);
    }

    delete rootCallTimestamps[sample._id];
  }
  else {
    operations.push(sample);

    try {
      if(!nt.filterFunc || nt.filterFunc(sample)) {
        sample._filtered = true;
      }

      nt.emit('sample', sample);
    }
    catch(err) {
      nt.error(err);
    }
  }
};


var findOperations = function(sample) {
  var found = [];

  for(var i = operations.length - 1; i >= 0; i--) {
    var o = operations[i];
    if(o._begin >= sample._begin && o._end <= sample._end) {
      found.push(o);
    }

    if(o._end < sample._begin) {
      break;
    }
  }

  found = found.sort(function(a, b) {
    return b._ms - a._ms;
  });

  return found.splice(0, 50);
};



