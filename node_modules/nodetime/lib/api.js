var os = require("os");
var util = require("util");
var EventEmitter = require('events').EventEmitter;
var request = require("request");
var gzipRequest = require("./gzip-request");

var Client = function(opts) {
  var self = this;

  opts = opts || {};

  this.debug = opts.debug;

  if(opts.group) {
    this.setGroup(opts.group);
  }
  else {
    this.group = uuid();
  }

  this.agent = os.hostname() + ':' + process.pid;
  this.server = opts.server;
  this.proxy = opts.proxy;
  this.headers = opts.headers;

  this.retry = opts.retry || 2;

  this._lastTimestamp = 0;
  this._pollFailed = 0;
  this._pollOngoing = false;
  this._pushFailed = 0;
  this._pushOngoing = false;
  this._pushBuffer = [];


  this._pushIntervalId = setInterval(function() {
    try {
      if(!self._pushOngoing) self._push();
    }
    catch(err) {
      self.error(err);
    }
  }, 1000);

  this._pollIntervalId = setInterval(function() {
    try {
      if(!self._pollOngoing) self._poll();
    }
    catch(err) {
      self.error(err);
    }
  }, 1000);


  EventEmitter.call(this);
};

util.inherits(Client, EventEmitter);
exports.Client = Client; 


exports.createClient = function(opts) {
  return new exports.Client(opts); 
}


Client.prototype.setGroup = function(group) {
  if(group.match(/^[\w\-\.\:]{1,128}$/)) {
    this.group = group;
  }
  else {
    throw new Error("Client group name is invalid");
  }
};


Client.prototype.destroy = function() {
  clearInterval(this._pushIntervalId);
  clearInterval(this._pollIntervalId);
  if(this._deferTimeoutId) clearTimeout(this._deferTimeoutId);

  if(this._pollRequest) {
    this._pollRequest.abort();
    if(this._pollRequest.timeoutTimer) {
      clearTimeout(this._pollRequest.timeoutTimer);
    }
  }

  if(this._pushRequest) {
    this._pushRequest.abort();
    if(this._pushRequest.timeoutTimer) {
      clearTimeout(this._pushRequest.timeoutTimer);
    }
  }

  this.removeAllListeners();
}


Client.prototype.log = function(msg) {
  if(this.debug) console.log(msg);
};


Client.prototype.error = function(msg) {
  if(this.debug) console.error(msg, msg ? msg.stack : undefined);
};


Client.prototype.send = function(payload) {
  this._pushBuffer.push({payload: payload, ts: new Date().getTime()});
};
  

Client.prototype._push = function() {
  var self = this;

  if(self._pushBuffer.length == 0) return;

  self._pushOngoing = true;
  var buf = this._pushBuffer;
  self._pushBuffer = [];
  self._pushRequest = gzipRequest({
      strictSSL: !self.debug,
      method: "POST", 
      url: self.server + '/agent/push/?group=' + self.group + '&agent=' + self.agent, 
      proxy: self.proxy,
      json: buf,
      timeout: 10000,
      headers: self.headers
    }, function(err, response, body) {
    if(err || response.statusCode != 200) {
      if(++self._pushFailed == self.retry) {
        self._pushFailed = 0;
      }
      else {
        // put back
        self._pushBuffer = buf.concat(self._pushBuffer);
      }

      self.error(err || "error pushung message(s)");
    }
    else {
      self._pushFailed = 0;

      self.log("sent message(s) to server");
    }

    self._pushOngoing = false;
  });
};


Client.prototype._poll = function() {
  var self = this;

  self._pollOngoing = true;
  self._pollRequest = request({
      strictSSL: !self.debug,
      url: self.server + '/agent/poll/?group=' + self.group + '&agent=' + self.agent + '&since=' + (self._lastTimestamp || ''), 
      proxy: self.proxy,
      encoding: "utf8",
      timeout: 70000,
      headers: self.headers
    }, function(err, response, body) {
    if(err || response.statusCode != 200) {
      self._deferPoll();
      return self.error(err || 'poll request error');
    }
 
    try {
      var msgs = JSON.parse(body);
      msgs = msgs || [];

      msgs.forEach(function(msg) {
        if(msg && msg.payload && msg.ts) {
          self.log("message(s) received from server");
          self._lastTimestamp = msg.ts;
          self.emit("message", msg.payload);
        }
        else {
          self.error("invalid message for client " + self.group);
        }
      });
    }
    catch(err) {
      self._deferPoll();
      return self.error(err);
    }

    self._pollFailed = 0;
    self._pollOngoing = false;
  });
};


Client.prototype._deferPoll = function() {
  var self = this;

  if(++self._pollFailed == self.retry) {
    self._deferTimeoutId = setTimeout(function() {
      self._pollFailed = 0;
      self._pollOngoing = false;
    }, 60000);
  }
  else {
    self._pollOngoing = false;
  }
}


function uuid() {
  return (new Date().getTime() + ':' + Math.round(Math.random() * Math.pow(10, 16)));
}

