
var os = require('os');


var nt;
var metrics = {};


exports.init = function(_nt) {
  nt = _nt;

  nt.setInterval(function() {
    try {
      aggregate();
    }
    catch(e) {
      nt.error(e);
    }
  }, 60000);

  //send any initial values
  nt.setTimeout(function() {
    try {
      initial();
    }
    catch(e) {
      nt.error(e);
    }
  }, 1000);
};


exports.add = function(scope, name, value, unit, op) {
  if(!scope || !name || typeof(value) !== 'number') 
    throw new Error('parameter(s) missing');

  op || (op = 'avg');

  process.nextTick(function() {
    var key = scope + ':' + name;

    // create
    if(!metrics[key]) {
      metrics[key] = {
        scope: scope,
        name: name,
        value: undefined,
        unit: unit,
        op: op,
        history: nt.history,
        _count: 0,
        _values: undefined,
        _bins: undefined
      };

      if(op === 'hist' || op === 'histx') {
        metrics[key]._bins = {};
      }
      else if(op === '95th') {
        metrics[key]._values = [];
      }
      else {
        metrics[key].value = 0;        
      }
    }


    // update
    var obj = metrics[key];

    if(op === 'avg' || op === 'sum') {
      obj.value += value;
      obj._count++;
    }
    else if(op === 'gauge') {
      obj.value = value;
    }
    else if(op === '95th') {
      obj._values.push(value);
    }
    else if(op === 'hist' || op === 'histx') {
      var bin = value < 1 ? 1 : Math.pow(10, Math.floor(Math.log(value) / Math.LN10) + 1); 
      if(obj._bins[bin]) {
        obj._bins[bin]++;
      }
      else {
        obj._bins[bin] = 1;
      }
    }

    if(!nt.history) {
      obj.history = false;
    }
  });
};


var emit = function(obj) {
  try {
    delete obj._count;
    obj.source = os.hostname() + '[' + process.pid + ']';
    obj._id = nt.nextId++; 
    obj._ns = 'metrics';
    obj._ts = nt.millis();
 
    nt.emit('metric', obj);
  }
  catch(err) {
    nt.error(err);
  }
};


var initial = function() {
  for(var key in metrics) {
    var obj = metrics[key];

    if(obj.op === 'avg') {
      obj.value = obj.value / obj._count;
      emit(obj);

      delete metrics[key];
    }
  }  
};


var aggregate = function() {
  var count = 0;
  for (var key in metrics) {
    if(++count > 500) break; 

    var obj = metrics[key];

    if(obj.op === 'avg') {
      obj.value = obj.value / obj._count;
    }
    else if(obj.op === '95th') {
      if(obj._values.length > 0) {
        obj._values = obj._values.sort(function(a, b) { return a - b});
        var n = Math.floor(obj._values.length * 0.95 + 0.5);
        obj.value = obj._values[n - 1];
      }
      else {
        obj.value = 0;
      }
    }
    else if(obj.op === 'hist') {
      obj.value = obj._bins;
    }
    else if(obj.op === 'histx') {
      var total = 0;
      for(var bin in obj._bins) {
        total += obj._bins[bin];
      }

      if(total !== 0) {
        obj.value = 0;
        for(var bin in obj._bins) {
          obj.value += Math.round(1 / (Math.log(bin) / Math.LN10 + 1) * (obj._bins[bin] / total * 100));
        }
      }

      obj.value = 100 - obj.value;
    }
      
    if(obj.value !== undefined) {
      obj._count = undefined;
      obj._values = undefined;
      obj._bins = undefined;

      emit(obj);
    }
  }

  metrics = {};
};

