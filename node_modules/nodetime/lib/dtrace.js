
var nt;

exports.init = function(_nt) {
  nt = _nt;

  // trying to initialize dtrace provider
  var dtp = undefined;
  try { 
    var d = require("dtrace-provider"); 
    dtp = d.createDTraceProvider("nodetime");
    dtp.addProbe("api-call-start", "int", "char *", "char *");
    dtp.addProbe("api-call-done", "int", "char *", "char *");
    dtp.enable();
  } 
  catch(err) { 
    this.error(err) 
  }


  // firing dtrace events on calls
  if(dtp) { 
    nt.on('call', function(point, time) {
      try {
        var scope = time.scope.replace(/\s/g, '-').toLowerCase();
        var command = time.command.replace(/\s/g, '-').toLowerCase();
        dtp.fire('api-call-' + point, function() {
          return [time.id, scope, command];
        });
      } 
      catch(err) { 
        nt.error(err) 
      }
    });
  }
};


