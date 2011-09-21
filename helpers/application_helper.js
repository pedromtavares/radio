module.exports = {
  sanitizeHtml: function(text){
    return text.replace(/&/g,'&amp;').
       replace(/</g,'&lt;').
       replace(/"/g,'&quot;').
       replace(/'/g,'&#039;');
  },

  addZero: function(number){
    if(number < 10){
      return '0'+number;
    }
    return number;
  },

  replaceLinks: function(text) {
      var exp = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
      return text.replace(exp,"<a href='$1' target='_blank'>$1</a>"); 
  },

  encodeID: function(s) {
      if (s==='') return '_';
      return s.replace(/[^a-zA-Z0-9.-]/g, function(match) {
          return '_'+match[0].charCodeAt(0).toString(16)+'_';
      });
  },
  dateFormat: function(date, format) {
    return require('../vendor/dateformat').strftime(date, format);
  },
}