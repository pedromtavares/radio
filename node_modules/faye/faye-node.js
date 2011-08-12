if (!this.Faye) Faye = {};

Faye.extend = function(dest, source, overwrite) {
  if (!source) return dest;
  for (var key in source) {
    if (!source.hasOwnProperty(key)) continue;
    if (dest.hasOwnProperty(key) && overwrite === false) continue;
    if (dest[key] !== source[key])
      dest[key] = source[key];
  }
  return dest;
};

Faye.extend(Faye, {
  VERSION:          '0.6.3',
  
  BAYEUX_VERSION:   '1.0',
  ID_LENGTH:        128,
  JSONP_CALLBACK:   'jsonpcallback',
  CONNECTION_TYPES: ['long-polling', 'cross-origin-long-polling', 'callback-polling', 'websocket', 'in-process'],
  
  MANDATORY_CONNECTION_TYPES: ['long-polling', 'callback-polling', 'in-process'],
  
  ENV: (function() { return this })(),
  
  random: function(bitlength) {
    bitlength = bitlength || this.ID_LENGTH;
    if (bitlength > 32) {
      var parts  = Math.ceil(bitlength / 32),
          string = '';
      while (parts--) string += this.random(32);
      return string;
    }
    var limit   = Math.pow(2, bitlength) - 1,
        maxSize = limit.toString(36).length,
        string  = Math.floor(Math.random() * limit).toString(36);
    
    while (string.length < maxSize) string = '0' + string;
    return string;
  },
  
  commonElement: function(lista, listb) {
    for (var i = 0, n = lista.length; i < n; i++) {
      if (this.indexOf(listb, lista[i]) !== -1)
        return lista[i];
    }
    return null;
  },
  
  indexOf: function(list, needle) {
    for (var i = 0, n = list.length; i < n; i++) {
      if (list[i] === needle) return i;
    }
    return -1;
  },
  
  each: function(object, callback, scope) {
    if (object instanceof Array) {
      for (var i = 0, n = object.length; i < n; i++) {
        if (object[i] !== undefined)
          callback.call(scope || null, object[i], i);
      }
    } else {
      for (var key in object) {
        if (object.hasOwnProperty(key))
          callback.call(scope || null, key, object[key]);
      }
    }
  },
  
  map: function(object, callback, scope) {
    var result = [];
    this.each(object, function() {
      result.push(callback.apply(scope || null, arguments));
    });
    return result;
  },
  
  filter: function(array, callback, scope) {
    var result = [];
    this.each(array, function() {
      if (callback.apply(scope, arguments))
        result.push(arguments[0]);
    });
    return result;
  },
  
  size: function(object) {
    var size = 0;
    this.each(object, function() { size += 1 });
    return size;
  },
  
  enumEqual: function(actual, expected) {
    if (expected instanceof Array) {
      if (!(actual instanceof Array)) return false;
      var i = actual.length;
      if (i !== expected.length) return false;
      while (i--) {
        if (actual[i] !== expected[i]) return false;
      }
      return true;
    } else {
      if (!(actual instanceof Object)) return false;
      if (this.size(expected) !== this.size(actual)) return false;
      var result = true;
      this.each(actual, function(key, value) {
        result = result && (expected[key] === value);
      });
      return result;
    }
  },
  
  asyncEach: function(list, iterator, callback, scope) {
    var n       = list.length,
        i       = -1,
        calls   = 0,
        looping = false;

    var iterate = function() {
      calls -= 1;
      i += 1;
      if (i === n) return callback && callback.call(scope);
      iterator(list[i], resume);
    };

    var loop = function() {
      if (looping) return;
      looping = true;
      while (calls > 0) iterate();
      looping = false;
    };

    var resume = function() {
      calls += 1;
      loop();
    };
    resume();
  },
  
  // http://assanka.net/content/tech/2009/09/02/json2-js-vs-prototype/
  toJSON: function(object) {
    if (this.stringify)
      return this.stringify(object, function(key, value) {
        return (this[key] instanceof Array)
            ? this[key]
            : value;
      });
    
    return JSON.stringify(object);
  },
  
  timestamp: function() {
    var date   = new Date(),
        year   = date.getFullYear(),
        month  = date.getMonth() + 1,
        day    = date.getDate(),
        hour   = date.getHours(),
        minute = date.getMinutes(),
        second = date.getSeconds();
    
    var pad = function(n) {
      return n < 10 ? '0' + n : String(n);
    };
    
    return pad(year) + '-' + pad(month) + '-' + pad(day) + ' ' +
           pad(hour) + ':' + pad(minute) + ':' + pad(second);
  }
});


Faye.Class = function(parent, methods) {
  if (typeof parent !== 'function') {
    methods = parent;
    parent  = Object;
  }
  
  var klass = function() {
    if (!this.initialize) return this;
    return this.initialize.apply(this, arguments) || this;
  };
  
  var bridge = function() {};
  bridge.prototype = parent.prototype;
  
  klass.prototype = new bridge();
  Faye.extend(klass.prototype, methods);
  
  return klass;
};


Faye.Namespace = Faye.Class({
  initialize: function() {
    this._used = {};
  },
  
  exists: function(id) {
    return this._used.hasOwnProperty(id);
  },
  
  generate: function() {
    var name = Faye.random();
    while (this._used.hasOwnProperty(name))
      name = Faye.random();
    return this._used[name] = name;
  },
  
  release: function(id) {
    delete this._used[id];
  }
});


Faye.Error = Faye.Class({
  initialize: function(code, params, message) {
    this.code    = code;
    this.params  = Array.prototype.slice.call(params);
    this.message = message;
  },
  
  toString: function() {
    return this.code + ':' +
           this.params.join(',') + ':' +
           this.message;
  }
});

Faye.Error.parse = function(message) {
  message = message || '';
  if (!Faye.Grammar.ERROR.test(message)) return new this(null, [], message);

  var parts   = message.split(':'),
      code    = parseInt(parts[0]),
      params  = parts[1].split(','),
      message = parts[2];

  return new this(code, params, message);
};


Faye.Error.versionMismatch = function() {
  return new this(300, arguments, "Version mismatch").toString();
};

Faye.Error.conntypeMismatch = function() {
  return new this(301, arguments, "Connection types not supported").toString();
};

Faye.Error.extMismatch = function() {
  return new this(302, arguments, "Extension mismatch").toString();
};

Faye.Error.badRequest = function() {
  return new this(400, arguments, "Bad request").toString();
};

Faye.Error.clientUnknown = function() {
  return new this(401, arguments, "Unknown client").toString();
};

Faye.Error.parameterMissing = function() {
  return new this(402, arguments, "Missing required parameter").toString();
};

Faye.Error.channelForbidden = function() {
  return new this(403, arguments, "Forbidden channel").toString();
};

Faye.Error.channelUnknown = function() {
  return new this(404, arguments, "Unknown channel").toString();
};

Faye.Error.channelInvalid = function() {
  return new this(405, arguments, "Invalid channel").toString();
};

Faye.Error.extUnknown = function() {
  return new this(406, arguments, "Unknown extension").toString();
};

Faye.Error.publishFailed = function() {
  return new this(407, arguments, "Failed to publish").toString();
};

Faye.Error.serverError = function() {
  return new this(500, arguments, "Internal server error").toString();
};



Faye.Deferrable = {
  callback: function(callback, scope) {
    if (!callback) return;
    
    if (this._deferredStatus === 'succeeded')
      return callback.apply(scope, this._deferredArgs);
    
    this._callbacks = this._callbacks || [];
    this._callbacks.push([callback, scope]);
  },
  
  errback: function(callback, scope) {
    if (!callback) return;

    if (this._deferredStatus === 'failed')
      return callback.apply(scope, this._deferredArgs);

    this._errbacks = this._errbacks || [];
    this._errbacks.push([callback, scope]);
  },

  setDeferredStatus: function() {
    var args   = Array.prototype.slice.call(arguments),
        status = args.shift(),
        callbacks;
    
    this._deferredStatus = status;
    this._deferredArgs = args;
    
    if (status === 'succeeded')
      callbacks = this._callbacks;
    else if (status === 'failed')
      callbacks = this._errbacks;
    
    if (!callbacks) return;
    
    var callback;
    while (callback = callbacks.shift())
      callback[0].apply(callback[1], this._deferredArgs);
  }
};


Faye.Publisher = {
  countSubscribers: function(eventType) {
    if (!this._subscribers || !this._subscribers[eventType]) return 0;
    return this._subscribers[eventType].length;
  },
  
  addSubscriber: function(eventType, listener, context) {
    this._subscribers = this._subscribers || {};
    var list = this._subscribers[eventType] = this._subscribers[eventType] || [];
    list.push([listener, context]);
  },
  
  removeSubscriber: function(eventType, listener, context) {
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    if (!listener) {
      delete this._subscribers[eventType];
      return;
    }
    var list = this._subscribers[eventType],
        i    = list.length;
    
    while (i--) {
      if (listener !== list[i][0]) continue;
      if (context && list[i][1] !== context) continue;
      list.splice(i,1);
    }
  },
  
  removeSubscribers: function() {
    this._subscribers = {};
  },
  
  publishEvent: function() {
    var args = Array.prototype.slice.call(arguments),
        eventType = args.shift();
    
    if (!this._subscribers || !this._subscribers[eventType]) return;
    
    Faye.each(this._subscribers[eventType], function(listener) {
      listener[0].apply(listener[1], args);
    });
  }
};


Faye.Timeouts = {
  addTimeout: function(name, delay, callback, scope) {
    this._timeouts = this._timeouts || {};
    if (this._timeouts.hasOwnProperty(name)) return;
    var self = this;
    this._timeouts[name] = Faye.ENV.setTimeout(function() {
      delete self._timeouts[name];
      callback.call(scope);
    }, 1000 * delay);
  },
  
  removeTimeout: function(name) {
    this._timeouts = this._timeouts || {};
    var timeout = this._timeouts[name];
    if (!timeout) return;
    clearTimeout(timeout);
    delete this._timeouts[name];
  }
};


Faye.Logging = {
  LOG_LEVELS: {
    error:  3,
    warn:   2,
    info:   1,
    debug:  0
  },
  
  logLevel: 'error',
  
  log: function(messageArgs, level) {
    if (!Faye.logger) return;
    
    var levels = Faye.Logging.LOG_LEVELS;
    if (levels[Faye.Logging.logLevel] > levels[level]) return;
    
    var messageArgs = Array.prototype.slice.apply(messageArgs),
        banner = ' [' + level.toUpperCase() + '] [Faye',
        klass  = this.className,
        
        message = messageArgs.shift().replace(/\?/g, function() {
          try {
            return Faye.toJSON(messageArgs.shift());
          } catch (e) {
            return '[Object]';
          }
        });
    
    for (var key in Faye) {
      if (klass) continue;
      if (typeof Faye[key] !== 'function') continue;
      if (this instanceof Faye[key]) klass = key;
    }
    if (klass) banner += '.' + klass;
    banner += '] ';
    
    Faye.logger(Faye.timestamp() + banner + message);
  }
};

Faye.each(Faye.Logging.LOG_LEVELS, function(level, value) {
  Faye.Logging[level] = function() {
    this.log(arguments, level);
  };
});


Faye.Grammar = {

  LOWALPHA:     /^[a-z]$/,

  UPALPHA:     /^[A-Z]$/,

  ALPHA:     /^([a-z]|[A-Z])$/,

  DIGIT:     /^[0-9]$/,

  ALPHANUM:     /^(([a-z]|[A-Z])|[0-9])$/,

  MARK:     /^(\-|\_|\!|\~|\(|\)|\$|\@)$/,

  STRING:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*$/,

  TOKEN:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+$/,

  INTEGER:     /^([0-9])+$/,

  CHANNEL_SEGMENT:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+$/,

  CHANNEL_SEGMENTS:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*$/,

  CHANNEL_NAME:     /^\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*$/,

  WILD_CARD:     /^\*{1,2}$/,

  CHANNEL_PATTERN:     /^(\/(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)))+)*\/\*{1,2}$/,

  VERSION_ELEMENT:     /^(([a-z]|[A-Z])|[0-9])(((([a-z]|[A-Z])|[0-9])|\-|\_))*$/,

  VERSION:     /^([0-9])+(\.(([a-z]|[A-Z])|[0-9])(((([a-z]|[A-Z])|[0-9])|\-|\_))*)*$/,

  CLIENT_ID:     /^((([a-z]|[A-Z])|[0-9]))+$/,

  ID:     /^((([a-z]|[A-Z])|[0-9]))+$/,

  ERROR_MESSAGE:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*$/,

  ERROR_ARGS:     /^(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*(,(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)*$/,

  ERROR_CODE:     /^[0-9][0-9][0-9]$/,

  ERROR:     /^([0-9][0-9][0-9]:(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*(,(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)*:(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*|[0-9][0-9][0-9]::(((([a-z]|[A-Z])|[0-9])|(\-|\_|\!|\~|\(|\)|\$|\@)| |\/|\*|\.))*)$/

};


Faye.Extensible = {
  addExtension: function(extension) {
    this._extensions = this._extensions || [];
    this._extensions.push(extension);
    if (extension.added) extension.added();
  },
  
  removeExtension: function(extension) {
    if (!this._extensions) return;
    var i = this._extensions.length;
    while (i--) {
      if (this._extensions[i] !== extension) continue;
      this._extensions.splice(i,1);
      if (extension.removed) extension.removed();
    }
  },
  
  pipeThroughExtensions: function(stage, message, callback, scope) {
    this.debug('Passing through ? extensions: ?', stage, message);

    if (!this._extensions) return callback.call(scope, message);
    var extensions = this._extensions.slice();
    
    var pipe = function(message) {
      if (!message) return callback.call(scope, message);
      
      var extension = extensions.shift();
      if (!extension) return callback.call(scope, message);
      
      if (extension[stage]) extension[stage](message, pipe);
      else pipe(message);
    };
    pipe(message);
  }
};

Faye.extend(Faye.Extensible, Faye.Logging);


Faye.Channel = Faye.Class({
  initialize: function(name) {
    this.id = this.name = name;
  },
  
  push: function(message) {
    this.publishEvent('message', message);
  },
  
  isUnused: function() {
    return this.countSubscribers('message') === 0;
  }
});

Faye.extend(Faye.Channel.prototype, Faye.Publisher);

Faye.extend(Faye.Channel, {
  HANDSHAKE:    '/meta/handshake',
  CONNECT:      '/meta/connect',
  SUBSCRIBE:    '/meta/subscribe',
  UNSUBSCRIBE:  '/meta/unsubscribe',
  DISCONNECT:   '/meta/disconnect',
  
  META:         'meta',
  SERVICE:      'service',
  
  expand: function(name) {
    var segments = this.parse(name),
        channels = ['/**', name];
    
    var copy = segments.slice();
    copy[copy.length - 1] = '*';
    channels.push(this.unparse(copy));
    
    for (var i = 1, n = segments.length; i < n; i++) {
      copy = segments.slice(0, i);
      copy.push('**');
      channels.push(this.unparse(copy));
    }
    
    return channels;
  },
  
  isValid: function(name) {
    return Faye.Grammar.CHANNEL_NAME.test(name) ||
           Faye.Grammar.CHANNEL_PATTERN.test(name);
  },
  
  parse: function(name) {
    if (!this.isValid(name)) return null;
    return name.split('/').slice(1);
  },
  
  unparse: function(segments) {
    return '/' + segments.join('/');
  },
  
  isMeta: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.META) : null;
  },
  
  isService: function(name) {
    var segments = this.parse(name);
    return segments ? (segments[0] === this.SERVICE) : null;
  },
  
  isSubscribable: function(name) {
    if (!this.isValid(name)) return null;
    return !this.isMeta(name) && !this.isService(name);
  },
  
  Set: Faye.Class({
    initialize: function() {
      this._channels = {};
    },
    
    getKeys: function() {
      var keys = [];
      Faye.each(this._channels, function(k,v) { keys.push(k) });
      return keys;
    },
    
    remove: function(name) {
      delete this._channels[name];
    },
    
    hasSubscription: function(name) {
      return this._channels.hasOwnProperty(name);
    },
    
    subscribe: function(names, callback, scope) {
      if (!callback) return;
      Faye.each(names, function(name) {
        var channel = this._channels[name] = this._channels[name] || new Faye.Channel(name);
        channel.addSubscriber('message', callback, scope);
      }, this);
    },
    
    unsubscribe: function(name, callback, scope) {
      var channel = this._channels[name];
      if (!channel) return false;
      channel.removeSubscriber('message', callback, scope);
      
      if (channel.isUnused()) {
        this.remove(name);
        return true;
      } else {
        return false;
      }
    },
    
    distributeMessage: function(message) {
      var channels = Faye.Channel.expand(message.channel);
      Faye.each(channels, function(name) {
        var channel = this._channels[name];
        if (channel) channel.publishEvent('message', message.data);
      }, this);
    }
  })
});


Faye.Subscription = Faye.Class({
  initialize: function(client, channels, callback, scope) {
    this._client    = client;
    this._channels  = channels;
    this._callback  = callback;
    this._scope     = scope;
    this._cancelled = false;
  },
  
  cancel: function() {
    if (this._cancelled) return;
    this._client.unsubscribe(this._channels, this._callback, this._scope);
    this._cancelled = true;
  },
  
  unsubscribe: function() {
    this.cancel();
  }
});

Faye.extend(Faye.Subscription.prototype, Faye.Deferrable);


Faye.Client = Faye.Class({
  UNCONNECTED:          1,
  CONNECTING:           2,
  CONNECTED:            3,
  DISCONNECTED:         4,
  
  HANDSHAKE:            'handshake',
  RETRY:                'retry',
  NONE:                 'none',
  
  CONNECTION_TIMEOUT:   60.0,
  
  DEFAULT_ENDPOINT:     '/bayeux',
  INTERVAL:             0.0,
  
  initialize: function(endpoint, options) {
    this.info('New client created for ?', endpoint);
    
    this.endpoint   = endpoint || this.DEFAULT_ENDPOINT;
    this._options   = options || {};
    
    Faye.Transport.get(this, Faye.MANDATORY_CONNECTION_TYPES, function(transport) {
      this._transport = transport;
    }, this);
    
    this._state     = this.UNCONNECTED;
    this._channels  = new Faye.Channel.Set();
    this._messageId = 0;
    
    this._responseCallbacks = {};
    
    this._advice = {
      reconnect: this.RETRY,
      interval:  1000 * (this._options.interval || this.INTERVAL),
      timeout:   1000 * (this._options.timeout  || this.CONNECTION_TIMEOUT)
    };
    
    if (Faye.Event) Faye.Event.on(Faye.ENV, 'beforeunload',
                                  this.disconnect, this);
  },
  
  getClientId: function() {
    return this._clientId;
  },

  getState: function() {
    switch (this._state) {
      case this.UNCONNECTED:  return 'UNCONNECTED';
      case this.CONNECTING:   return 'CONNECTING';
      case this.CONNECTED:    return 'CONNECTED';
      case this.DISCONNECTED: return 'DISCONNECTED';
    }
  },

  // Request
  // MUST include:  * channel
  //                * version
  //                * supportedConnectionTypes
  // MAY include:   * minimumVersion
  //                * ext
  //                * id
  // 
  // Success Response                             Failed Response
  // MUST include:  * channel                     MUST include:  * channel
  //                * version                                    * successful
  //                * supportedConnectionTypes                   * error
  //                * clientId                    MAY include:   * supportedConnectionTypes
  //                * successful                                 * advice
  // MAY include:   * minimumVersion                             * version
  //                * advice                                     * minimumVersion
  //                * ext                                        * ext
  //                * id                                         * id
  //                * authSuccessful
  handshake: function(callback, scope) {
    if (this._advice.reconnect === this.NONE) return;
    if (this._state !== this.UNCONNECTED) return;
    
    this._state = this.CONNECTING;
    var self = this;
    
    this.info('Initiating handshake with ?', this.endpoint);
    
    this._send({
      channel:      Faye.Channel.HANDSHAKE,
      version:      Faye.BAYEUX_VERSION,
      supportedConnectionTypes: [this._transport.connectionType]
      
    }, function(response) {
      
      if (response.successful) {
        this._state     = this.CONNECTED;
        this._clientId  = response.clientId;
        
        Faye.Transport.get(this, response.supportedConnectionTypes, function(transport) {
          this._transport = transport;
        }, this);
        
        this.info('Handshake successful: ?', this._clientId);
        
        this.subscribe(this._channels.getKeys(), true);
        if (callback) callback.call(scope);
        
      } else {
        this.info('Handshake unsuccessful');
        Faye.ENV.setTimeout(function() { self.handshake(callback, scope) }, this._advice.interval);
        this._state = this.UNCONNECTED;
      }
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * connectionType                     * clientId
  // MAY include:   * ext                 MAY include:   * error
  //                * id                                 * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  connect: function(callback, scope) {
    if (this._advice.reconnect === this.NONE) return;
    if (this._state === this.DISCONNECTED) return;
    
    if (this._state === this.UNCONNECTED)
      return this.handshake(function() { this.connect(callback, scope) }, this);
    
    this.callback(callback, scope);
    if (this._state !== this.CONNECTED) return;
    
    this.info('Calling deferred actions for ?', this._clientId);
    this.setDeferredStatus('succeeded');
    this.setDeferredStatus('deferred');
    
    if (this._connectRequest) return;
    this._connectRequest = true;
    
    this.info('Initiating connection for ?', this._clientId);
    
    this._send({
      channel:        Faye.Channel.CONNECT,
      clientId:       this._clientId,
      connectionType: this._transport.connectionType
      
    }, this._cycleConnection, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  // MAY include:   * ext                                * clientId
  //                * id                  MAY include:   * error
  //                                                     * ext
  //                                                     * id
  disconnect: function() {
    if (this._state !== this.CONNECTED) return;
    this._state = this.DISCONNECTED;
    
    this.info('Disconnecting ?', this._clientId);
    
    this._send({
      channel:    Faye.Channel.DISCONNECT,
      clientId:   this._clientId
    });
    
    this.info('Clearing channel listeners for ?', this._clientId);
    this._channels = new Faye.Channel.Set();
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  subscribe: function(channels, callback, scope) {
    if (channels instanceof Array)
      return  Faye.each(channels, function(channel) {
                this.subscribe(channel, callback, scope);
              }, this);
    
    var subscription = new Faye.Subscription(this, channels, callback, scope);
    
    var force = (callback === true);
    
    if (!force && this._channels.hasSubscription(channels)) {
      this._channels.subscribe([channels], callback, scope);
      subscription.setDeferredStatus('succeeded');
      return subscription;
    }
    
    this.connect(function() {
      this.info('Client ? attempting to subscribe to ?', this._clientId, channels);
      
      this._send({
        channel:      Faye.Channel.SUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, function(response) {
        if (!response.successful)
          return subscription.setDeferredStatus('failed', Faye.Error.parse(response.error));
        
        var channels = [].concat(response.subscription);
        this.info('Subscription acknowledged for ? to ?', this._clientId, channels);
        if (!force) this._channels.subscribe(channels, callback, scope);
        
        subscription.setDeferredStatus('succeeded');
      }, this);
      
    }, this);
    
    return subscription;
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * clientId                           * successful
  //                * subscription                       * clientId
  // MAY include:   * ext                                * subscription
  //                * id                  MAY include:   * error
  //                                                     * advice
  //                                                     * ext
  //                                                     * id
  //                                                     * timestamp
  unsubscribe: function(channels, callback, scope) {
    if (channels instanceof Array)
      return  Faye.each(channels, function(channel) {
                this.unsubscribe(channel, callback, scope);
              }, this);
    
    var dead = this._channels.unsubscribe(channels, callback, scope);
    if (!dead) return;
    
    this.connect(function() {
      this.info('Client ? attempting to unsubscribe from ?', this._clientId, channels);
      
      this._send({
        channel:      Faye.Channel.UNSUBSCRIBE,
        clientId:     this._clientId,
        subscription: channels
        
      }, function(response) {
        if (!response.successful) return;
        
        var channels = [].concat(response.subscription);
        this.info('Unsubscription acknowledged for ? from ?', this._clientId, channels);
      }, this);
      
    }, this);
  },
  
  // Request                              Response
  // MUST include:  * channel             MUST include:  * channel
  //                * data                               * successful
  // MAY include:   * clientId            MAY include:   * id
  //                * id                                 * error
  //                * ext                                * ext
  publish: function(channel, data) {
    if (!Faye.Grammar.CHANNEL_NAME.test(channel))
      throw new Error("Cannot publish: '" + channel + "' is not a valid channel name");
    
    this.connect(function() {
      this.info('Client ? queueing published message to ?: ?', this._clientId, channel, data);
      
      this._send({
        channel:      channel,
        data:         data,
        clientId:     this._clientId
      });
    }, this);
  },
  
  receiveMessage: function(message) {
    this.pipeThroughExtensions('incoming', message, function(message) {
      if (!message) return;
      
      if (message.advice) this._handleAdvice(message.advice);
      
      var callback = this._responseCallbacks[message.id];
      if (callback) {
        delete this._responseCallbacks[message.id];
        callback[0].call(callback[1], message);
      }
      
      this._deliverMessage(message);
    }, this);
  },
  
  _send: function(message, callback, scope) {
    message.id = this._generateMessageId();
    if (callback) this._responseCallbacks[message.id] = [callback, scope];

    this.pipeThroughExtensions('outgoing', message, function(message) {
      if (!message) return;
      this._transport.send(message, this._advice.timeout / 1000);
    }, this);
  },
  
  _generateMessageId: function() {
    this._messageId += 1;
    if (this._messageId >= Math.pow(2,32)) this._messageId = 0;
    return this._messageId.toString(36);
  },

  _handleAdvice: function(advice) {
    Faye.extend(this._advice, advice);
    
    if (this._advice.reconnect === this.HANDSHAKE && this._state !== this.DISCONNECTED) {
      this._state    = this.UNCONNECTED;
      this._clientId = null;
      this._cycleConnection();
    }
  },
  
  _deliverMessage: function(message) {
    if (!message.channel || !message.data) return;
    this.info('Client ? calling listeners for ? with ?', this._clientId, message.channel, message.data);
    this._channels.distributeMessage(message);
  },
  
  _teardownConnection: function() {
    if (!this._connectRequest) return;
    this._connectRequest = null;
    this.info('Closed connection for ?', this._clientId);
  },
  
  _cycleConnection: function() {
    this._teardownConnection();
    var self = this;
    Faye.ENV.setTimeout(function() { self.connect() }, this._advice.interval);
  }
});

Faye.extend(Faye.Client.prototype, Faye.Deferrable);
Faye.extend(Faye.Client.prototype, Faye.Logging);
Faye.extend(Faye.Client.prototype, Faye.Extensible);


Faye.Transport = Faye.extend(Faye.Class({
  MAX_DELAY: 0.0,
  batching:  true,

  initialize: function(client, endpoint) {
    this.debug('Created new ? transport for ?', this.connectionType, endpoint);
    this._client   = client;
    this._endpoint = endpoint;
    this._outbox   = [];
  },
  
  send: function(message, timeout) {
    this.debug('Client ? sending message to ?: ?',
               this._client._clientId, this._endpoint, message);

    if (!this.batching) return this.request([message], timeout);

    this._outbox.push(message);
    this._timeout = timeout;

    if (message.channel === Faye.Channel.HANDSHAKE)
      return this.flush();

    if (message.channel === Faye.Channel.CONNECT)
      this._connectMessage = message;

    this.addTimeout('publish', this.MAX_DELAY, this.flush, this);
  },

  flush: function() {
    this.removeTimeout('publish');

    if (this._outbox.length > 1 && this._connectMessage)
      this._connectMessage.advice = {timeout: 0};

    this.request(this._outbox, this._timeout);
    
    this._connectMessage = null;
    this._outbox = [];
  },
  
  receive: function(responses) {
    this.debug('Client ? received from ?: ?',
               this._client._clientId, this._endpoint, responses);
    
    Faye.each(responses, this._client.receiveMessage, this._client);
  },
  
  retry: function(message, timeout) {
    var self = this;
    return function() {
      Faye.ENV.setTimeout(function() { self.request(message, 2 * timeout) }, 1000 * timeout);
    };
  }
  
}), {
  get: function(client, connectionTypes, callback, scope) {
    var endpoint = client.endpoint;
    if (connectionTypes === undefined) connectionTypes = this.supportedConnectionTypes();
    
    Faye.asyncEach(this._transports, function(pair, resume) {
      var connType = pair[0], klass = pair[1];
      if (Faye.indexOf(connectionTypes, connType) < 0) return resume();
      
      klass.isUsable(endpoint, function(isUsable) {
        if (isUsable) callback.call(scope, new klass(client, endpoint));
        else resume();
      });
    }, function() {
      throw new Error('Could not find a usable connection type for ' + endpoint);
    });
  },
  
  register: function(type, klass) {
    this._transports.push([type, klass]);
    klass.prototype.connectionType = type;
  },
  
  _transports: [],
  
  supportedConnectionTypes: function() {
    return Faye.map(this._transports, function(pair) { return pair[0] });
  }
});

Faye.extend(Faye.Transport.prototype, Faye.Logging);
Faye.extend(Faye.Transport.prototype, Faye.Timeouts);


Faye.Set = Faye.Class({
  initialize: function() {
    this._index = {};
  },
  
  add: function(item) {
    var key = (item.id !== undefined) ? item.id : item;
    if (this._index.hasOwnProperty(key)) return false;
    this._index[key] = item;
    return true;
  },
  
  forEach: function(block, scope) {
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key))
        block.call(scope, this._index[key]);
    }
  },
  
  isEmpty: function() {
    for (var key in this._index) {
      if (this._index.hasOwnProperty(key)) return false;
    }
    return true;
  },
  
  member: function(item) {
    for (var key in this._index) {
      if (this._index[key] === item) return true;
    }
    return false;
  },
  
  remove: function(item) {
    var key = (item.id !== undefined) ? item.id : item;
    delete this._index[key];
  },
  
  toArray: function() {
    var array = [];
    this.forEach(function(item) { array.push(item) });
    return array;
  }
});


/**
 * Generic WebSocket implementation for Node
 * -----------------------------------------
 * 
 * Though primarily here to support WebSockets as a network
 * transport in Faye, it would be nice for this class to
 * implement the same interface as the client-side WebSocket
 * for ease of use.
 * 
 * For implementation reference:
 * http://dev.w3.org/html5/websockets/
 * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-75
 * http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76
 * http://www.w3.org/TR/DOM-Level-2-Events/events.html
 **/

var Buffer = require('buffer').Buffer,
    crypto = require('crypto');

Faye.WebSocket = Faye.Class({
  onopen:     null,
  onmessage:  null,
  onerror:    null,
  onclose:    null,
  
  initialize: function(request, head) {
    this._request = request;
    this._head    = head;
    this._stream  = request.socket;
    
    var scheme = Faye.WebSocket.isSecureConnection(request) ? 'wss:' : 'ws:';
    this.url = scheme + '//' + request.headers.host + request.url;    
    this.readyState = Faye.WebSocket.CONNECTING;
    this.bufferedAmount = 0;
    
    this._handler = Faye.WebSocket.getHandler(request);
    this._handler.handshake(this.url, this._request, this._head, this._stream);
    this.readyState = Faye.WebSocket.OPEN;
    
    var event = new Faye.WebSocket.Event();
    event.initEvent('open', false, false);
    this.dispatchEvent(event);
    
    this._buffer = [];
    this._buffering = false;
    
    var self = this;
    
    this._stream.addListener('data', function(data) {
      for (var i = 0, n = data.length; i < n; i++)
        self._handleChar(data[i]);
    });
  },
  
  send: function(data) {
    this._handler.send(this._stream, data);
    return true;
  },
  
  close: function() {},
  
  addEventListener: function(type, listener, useCapture) {
    this.addSubscriber(type, listener);
  },
  
  removeEventListener: function(type, listener, useCapture) {
    this.removeSubscriber(type, listener);
  },
  
  dispatchEvent: function(event) {
    event.target = event.currentTarget = this;
    event.eventPhase = Faye.WebSocket.Event.AT_TARGET;
    
    this.publishEvent(event.type, event);
    if (this['on' + event.type])
      this['on' + event.type](event);
  },
  
  _handleChar: function(data) {
    switch (data) {
      case 0x00:
        this._buffering = true;
        break;
      
      case 0xFF:
        this._buffer = new Buffer(this._buffer);
        
        var event = new Faye.WebSocket.Event();
        event.initEvent('message', false, false);
        event.data = this._buffer.toString('utf8', 0, this._buffer.length);
        
        this.dispatchEvent(event);
        
        this._buffer = [];
        this._buffering = false;
        break;
      
      default:
        if (this._buffering) this._buffer.push(data);
    }
  }
});

Faye.extend(Faye.WebSocket.prototype, Faye.Publisher);

Faye.extend(Faye.WebSocket, {
  CONNECTING:   0,
  OPEN:         1,
  CLOSING:      2,
  CLOSED:       3,
  
  Event: Faye.extend(Faye.Class({
    initEvent: function(eventType, canBubble, cancelable) {
      this.type       = eventType;
      this.bubbles    = canBubble;
      this.cancelable = cancelable;
    },
    
    stopPropagation: function() {},
    preventDefault: function() {}
    
  }), {
    CAPTURING_PHASE:  1,
    AT_TARGET:        2,
    BUBBLING_PHASE:   3
  }),
  
  getHandler: function(request) {
    var headers = request.headers;
    return (headers['sec-websocket-key1'] && headers['sec-websocket-key2'])
         ? this.Protocol76
         : this.Protocol75;
  },
  
  isSecureConnection: function(request) {
    if (request.headers['x-forwarded-proto']) {
      return request.headers['x-forwarded-proto'] === 'https';
    } else {
      return (request.connection && request.connection.authorized !== undefined) ||
             (request.socket && request.socket.secure);
    }
  }
});

(function() {
  var byteToChar = function(value) {
    if (typeof value === 'string') value = parseInt(value, 16);
    return String.fromCharCode(value);
  };
  
  var numberFromKey = function(key) {
    return parseInt(key.match(/[0-9]/g).join(''), 10);
  };
  
  var spacesInKey = function(key) {
    return key.match(/ /g).length;
  };
  
  var bigEndian = function(number) {
    var string = '';
    Faye.each([24,16,8,0], function(offset) {
      string += String.fromCharCode(number >> offset & 0xFF);
    });
    return string;
  };
  
  var writeToSocket = function(socket, message) {
    socket.write(FRAME_START, 'binary');
    socket.write(message, 'utf8');
    socket.write(FRAME_END, 'binary');
  };
  
  var FRAME_START = byteToChar('00'),
      FRAME_END   = byteToChar('FF');
  
  Faye.WebSocket.Protocol75 = {
    handshake: function(url, request, head, socket) {
      try {
        socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n');
        socket.write('Upgrade: WebSocket\r\n');
        socket.write('Connection: Upgrade\r\n');
        socket.write('WebSocket-Origin: ' + request.headers.origin + '\r\n');
        socket.write('WebSocket-Location: ' + url + '\r\n');
        socket.write('\r\n');
      } catch (e) {
        // socket closed while writing
        // no handshake sent; client will stop using WebSocket
      }
    },
    
    send: function(socket, message) {
      writeToSocket(socket, message);
    }
  };
  
  Faye.WebSocket.Protocol76 = {
    handshake: function(url, request, head, socket) {
      var key1   = request.headers['sec-websocket-key1'],
          value1 = numberFromKey(key1) / spacesInKey(key1),
          
          key2   = request.headers['sec-websocket-key2'],
          value2 = numberFromKey(key2) / spacesInKey(key2),
          
          MD5    = crypto.createHash('md5');
      
      MD5.update(bigEndian(value1));
      MD5.update(bigEndian(value2));
      MD5.update(head.toString('binary'));
      
      try {
        socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n', 'binary');
        socket.write('Upgrade: WebSocket\r\n', 'binary');
        socket.write('Connection: Upgrade\r\n', 'binary');
        socket.write('Sec-WebSocket-Origin: ' + request.headers.origin + '\r\n', 'binary');
        socket.write('Sec-WebSocket-Location: ' + url + '\r\n', 'binary');
        socket.write('\r\n', 'binary');
        socket.write(MD5.digest('binary'), 'binary');
      } catch (e) {
        // socket closed while writing
        // no handshake sent; client will stop using WebSocket
      }
    },
    
    send: function(socket, message) {
      writeToSocket(socket, message);
    }
  }
})();


Faye.Engine = {
  register: function(type, klass) {
    this._backends = this._backends || {};
    this._backends[type] = klass;
  },
  
  get: function(options) {
    options = options || {};
    var klass = this._backends[options.type] || Faye.Engine.Memory;
    return new klass(options);
  }
};

Faye.Engine.Base = Faye.Class({
  MAX_DELAY:  0.0,
  INTERVAL:   0.0,
  TIMEOUT:    60.0,
  
  initialize: function(options) {
    this._options     = options || {};
    this._connections = {};
    this.interval     = this._options.interval || this.INTERVAL;
    this.timeout      = this._options.timeout  || this.TIMEOUT;

    this.debug('Created new engine: ?', this._options);
  },
  
  connect: function(clientId, options, callback, scope) {
    this.debug('Accepting connection from ?', clientId);
    this.ping(clientId);
    var conn = this.connection(clientId, true);
    conn.connect(options, callback, scope);
    this.emptyQueue(clientId);
  },
  
  connection: function(clientId, create) {
    var conn = this._connections[clientId];
    if (conn || !create) return conn;
    return this._connections[clientId] = new Faye.Engine.Connection(this, clientId);
  },
  
  closeConnection: function(clientId) {
    this.debug('Closing connection for ?', clientId);
    delete this._connections[clientId];
  },
  
  flush: function(clientId) {
    this.debug('Flushing message queue for ?', clientId);
    var conn = this._connections[clientId];
    if (conn) conn.flush();
  }
});

Faye.extend(Faye.Engine.Base.prototype, Faye.Logging);


Faye.Engine.Connection = Faye.Class({
  initialize: function(engine, id, options) {
    this._engine  = engine;
    this.id       = id;
    this._options = options;
    this._inbox   = new Faye.Set();
  },
  
  deliver: function(message) {
    if (!this._inbox.add(message)) return;
    this._beginDeliveryTimeout();
  },
  
  connect: function(options, callback, scope) {
    options = options || {};
    var timeout = (options.timeout !== undefined) ? options.timeout / 1000 : this._engine.timeout;
    
    this.setDeferredStatus('deferred');
    
    this.callback(callback, scope);
    if (this._connected) return;
    
    this._connected = true;
    
    this._beginDeliveryTimeout();
    this._beginConnectionTimeout(timeout);
  },
  
  flush: function() {
    this._releaseConnection();
    this.setDeferredStatus('succeeded', this._inbox.toArray());
  },
  
  _releaseConnection: function() {
    this._engine.closeConnection(this.id);
    this.removeTimeout('connection');
    this.removeTimeout('delivery');
    this._connected = false;
  },
  
  _beginDeliveryTimeout: function() {
    if (this._inbox.isEmpty()) return;
    this.addTimeout('delivery', this._engine.MAX_DELAY, this.flush, this);
  },
  
  _beginConnectionTimeout: function(timeout) {
    this.addTimeout('connection', timeout, this.flush, this);
  }
});

Faye.extend(Faye.Engine.Connection.prototype, Faye.Deferrable);
Faye.extend(Faye.Engine.Connection.prototype, Faye.Timeouts);


Faye.Engine.Memory = Faye.Class(Faye.Engine.Base, {
  className: 'Engine.Memory',

  initialize: function(options) {
    this._namespace = new Faye.Namespace();
    this._clients   = {};
    this._channels  = {};
    this._messages  = {};
    
    Faye.Engine.Base.prototype.initialize.call(this, options);
  },
  
  createClient: function(callback, scope) {
    var clientId = this._namespace.generate();
    this.debug('Created new client ?', clientId);
    this.ping(clientId);
    callback.call(scope, clientId);
  },
  
  destroyClient: function(clientId, callback, scope) {
    var clients = this._clients;
    if (!this._namespace.exists(clientId)) return;
    
    if (clients[clientId])
      clients[clientId].forEach(function(channel) { this.unsubscribe(clientId, channel) }, this);
    
    this.removeTimeout(clientId);
    this._namespace.release(clientId);
    delete this._messages[clientId];
    this.debug('Destroyed client ?', clientId);
    if (callback) callback.call(scope);
  },
  
  clientExists: function(clientId, callback, scope) {
    callback.call(scope, this._namespace.exists(clientId));
  },
  
  ping: function(clientId) {
    if (typeof this.timeout !== 'number') return;
    this.debug('Ping ?, ?', clientId, this.timeout);
    this.removeTimeout(clientId);
    this.addTimeout(clientId, 2 * this.timeout, function() {
      this.destroyClient(clientId);
    }, this);
  },
  
  subscribe: function(clientId, channel, callback, scope) {
    var clients = this._clients, channels = this._channels;
    
    clients[clientId] = clients[clientId] || new Faye.Set();
    clients[clientId].add(channel);
    
    channels[channel] = channels[channel] || new Faye.Set();
    channels[channel].add(clientId);
    
    this.debug('Subscribed client ? to channel ?', clientId, channel);
    if (callback) callback.call(scope, true);
  },
  
  unsubscribe: function(clientId, channel, callback, scope) {
    var clients = this._clients, channels = this._channels;
    
    if (clients[clientId]) {
      clients[clientId].remove(channel);
      if (clients[clientId].isEmpty()) delete clients[clientId];
    }
    
    if (channels[channel]) {
      channels[channel].remove(clientId);
      if (channels[channel].isEmpty()) delete channels[channel];
    }
    
    this.debug('Unsubscribed client ? from channel ?', clientId, channel);
    if (callback) callback.call(scope, true);
  },
  
  publish: function(message) {
    this.debug('Publishing message ?', message);

    var channels = Faye.Channel.expand(message.channel),
        messages = this._messages;
    
    Faye.each(channels, function(channel) {
      var clients = this._channels[channel];
      if (!clients) return;
      clients.forEach(function(clientId) {
        this.debug('Queueing for client ?: ?', clientId, message);
        messages[clientId] = messages[clientId] || new Faye.Set();
        messages[clientId].add(message);
        this.emptyQueue(clientId);
      }, this);
    }, this);
  },
  
  emptyQueue: function(clientId) {
    var conn = this.connection(clientId, false),
        messages = this._messages[clientId];
    
    if (!conn || !messages) return;
    delete this._messages[clientId];
    messages.forEach(conn.deliver, conn);
  }
});
Faye.extend(Faye.Engine.Memory.prototype, Faye.Timeouts);

Faye.Engine.register('memory', Faye.Engine.Memory);


Faye.Engine.Redis = Faye.Class(Faye.Engine.Base, {
  DEFAULT_HOST:     'localhost',
  DEFAULT_PORT:     6379,
  DEFAULT_DATABASE: 0,
  DEFAULT_GC:       60,
  LOCK_TIMEOUT:     120,
  
  className: 'Engine.Redis',

  initialize: function(options) {
    Faye.Engine.Base.prototype.initialize.call(this, options);
    
    var redis = require('redis'),
        host  = this._options.host     || this.DEFAULT_HOST,
        port  = this._options.port     || this.DEFAULT_PORT,
        db    = this._options.database || this.DEFAULT_DATABASE,
        auth  = this._options.password,
        gc    = this._options.gc       || this.DEFAULT_GC;
    
    this._ns  = this._options.namespace;
    
    this._redis = redis.createClient(port, host, {no_ready_check: true});
    this._subscriber = redis.createClient(port, host, {no_ready_check: true});
    
    if (auth) {
      this._redis.auth(auth);
      this._subscriber.auth(auth);
    }
    this._redis.select(db);
    this._subscriber.select(db);
    
    var self = this;
    this._subscriber.subscribe(this._ns + '/notifications');
    this._subscriber.on('message', function(topic, message) {
      self.emptyQueue(message);
    });
    
    this._gc = setInterval(function() { self.gc() }, gc * 1000);
  },
  
  disconnect: function() {
    this._redis.end();
    this._subscriber.unsubscribe();
    this._subscriber.end();
    clearInterval(this._gc);
  },
  
  createClient: function(callback, scope) {
    var clientId = Faye.random(), self = this;
    this.debug('Created new client ?', clientId);
    this._redis.zadd(this._ns + '/clients', 0, clientId, function(error, added) {
      if (added === 0) return self.createClient(callback, scope);
      self.ping(clientId);
      callback.call(scope, clientId);
    });
  },
  
  destroyClient: function(clientId, callback, scope) {
    var self = this;
    this._redis.zrem(this._ns + '/clients', clientId);
    this._redis.del(this._ns + '/clients/' + clientId + '/messages');
    
    this._redis.smembers(this._ns + '/clients/' + clientId + '/channels', function(error, channels) {
      var n = channels.length, i = 0;
      if (n === 0) return callback && callback.call(scope);
      
      Faye.each(channels, function(channel) {
        self.unsubscribe(clientId, channel, function() {
          i += 1;
          if (i === n) {
            self.debug('Destroyed client ?', clientId);
            if (callback) callback.call(scope);
          }
        });
      });
    });
  },
  
  clientExists: function(clientId, callback, scope) {
    this._redis.zscore(this._ns + '/clients', clientId, function(error, score) {
      callback.call(scope, score !== null);
    });
  },
  
  ping: function(clientId) {
    if (typeof this.timeout !== 'number') return;
    
    var time    = new Date().getTime(),
        self    = this;
    
    this.debug('Ping ?, ?', clientId, time);
    this._redis.zadd(this._ns + '/clients', time, clientId);
  },
  
  subscribe: function(clientId, channel, callback, scope) {
    var self = this;
    this._redis.sadd(this._ns + '/clients/' + clientId + '/channels', channel);
    this._redis.sadd(this._ns + '/channels' + channel, clientId, function() {
      self.debug('Subscribed client ? to channel ?', clientId, channel);
      if (callback) callback.call(scope);
    });
  },
  
  unsubscribe: function(clientId, channel, callback, scope) {
    var self = this;
    this._redis.srem(this._ns + '/clients/' + clientId + '/channels', channel);
    this._redis.srem(this._ns + '/channels' + channel, clientId, function() {
      self.debug('Unsubscribed client ? from channel ?', clientId, channel);
      if (callback) callback.call(scope);
    });
  },
  
  publish: function(message) {
    this.debug('Publishing message ?', message);

    var self        = this,
        jsonMessage = JSON.stringify(message),
        channels    = Faye.Channel.expand(message.channel),
        keys        = Faye.map(channels, function(c) { return self._ns + '/channels' + c });
    
    var notify = function(error, clients) {
      Faye.each(clients, function(clientId) {
        self.debug('Queueing for client ?: ?', clientId, message);
        self._redis.rpush(self._ns + '/clients/' + clientId + '/messages', jsonMessage);
        self._redis.publish(self._ns + '/notifications', clientId);
      });
    };
    keys.push(notify);
    this._redis.sunion.apply(this._redis, keys);
  },
  
  emptyQueue: function(clientId) {
    var conn = this.connection(clientId, false);
    if (!conn) return;
    
    var key = this._ns + '/clients/' + clientId + '/messages', self = this;
    this._redis.lrange(key, 0, -1, function(error, jsonMessages) {
      self._redis.ltrim(key, jsonMessages.length, -1);
      Faye.each(jsonMessages, function(jsonMessage) {
        self._redis.srem(key, jsonMessage);
        conn.deliver(JSON.parse(jsonMessage));
      });
    });
  },
  
  gc: function() {
    if (typeof this.timeout !== 'number') return;
    this._withLock('gc', function(releaseLock) {
      var cutoff = new Date().getTime() - 1000 * 2 * this.timeout,
          self   = this;
      
      this._redis.zrangebyscore(this._ns + '/clients', 0, cutoff, function(error, clients) {
        var i = 0, n = clients.length;
        if (i === n) return releaseLock();
        
        Faye.each(clients, function(clientId) {
          this.destroyClient(clientId, function() {
            i += 1;
            if (i === n) releaseLock();
          }, this);
        }, self);
      });
    }, this);
  },
  
  _withLock: function(lockName, callback, scope) {
    var lockKey     = this._ns + '/locks/' + lockName,
        currentTime = new Date().getTime(),
        expiry      = currentTime + this.LOCK_TIMEOUT * 1000 + 1;
        self        = this;
    
    var releaseLock = function() {
      if (new Date().getTime() < expiry) self._redis.del(lockKey);
    };
    
    this._redis.setnx(lockKey, expiry, function(error, set) {
      if (set === 1) return callback.call(scope, releaseLock);
      
      self._redis.get(lockKey, function(error, timeout) {
        var lockTimeout = parseInt(timeout, 10);
        if (currentTime < lockTimeout) return;
        
        self._redis.getset(lockKey, expiry, function(error, oldValue) {
          if (oldValue !== timeout) return;
          callback.call(scope, releaseLock);
        });
      });
    });
  }
});

Faye.Engine.register('redis', Faye.Engine.Redis);


Faye.Server = Faye.Class({
  initialize: function(options) {
    this._options  = options || {};
    var engineOpts = this._options.engine || {};
    engineOpts.timeout = this._options.timeout;
    this._engine   = Faye.Engine.get(engineOpts);

    this.info('Created new server: ?', this._options);
  },
  
  flushConnection: function(messages) {
    Faye.each([].concat(messages), function(message) {
      var clientId = message.clientId;
      this.info('Flushing connection for ?', clientId);
      if (clientId) this._engine.flush(clientId);
    }, this);
  },
  
  determineClient: function(messages) {
    messages = [].concat(messages);
    var i = messages.length, message;
    while (i--) {
      message = messages[i];
      if (message.channel === Faye.Channel.CONNECT)
        return message.clientId;
    }
    return null;
  },
  
  process: function(messages, local, callback, scope) {
    messages = [].concat(messages);
    this.info('Processing messages: ? (local: ?)', messages, local);

    if (messages.length === 0) return callback.call(scope, []);
    var processed = 0, responses = [], self = this;
    
    var gatherReplies = function(replies) {
      responses = responses.concat(replies);
      processed += 1;
      if (processed < messages.length) return;
      
      var n = responses.length;
      while (n--) {
        if (!responses[n]) responses.splice(n,1);
      }
      self.info('Returning replies: ?', responses);
      callback.call(scope, responses);
    };
    
    var handleReply = function(replies) {
      var extended = 0, expected = replies.length;
      if (expected === 0) gatherReplies(replies);
      
      Faye.each(replies, function(reply, i) {
        this.debug('Processing reply: ?', reply);
        this.pipeThroughExtensions('outgoing', reply, function(message) {
          replies[i] = message;
          extended  += 1;
          if (extended === expected) gatherReplies(replies);
        });
      }, this);
    };
    
    Faye.each(messages, function(message) {
      this.pipeThroughExtensions('incoming', message, function(pipedMessage) {
        this._handle(pipedMessage, local, handleReply, this);
      }, this);
    }, this);
  },
  
  _makeResponse: function(message) {
    var response = {};
    Faye.each(['id', 'clientId', 'channel', 'error'], function(field) {
      if (message[field]) response[field] = message[field];
    });
    response.successful = !response.error;
    return response;
  },
  
  _handle: function(message, local, callback, scope) {
    if (!message) return callback.call(scope, []);
    this.info('Handling message: ? (local: ?)', message, local);
    
    var channelName = message.channel, response;
    
    if (Faye.Channel.isMeta(channelName))
      return this._handleMeta(message, local, callback, scope);
    
    if (!message.error && Faye.Grammar.CHANNEL_NAME.test(channelName))
      this._engine.publish(message);
    
    if (message.clientId) {
      response = this._makeResponse(message);
      response.successful = !response.error;
      callback.call(scope, [response]);
    } else {
      callback.call(scope, []);
    }
  },
  
  _handleMeta: function(message, local, callback, scope) {
    var method = Faye.Channel.parse(message.channel)[1];
    
    this[method](message, local, function(responses) {
      responses = [].concat(responses);
      Faye.each(responses, this._advize, this);
      callback.call(scope, responses);
    }, this);
  },
  
  _advize: function(response) {
    if (Faye.indexOf([Faye.Channel.HANDSHAKE, Faye.Channel.CONNECT], response.channel) < 0)
      return;
    
    response.advice = response.advice || {};
    if (response.error) {
      Faye.extend(response.advice, {reconnect:  'handshake'}, false);
    } else {
      Faye.extend(response.advice, {
        reconnect:  'retry',
        interval:   Math.floor(this._engine.interval * 1000),
        timeout:    Math.floor(this._engine.timeout * 1000)
      }, false);
    }
  },
  
  // MUST contain  * version
  //               * supportedConnectionTypes
  // MAY contain   * minimumVersion
  //               * ext
  //               * id
  handshake: function(message, local, callback, scope) {
    var response = this._makeResponse(message);
    response.version = Faye.BAYEUX_VERSION;
    
    if (!message.version)
      response.error = Faye.Error.parameterMissing('version');
    
    var clientConns = message.supportedConnectionTypes,
        commonConns;
    
    if (!local) {
      response.supportedConnectionTypes = Faye.CONNECTION_TYPES;
      
      if (clientConns) {
        commonConns = Faye.filter(clientConns, function(conn) {
          return Faye.indexOf(Faye.CONNECTION_TYPES, conn) >= 0;
        });
        if (commonConns.length === 0)
          response.error = Faye.Error.conntypeMismatch(clientConns);
      } else {
        response.error = Faye.Error.parameterMissing('supportedConnectionTypes');
      }
    }
    
    response.successful = !response.error;
    if (!response.successful) return callback.call(scope, response);
    
    this._engine.createClient(function(clientId) {
      response.clientId = clientId;
      callback.call(scope, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * connectionType
  // MAY contain   * ext
  //               * id
  connect: function(message, local, callback, scope) {
    var response       = this._makeResponse(message),
        clientId       = message.clientId,
        connectionType = message.connectionType;
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)         response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)       response.error = Faye.Error.parameterMissing('clientId');
      
      if (Faye.indexOf(Faye.CONNECTION_TYPES, connectionType) < 0)
        response.error = Faye.Error.conntypeMismatch(connectionType);
      
      if (!connectionType) response.error = Faye.Error.parameterMissing('connectionType');
      
      response.successful = !response.error;
      
      if (!response.successful) {
        delete response.clientId;
        return callback.call(scope, response);
      }
      
      this._engine.connect(response.clientId, message.advice, function(events) {
        callback.call(scope, [response].concat(events));
      });
    }, this);
  },
  
  // MUST contain  * clientId
  // MAY contain   * ext
  //               * id
  disconnect: function(message, local, callback, scope) {
    var response = this._makeResponse(message),
        clientId = message.clientId;
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)   response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId) response.error = Faye.Error.parameterMissing('clientId');
      
      response.successful = !response.error;
      if (!response.successful) delete response.clientId;
      
      if (response.successful) this._engine.destroyClient(clientId);
      callback.call(scope, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  subscribe: function(message, local, callback, scope) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      Faye.each(subscription, function(channel) {
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.subscribe(clientId, channel);
      }, this);
      
      response.successful = !response.error;
      callback.call(scope, response);
    }, this);
  },
  
  // MUST contain  * clientId
  //               * subscription
  // MAY contain   * ext
  //               * id
  unsubscribe: function(message, local, callback, scope) {
    var response     = this._makeResponse(message),
        clientId     = message.clientId,
        subscription = message.subscription;
    
    subscription = subscription ? [].concat(subscription) : [];
    
    this._engine.clientExists(clientId, function(exists) {
      if (!exists)               response.error = Faye.Error.clientUnknown(clientId);
      if (!clientId)             response.error = Faye.Error.parameterMissing('clientId');
      if (!message.subscription) response.error = Faye.Error.parameterMissing('subscription');
      
      response.subscription = message.subscription || [];
      
      Faye.each(subscription, function(channel) {
        if (response.error) return;
        if (!local && !Faye.Channel.isSubscribable(channel)) response.error = Faye.Error.channelForbidden(channel);
        if (!Faye.Channel.isValid(channel))                  response.error = Faye.Error.channelInvalid(channel);
        
        if (response.error) return;
        this._engine.unsubscribe(clientId, channel);
      }, this);
      
      response.successful = !response.error;
      callback.call(scope, response);
    }, this);
  }
});

Faye.extend(Faye.Server.prototype, Faye.Logging);
Faye.extend(Faye.Server.prototype, Faye.Extensible);


Faye.Transport.NodeLocal = Faye.extend(Faye.Class(Faye.Transport, {
  batching: false,
  
  request: function(message, timeout) {
    this._endpoint.process(message, true, this.receive, this);
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, endpoint instanceof Faye.Server);
  }
});

Faye.Transport.register('in-process', Faye.Transport.NodeLocal);


Faye.Transport.NodeHttp = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {
    var uri      = url.parse(this._endpoint),
        secure   = (uri.protocol === 'https:'),
        port     = (secure ? 443 : 80),
        client   = http.createClient(uri.port || port, uri.hostname, secure),
        content  = JSON.stringify(message),
        response = null,
        retry    = this.retry(message, timeout),
        self     = this;
    
    client.addListener('error', retry);
    
    client.addListener('end', function() {
      if (!response) retry();
    });
    
    var request = client.request('POST', uri.pathname, {
      'Content-Type':   'application/json',
      'Host':           uri.hostname,
      'Content-Length': content.length
    });
    
    request.addListener('response', function(stream) {
      response = stream;
      Faye.withDataFor(response, function(data) {
        try {
          self.receive(JSON.parse(data));
        } catch (e) {
          retry();
        }
      });
    });
    
    request.write(content);
    request.end();
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, typeof endpoint === 'string');
  }
});

Faye.Transport.register('long-polling', Faye.Transport.NodeHttp);


var path  = require('path'),
    fs    = require('fs'),
    sys   = require('sys'),
    url   = require('url'),
    http  = require('http'),
    querystring = require('querystring');

Faye.logger = function(message) {
  sys.puts(message);
};

Faye.withDataFor = function(transport, callback, scope) {
  var data = '';
  transport.addListener('data', function(chunk) { data += chunk });
  transport.addListener('end', function() {
    callback.call(scope, data);
  });
};

Faye.NodeAdapter = Faye.Class({
  DEFAULT_ENDPOINT: '/bayeux',
  SCRIPT_PATH:      path.dirname(__filename) + '/faye-browser-min.js',
  
  TYPE_JSON:    {'Content-Type': 'application/json'},
  TYPE_SCRIPT:  {'Content-Type': 'text/javascript'},
  TYPE_TEXT:    {'Content-Type': 'text/plain'},
  
  initialize: function(options) {
    this._options    = options || {};
    this._endpoint   = this._options.mount || this.DEFAULT_ENDPOINT;
    this._endpointRe = new RegExp('^' + this._endpoint + '(/[^/]*)*(\\.js)?$');
    this._server     = new Faye.Server(this._options);
    this._failed     = {};
    
    var extensions = this._options.extensions;
    if (!extensions) return;
    Faye.each([].concat(extensions), this.addExtension, this);
  },
  
  addExtension: function(extension) {
    return this._server.addExtension(extension);
  },
  
  removeExtension: function(extension) {
    return this._server.removeExtension(extension);
  },
  
  getClient: function() {
    return this._client = this._client || new Faye.Client(this._server);
  },
  
  listen: function(port) {
    var httpServer = http.createServer(function() {});
    this.attach(httpServer);
    httpServer.listen(port);
    this._httpServer = httpServer;
  },
  
  stop: function() {
    this._httpServer.close();
  },
  
  attach: function(httpServer) {
    this._overrideListeners(httpServer, 'request', 'handle');
    this._overrideListeners(httpServer, 'upgrade', 'handleUpgrade');
  },
  
  _overrideListeners: function(httpServer, event, method) {
    var listeners = httpServer.listeners(event),
        self      = this;
    
    httpServer.removeAllListeners(event);
    
    httpServer.addListener(event, function(request) {
      if (self.check(request)) return self[method].apply(self, arguments);
      
      for (var i = 0, n = listeners.length; i < n; i++)
        listeners[i].apply(this, arguments);
    });
  },
  
  check: function(request) {
    var path = url.parse(request.url, true).pathname;
    return !!this._endpointRe.test(path);
  },
  
  loadClientScript: function(callback) {
    if (this._clientScript) return callback(this._clientScript);
    var self = this;
    fs.readFile(this.SCRIPT_PATH, function(err, content) {
      self._clientScript = content;
      callback(content);
    });
  },
  
  handle: function(request, response) {
    var requestUrl    = url.parse(request.url, true),
        requestMethod = request.method,
        self          = this;
    
    if (/\.js$/.test(requestUrl.pathname))
      return this.loadClientScript(function(content) {
        response.writeHead(200, self.TYPE_SCRIPT);
        response.write(content);
        response.end();
      });
    
    if (requestMethod === 'OPTIONS')
      return this._handleOptions(request, response);
    
    if (requestMethod === 'GET')
      return this._callWithParams(request, response, requestUrl.query);
    
    if (requestMethod === 'POST')
      return Faye.withDataFor(request, function(data) {
        var type   = (request.headers['content-type'] || '').split(';')[0],
            params = (type === 'application/json')
                   ? {message: data}
                   : querystring.parse(data);
        
        self._callWithParams(request, response, params);
      });
    
    this._returnError(response);
  },
  
  handleUpgrade: function(request, socket, head) {
    var socket = new Faye.WebSocket(request, head),
        self   = this;
    
    var send = function(messages) {
      try {
        self.debug('Sending via WebSocket: ?', messages);
        socket.send(JSON.stringify(messages));
      } catch (e) {
        self._failed[socket.clientId] = messages;
      }
    };
    
    socket.onmessage = function(message) {
      try {
        var message  = JSON.parse(message.data),
            clientId = self._server.determineClient(message),
            failed   = null;
        
        self.debug('Received via WebSocket: ?', message);

        if (clientId) {
          socket.clientId = clientId;
          if (failed = self._failed[clientId]) {
            delete self._failed[clientId];
            send(failed);
          }
        }
        
        self._server.process(message, false, send);
      } catch (e) {}
    };
  },
  
  _callWithParams: function(request, response, params) {
    try {
      var message = JSON.parse(params.message),
          jsonp   = params.jsonp || Faye.JSONP_CALLBACK,
          isGet   = (request.method === 'GET'),
          type    = isGet ? this.TYPE_SCRIPT : this.TYPE_JSON;

      this.debug('Received ?: ?', request.method, message);
      if (isGet) this._server.flushConnection(message);
      
      this._server.process(message, false, function(replies) {
        var body   = JSON.stringify(replies),
            head   = Faye.extend({}, type),
            origin = request.headers.origin;
        
        if (isGet)  body = jsonp + '(' + body + ');';
        if (origin) head['Access-Control-Allow-Origin'] = origin;
        
        this.debug('Returning ?', body);
        response.writeHead(200, head);
        response.write(body);
        response.end();
      }, this);
    } catch (e) {
      this._returnError(response);
    }
  },
  
  _handleOptions: function(request, response) {
    var headers = {
      'Access-Control-Allow-Origin':      '*',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Max-Age':           '86400',
      'Access-Control-Allow-Methods':     'POST, GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':     'Accept, Content-Type, X-Requested-With'
    };
    response.writeHead(200, headers);
    response.write('');
    response.end();
  },
  
  _returnError: function(response) {
    response.writeHead(400, this.TYPE_TEXT);
    response.write('Bad request');
    response.end();
  }
});

Faye.extend(Faye.NodeAdapter.prototype, Faye.Logging);

exports.NodeAdapter = Faye.NodeAdapter;
exports.Client = Faye.Client;
exports.Logging = Faye.Logging;