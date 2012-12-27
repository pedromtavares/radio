
var os = require('os');
var EventEmitter = require('events').EventEmitter;


var nt;
var v8tools;
var active = false;
var origPaused;

exports.init = function(_nt) {
  nt = _nt;

  try { 
    v8tools = require('v8tools'); 
  } 
  catch(err) { 
    nt.error(err);
  }

  // if paused during CPU profiling, do not resume automatically
  nt.on('pause', function() {
    origPaused = true;
  });
}


function sendError(ns, msg) {
    var obj = {};
    obj._id = nt.nextId++;
    obj._label = os.hostname() + ' [' + process.pid + ']';
    obj._ts = nt.millis();
    obj._ns = ns;
    obj['Error'] = msg; 

    nt.apiClient.send({cmd: 'updateData', args: obj});
}

/* CPU profiler */

exports.startCpuProfiler = function(seconds) {
  if(!v8tools) {
    return sendError('cpu-profiles', "v8tools package was not loaded. Please make sure it is properly installed.");
  }

  if(active) {
    return sendError('cpu-profiles', "CPU or heap profiler is already active.");
  }

  active = true;

  seconds || (seconds = 10);

  var paused = nt.paused;
  if(!paused) {
    nt.pause(true);
    origPaused = paused;
  }


  v8tools.startV8Profiler();
  nt.log("V8 CPU profiler started");

  // stop v8 profiler automatically after 10 seconds
  nt.setTimeout(function() {
    try {
      exports.stopCpuProfiler();
    }
    catch(err) {
      nt.error(err);
    }
  }, seconds * 1000);

  nt.on('destroy', function() {
    exports.stopCpuProfiler();
  });
};


exports.stopCpuProfiler = function() {
  if(!v8tools || !active) return;

  var nodes = {};
  var root = undefined;
  var rootSamplesCount = undefined;

  v8tools.stopV8Profiler(function(parentCallUid, callUid, totalSamplesCount, functionName, scriptResourceName, lineNumber) {
    if(rootSamplesCount === undefined)
      rootSamplesCount = totalSamplesCount;

    var cpuUsage = ((totalSamplesCount * 100) / rootSamplesCount || 1);
    var obj = {
      _totalSamplesCount: totalSamplesCount,
      _functionName: functionName,
      _scriptResourceName: scriptResourceName,
      _lineNumber: lineNumber,
      _cpuUsage: cpuUsage, 
      _id: nt.nextId++,
      _target: [],
      _label: cpuUsage.toFixed(2) + "% - " + functionName
    };

    if(scriptResourceName && lineNumber) 
      obj._label += " (" + scriptResourceName + ":" + lineNumber + ")";

    nodes[callUid] = obj;
    if(root === undefined) {
      root = obj;
    }

    if(parentCallUid) {
      var parentNode = nodes[parentCallUid];
      if(parentNode) parentNode._target.push(obj);
    }
  });

  nt.log("V8 CPU profiler stopped");

  if(root) {
    var profile = {};
    profile._id = nt.nextId++;
    profile._label = os.hostname() + ' [' + process.pid + ']';
    profile._ts = nt.millis();
    profile._ns = 'cpu-profiles';
    profile.root = root;

    nt.apiClient.send({cmd: 'updateData', args: profile});
  }


  if(!origPaused) {
    nt.resume();
  }

  active = false;
};



/* Heap profiler */

function edgeTypeToString(type) {
  switch(type) {
    case 0: 
      return 'variable';
    case 1: 
      return 'element';
    case 2: 
      return 'property';
    case 3: 
      return 'internal';
    case 4: 
      return 'hidden';
    case 5: 
      return 'shortcut';
    case 6:
      return 'weak';
    default:
      return 'other';
  }
}

function nodeTypeToString(type) {
  switch(type) {
    case 0: 
      return 'hidden';
    case 1: 
      return 'array';
    case 2: 
      return 'string';
    case 3: 
      return 'object';
    case 4: 
      return 'compiled code';
    case 5: 
      return 'function clojure';
    case 6: 
      return 'regexp';
    case 7: 
      return 'heap number';
    case 8: 
      return 'native object';
    default:
      return 'other';
  }
}


exports.takeHeapSnapshot = function() {
  if(!v8tools) {
    return sendError('heap-snapshots', "v8tools package was not loaded. Please make sure it is properly installed.");
  }

  if(active) {
    return sendError('heap-snapshots', "CPU or heap profiler is already active.");
  }

  active = true;

  nt.log("V8 heap profiler starting...");

  var snapshot = {};
  var nodeEmitter = new EventEmitter();

  buildRetainerGroups(nodeEmitter, snapshot);
  buildObjectGroups(nodeEmitter, snapshot);

  var nodes = {};
  v8tools.takeHeapSnapshot(function(parentNodeUid, nodeUid, name, type, selfSize, retainerName, retainerType) {
    if(retainerType === 5) return;

    if(!nodes[nodeUid]) {
      nodes[nodeUid] = true;

      var node = {
        nodeUid: nodeUid,
        name: ((type === 2 || type == 6) && name && name.length > 25) ? 
          name.substring(0, 22) + '...' : 
          name,
        type: type,
        selfSize: selfSize,
        retainerName: retainerName,
        retainerType: retainerType,
        parents: {},
        children: []
      };

      nodeEmitter.emit('node', node);
    }
  });


  nt.log("V8 heap profiler stopped");

  snapshot._id = nt.nextId++;
  snapshot._label = os.hostname() + ' [' + process.pid + ']';
  snapshot._ts = nt.millis();
  snapshot._ns = 'heap-snapshots';
  snapshot['Retainers'] = undefined;
  snapshot['Objects'] = undefined;

  nodeEmitter.emit('done');
  nodeEmitter.removeAllListeners();

  nt.apiClient.send({cmd: 'updateData', args: snapshot});

  active = false;
};


function genRetainerKey(node) {
  if(node.retainerType == 0 || node.retainerType == 2) {
    return edgeTypeToString(node.retainerType) + ':' + node.retainerName;
  }
  else {
    return edgeTypeToString(node.retainerType);
  }
}


function genRetainerLabel(node) {
  switch(node.retainerType) {
    case 0: 
      return 'Variable: ' + node.retainerName;
    case 1: 
      return 'Array elements';
    case 2: 
      return 'Property: ' + node.retainerName;
    case 4: 
      return 'Hidden links';
    case 6:
      return 'Weak references';
    default:
      return 'Other';
  }
}


function truncate(obj) {
  if(!obj) return undefined;
  
  if(typeof(obj) === 'string') {
    if(obj.length > 25) {
      return obj.substring(0, 25) + '...';
    }
    else {
      return obj;
    }
  }
  else if(typeof(obj) === 'number') {
    return obj;
  }
}


function genNodeLabel(node) {
  var name = truncate(node.name);
  return nodeTypeToString(node.type) + (name ? (": " + name) : "");
}


function buildRetainerGroups(nodeEmitter, snapshot) {
  var groups = {};
  var totalSize = 0;
  var totalCount = 0;

  nodeEmitter.on('node', function(node) {
    var key = genRetainerKey(node);
    var obj = groups[key];
    if(!obj) {
      obj = groups[key] = {
        _id: nt.nextId++,
        _label: genRetainerLabel(node),
        _size: 0, 
        _count: 0,
        _largestInstances: [],
        _minInstanceSize: 0,
        _randomInstances: []
      };
    }

    obj._size += node.selfSize;
    obj._count++;

    var large = (node.selfSize > obj._minInstanceSize || obj._largestInstances.length < 10);
    var random = (obj._count % Math.pow(10, Math.floor(Math.log(obj._count) / Math.LN10)) == 0);
    if(large || random) {
      var instance = {
        _id: nt.nextId++,
        _label: genNodeLabel(node),
        _selfSize: node.selfSize,
        'Name': truncate(node.name),
        'Type': nodeTypeToString(node.type),
        'Size (KB)': (node.selfSize / 1024).toFixed(3)
      };

      if(large) {
        obj._largestInstances.push(instance);

        obj._largestInstances = obj._largestInstances.sort(function(a, b) {
          return b._selfSize - a._selfSize;
        });

        obj._largestInstances.splice(10);
        obj._minInstanceSize = obj._largestInstances[obj._largestInstances.length - 1]._selfSize;
      }

      if(random) {
        obj._randomInstances.unshift(instance);
        obj._randomInstances.splice(10);
      }
    }

    totalSize += node.selfSize;
    totalCount++;
  });


  nodeEmitter.on('done', function() {
    // sort groups
    var groupsOrdered = [];
    for(var key in groups) {
      groupsOrdered.push(groups[key]);
    }
    groupsOrdered = groupsOrdered.sort(function(a, b) {
      return b._size - a._size;
    });
    groupsOrdered.splice(25);


    // prepare for rendering
    for(var key in groups) {
      var obj = groups[key];

      obj['Size (KB)'] = (obj._size / 1024).toFixed(3);
      if(totalSize > 0) obj['Size (%)'] = Math.round((obj._size / totalSize) * 100);
      obj._label = obj['Size (%)'] + "% - " + obj._label;

      obj['Count'] = obj._count;
      if(totalCount > 0) obj['Count (%)'] = Math.round((obj._count / totalCount) * 100);

      obj['Largest instances'] = obj._largestInstances;
      obj['Random instances'] = obj._randomInstances;
      
      delete obj._size;
      delete obj._count;
      delete obj._largestInstances;
      delete obj._minInstanceSize;
      delete obj._randomInstances;
    }

    snapshot['Retainers'] = groupsOrdered;
  });
}

function genObjectKey(node) {
  switch(node.type) {
    case 1: 
      return 'Array';
    case 2: 
      return 'String';
    case 3: 
      return node.name;
    case 4: 
      return 'compiled code';
    case 5: 
      return 'Function';
    case 6: 
      return 'RegExp';
    case 7: 
      return 'Number';
    case 8: 
      return node.name;
    default:
      return 'other';
  }
}

function buildObjectGroups(nodeEmitter, snapshot) {
  var groups = {};
  var totalSize = 0;
  var totalCount = 0;

  nodeEmitter.on('node', function(node) {
    var key = genObjectKey(node);
    var obj = groups[key];
    if(!obj) {
      obj = groups[key] = {
        _id: nt.nextId++,
        _label: key,
        _size: 0, 
        _count: 0,
        _largestInstances: [],
        _minInstanceSize: 0,
        _randomInstances: []
      };
    }

    obj._size += node.selfSize;
    obj._count++;

    var large = (node.selfSize > obj._minInstanceSize || obj._largestInstances.length < 10);
    var random = (obj._count % Math.pow(10, Math.floor(Math.log(obj._count) / Math.LN10)) == 0);
    if(large || random) {
      var instance = {
        _id: nt.nextId++,
        _label: genNodeLabel(node),
        _selfSize: node.selfSize,
        'Name': truncate(node.name),
        'Type': nodeTypeToString(node.type),
        'Size (KB)': (node.selfSize / 1024).toFixed(3)
      };

      if(large) {
        obj._largestInstances.push(instance);

        obj._largestInstances = obj._largestInstances.sort(function(a, b) {
          return b._selfSize - a._selfSize;
        });

        obj._largestInstances.splice(10);
        obj._minInstanceSize = obj._largestInstances[obj._largestInstances.length - 1]._selfSize;
      }

      if(random) {
        obj._randomInstances.unshift(instance);
        obj._randomInstances.splice(10);
      }
    }

    totalSize += node.selfSize;
    totalCount++;
  });


  nodeEmitter.on('done', function() {
    // sort groups
    var groupsOrdered = [];
    for(var key in groups) {
      groupsOrdered.push(groups[key]);
    }
    groupsOrdered = groupsOrdered.sort(function(a, b) {
      return b._size - a._size;
    });
    groupsOrdered.splice(25);


    // prepare for rendering
    for(var key in groups) {
      var obj = groups[key];

      obj['Size (KB)'] = (obj._size / 1024).toFixed(3);
      if(totalSize > 0) obj['Size (%)'] = Math.round((obj._size / totalSize) * 100);
      obj._label = obj['Size (%)'] + "% - " + obj._label;

      obj['Count'] = obj._count;
      if(totalCount > 0) obj['Count (%)'] = Math.round((obj._count / totalCount) * 100);

      obj['Largest instances'] = obj._largestInstances;
      obj['Random instances'] = obj._randomInstances;
      
      delete obj._size;
      delete obj._count;
      delete obj._largestInstances;
      delete obj._minInstanceSize;
      delete obj._randomInstances;
    }

    snapshot['Objects'] = groupsOrdered;
  });
}
