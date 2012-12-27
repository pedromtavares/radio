
EventEmitter = require('events').EventEmitter;

var nt;

exports.init = function(_nt) {
  nt = _nt;

  exports.before(EventEmitter.prototype, 'removeListener', function(obj, args) {
    if(args.length > 1 && args[1] && args[1].__proxy__) {
      args[1] = args[1].__proxy__;
    }
  });
}

var Locals = function() {
  this.time = undefined;
  this.stackTrace = undefined;
  this.params = undefined;
}


exports.before = function(obj, meths, hook) {
  if(!Array.isArray(meths)) meths = [meths];

  meths.forEach(function(meth) { 
    var orig = obj[meth];
    if(!orig) return;

    obj[meth] = function() {
      try { hook(this, arguments); } catch(e) { nt.error(e); }
      return orig.apply(this, arguments);
    };
  });
};


exports.after = function(obj, meths, hook) {
  if(!Array.isArray(meths)) meths = [meths];

  meths.forEach(function(meth) {
    var orig = obj[meth];
    if(!orig) return;

    obj[meth] = function() {
      var ret = orig.apply(this, arguments);
      var hookRet;
      try { hookRet = hook(this, arguments, ret); } catch(e) { nt.error(e) }
      return hookRet || ret;
    };
  });
};


exports.around = function(obj, meths, hookBefore, hookAfter) {
  if(!Array.isArray(meths)) meths = [meths];

  meths.forEach(function(meth) {
    var orig = obj[meth];
    if(!orig) return;

    obj[meth] = function() {
      var locals = new Locals();
      try { hookBefore(this, arguments, locals); } catch(e) { nt.error(e) }
      var ret = orig.apply(this, arguments);
      var hookRet;
      try { hookRet = hookAfter(this, arguments, ret, locals); } catch(e) { nt.error(e) }
      return hookRet || ret;
    };
  });
};


exports.callback = function(args, pos, hookBefore, hookAfter, hookError) {
  if(args.length <= pos) return false;
  if(pos === -1) pos = args.length - 1;

  var orig = (typeof args[pos] === 'function') ? args[pos] : undefined;
  if(!orig) return;

  args[pos] = function() {
    if(hookBefore) try { hookBefore(this, arguments); } catch(e) { nt.error(e); }
    var ret;
    if(hookError) {
      try {
        ret = orig.apply(this, arguments);
      }
      catch(err) {
        try { hookError(this, arguments, err); } catch(e) { nt.error(e); }
        throw err;
      }
    }
    else {
      ret = orig.apply(this, arguments);
    }
    if(hookAfter) try { hookAfter(this, arguments); } catch(e) { nt.error(e); }
    return ret;
  };

  orig.__proxy__ = args[pos];
};


exports.getter = function(obj, props, hook) {
  if(!Array.isArray(props)) props = [props];

  props.forEach(function(prop) {
    var orig = obj.__lookupGetter__(prop);
    if(!orig) return;

    obj.__defineGetter__(prop, function() {
      var ret = orig.apply(this, arguments);
      try { hook(this, ret); } catch(e) { nt.error(e) }
      return ret;
    });
  });
};


exports.hasError = function(args) {
  return (args && args.length > 0 && args[0]);
};


exports.getErrorMessage = function(args) {
  if(args && args.length > 0 && args[0]) {
    if(typeof(args[0]) === 'object' && args[0].message) {
      return args[0].message;
    }
    else if(typeof(args[0]) === 'string') {
      return args[0];
    }
    else {
      return 'unspecified';
    }
  }
  
  return undefined;
};




