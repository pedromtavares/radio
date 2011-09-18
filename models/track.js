require('./db_connect');
var _ = require('../vendor/underscore')._;

var PlaySchema = new Schema({
    dj  :  { type: String, required: true }
  , created_at  : {type : Date, default : Date.now}
});

var TrackSchema = new Schema({
    name  :  { type: String, required: true }
  , artist : { type: String, required: true }
  , plays   :  [PlaySchema]
  , created_at  : {type : Date, default : Date.now}
  , updated_at : {type : Date, default : Date.now}
});

TrackSchema.virtual('djs').get(function (){
  return _(this.plays).chain().map(function(play) {return play.dj}).toArray().uniq().value();
});


TrackSchema.statics.parseTitle = function parseTitle(title){
  var temp = title.split('-');
  var artist = temp[0];
  var name = temp[1];
  if (!name){name = 'Untitled'};
  artist = removeUselessSpace(artist);
  name = removeUselessSpace(name);
  return {name: name, artist: artist};
}

function removeUselessSpace(string){
  var result = string;
  var l = string.length;
  if (string.charAt(0) == ' '){
    result = result.substr(1, l-1);
  }
  if (string.charAt(l-1) == ' '){
    result = result.substr(0, l-1);
  }
  return result;
}


var exports = module.exports = mongoose.model('Track', TrackSchema);