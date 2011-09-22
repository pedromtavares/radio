function sanitizeHtml(text){
  return text.replace(/&/g,'&amp;').
     replace(/</g,'&lt;').
     replace(/"/g,'&quot;').
     replace(/'/g,'&#039;');
}

function addZero(number){
  if(number < 10){
    return '0'+number;
  }
  return number;
}

function replaceLinks(text) {
    var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
}

function encodeID(s) {
    if (s==='') return '_';
    return s.replace(/[^a-zA-Z0-9.-]/g, function(match) {
        return '_'+match[0].charCodeAt(0).toString(16)+'_';
    });
}