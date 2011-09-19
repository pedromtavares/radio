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

TrackSchema.statics.byArtists = function byArtists(tracks){
  return _(tracks).chain().groupBy(function(track){return track.artist}).map(function(artist) {
      var plays = 0;
      var artist_name;
      var djs = [];
      var last_play = _(artist).reduce(function(recent, track) {                
        plays += track.plays.length;
        artist_name = track.artist;
        djs.push(track.djs)
        return recent > track.updated_at ? recent : track.updated_at
    }, 0);
      return {artist: artist_name, plays: plays, updated_at: last_play, djs: _(djs).chain().flatten().uniq().value()}
    }).value();
}

TrackSchema.statics.mostPlayed = function mostPlayed(tracks){
  return _(tracks).chain().sortBy(function(track) {return track.plays.length}).reverse().value();
}

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