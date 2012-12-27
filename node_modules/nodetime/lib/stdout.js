
var nt;

exports.init = function(_nt) {
  nt = _nt;

  nt.on('sample', function(sample) {
    console.log(indent({sample: sample}));
  });
};


function indent(obj, depth) {
  if(!depth) depth = 0;
  if(depth > 20) return '';

  var tab = '';
  for(var i = 0; i < depth; i++) tab += "\t";

  var str = ''
  var arr = Array.isArray(obj);

  for(var prop in obj) {
    var val = obj[prop];
    if(val == undefined || prop.match(/^_/)) continue;
    
    var label = val._label || (arr ? ('[' + prop + ']') : prop);

    if(typeof val === 'string' || typeof val === 'number') {
      str += tab + label + ': \033[33m' + val + '\033[0m\n';
    }
    else if(typeof val === 'object') {
      str += tab + '\033[1m' + label + '\033[0m\n';
      str += indent(val, depth + 1);
    }
  }
  
  return str;
}

