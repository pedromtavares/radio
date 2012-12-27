
function Time(nt, scope, command, isMacro) {
  this.nt = nt;

  this.scope = scope;
  this.command = command;
  this.isMacro = isMacro;

  this.id = this.nt.nextId++; 

  this._begin = undefined;
  this._cputime = undefined;

  this.begin = undefined;
  this.end = undefined;
  this.ms = undefined;
  this.cputime = undefined;
};
exports.Time = Time;


Time.prototype.start = function() {
  this.begin = this.nt.millis();
  this._cputime = this.nt.cputime();
  this._begin = this.nt.hrtime();

  this._bytesRead = this.nt.appData.bytesRead;
  this._bytesWritten = this.nt.appData.bytesWritten;

  var self = this;
  process.nextTick(function() {
    try {
      self.nt.emit("call", "start", self);
    }
    catch(err) {
      self.nt.error(err);
    }
  });
};


Time.prototype.done = function(hasError) {
  if(this.end) return false;

  this.ms = (this.nt.hrtime() - this._begin) / 1000;
  if(this._cputime !== undefined) this.cputime = (this.nt.cputime() - this._cputime) / 1000;
  this.end = this.nt.millis();
  this.hasError = hasError;

  this.bytesRead = this.nt.appData.bytesRead - this._bytesRead;
  this.bytesWritten = this.nt.appData.bytesWritten - this._bytesWritten;

  var self = this;
  process.nextTick(function() {
    try {
      self.nt.emit("call", "done", self);
    }
    catch(err) {
      self.nt.error(err);
    }
  });

  return true;
};


