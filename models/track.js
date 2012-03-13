require('./db_connect');
var _ = require('../vendor/underscore')._;

var PlaySchema = new Schema({
    dj  :  { type: String, required: true }
  , created_at  : {type : Date, default : Date.now}
});

var TrackSchema = new Schema({
    name  :  { type: String, required: true }
  , artist : { type: String, required: true }
  , title : { type: String, required: true }
  , plays   :  [PlaySchema]
  , created_at  : {type : Date, default : Date.now}
  , updated_at : {type : Date, default : Date.now}
});

TrackSchema.virtual('djs').get(function (){
  return _(this.plays).chain().map(function(play) {return play.dj}).toArray().uniq().value();
});

TrackSchema.statics.mostPlayed = function mostPlayed(tracks){
  return _(tracks).chain().sortBy(function(track) {return track.plays.length}).reverse().value();
}

TrackSchema.statics.parseTitle = function parseTitle(title){
  var temp = title.split(' - ');
  var artist = temp[0];
  var name = temp[1];
  if (!name){artist = 'Unknown'; name = title};
  artist = removeUselessSpace(artist);
  name = removeUselessSpace(name);
  return {name: name, artist: artist};
}

TrackSchema.statics.byArtists = function byArtists(callback){
  map = function() {
    var djs = [];
    this.plays.forEach(function(play) {
      if (djs.indexOf(play.dj) == -1){
        djs.push(play.dj);
      }
    });
    emit(this.artist, {plays: this.plays.length, djs: djs, updated_at: this.updated_at});
  }; 

  reduce = function(key, vals) {
    var r = {plays: 0, djs: []};
    for (index in vals) {
      var tmp = vals[index];
      r.plays += tmp.plays;
      r.djs.push(tmp.djs);
      r.updated_at = (!r.updated_at || tmp.updated_at > r.updated_at) ? tmp.updated_at : r.updated_at;
    }
    return r;
  };
  var command = {
    mapreduce: "tracks",
    map: map.toString(),
    reduce: reduce.toString(),
    out: "byArtists"
  };
  mongoose.connection.db.executeDbCommand(command, function(err, dbres) {});
  mongoose.connection.db.collection('byArtists', function(err, collection) {
      collection.find({}).toArray(function(err, tracks) {
        tracks.forEach(function(track) {
          track.value.djs = _(track.value.djs).chain().flatten().uniq().value();
        });
        tracks = _(tracks).chain().map(function(track) {return {artist: track._id, djs: track.value.djs, updated_at: track.value.updated_at, plays: track.value.plays}}).sortBy(function(artist) {return artist.plays}).reverse().value();
        callback(err, tracks); 
        collection.drop();
      });
  });
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