var http = require('http'),
    https = require('https'),
    httpAgent = require('http-agent'),
    urlParser = require('url'),
    throttle = require('throttle'),
    _ = require('../vendor/underscore')._,
    fs = require('fs'),
    spawn = require("child_process").spawn,
    probe = require('node-ffprobe'),
    memwatch = require('memwatch'),
    async = require('async');

function Provider(app, decoder, pubSub){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.pubSub = pubSub;
  self.decoder = decoder;
  self.app = app;
  self.init();
}

Provider.prototype.init = function(){
  var self = this;
  
  self.playlists = [];
  self.currentPlaylist = {};
  self.currentSong = {};
  self.apiUrl = 'http://ex.fm/api/v3';
  self.started = false;
};

Provider.prototype.start = function(){
  var self = this;
  self.init();
  self.started = true;
  console.log("** Searching for trending songs...");
  self.trending(function(songs) {
    if (songs){
      self.createPlaylist('Rádio da Galere - DJ automático', _(songs).map(function(song) {return song.id;}), true, function(playlist) {
        if (playlist) self.nextPlaylist();
      });
    }else{
      self.start();
    }
  });
};

Provider.prototype.stop = function() {
  var self = this;
  self.init();
  self.killStream();
  self.reloadClients();
  self.started = false;
  var songs = fs.readdirSync('songs');
  songs.forEach(function(song) {
    fs.unlinkSync('songs/'+song);
  });
};

Provider.prototype.killStream = function() {
  var self = this;
  if (self.currentStream){
    self.currentStream.removeAllListeners();
    if (self.currentStream.readable) self.currentStream.destroy();
  }
  if (self.currentDownload){
    self.currentDownload.removeAllListeners();
    self.currentDownload.destroy();
  }
};

Provider.prototype.reloadClients = function() {
  var self = this;
  self.publishMessage({song: 'reload'});
};

Provider.prototype.createPlaylist = function(name, ids, automatic, callback){
  var self = this;
  var songs = [];
  var agent = httpAgent.create(self.apiUrl.replace('http://', '') + '/song', ids);
  agent.on('next', function(e, res) {
    if (res) {
      var json;
      try{json = JSON.parse(res.body)}catch(e){json = null};
      if (json && json.song){
        songs.push(json.song);
        agent.next();
      }else{
        console.log('** Error parsing songs, gonna wait 5 seconds and try again');
        agent.emit('stop', true);
        setTimeout(function() {self.createPlaylist(name, ids, automatic, callback)}, 5000);
      }
    }
  });
  agent.on('stop', function(err, res) {
    if (!err){
      var playlist = {name: name, songs: songs, id: new Date().getTime(), automatic: automatic};
      self.playlists.push(playlist);
      callback(playlist);
    }else{
      callback(null);
    }

  });
  agent.start();
  console.log("** Started making requests for each song in the playlist to get its full information.");
};

Provider.prototype.nextPlaylist = function(){
  var self = this;
  self.currentPlaylist = self.playlists.shift();
  if (self.currentPlaylist && self.currentPlaylist.songs.length > 0){
    console.log("** New Playlist: "+ self.currentPlaylist.name);
    async.eachSeries(self.currentPlaylist.songs, function (song, callback) {
      self.nextSong(song, function(closed) {
        if (closed && closed == 'closed'){
          callback(new Error('Closed!'));
        }else{
          console.log(' -- Going to next song...');
          callback();
        }
      });
    }, function (err) {
      if (err) { ' -- Playlist abruptly stopped.' }
      console.log(' -- Playlist finished, going to the next playlist');
      self.nextPlaylist();
    });
  }else{
    self.start();
  }
};

Provider.prototype.nextSong = function(song, callback){
  var self = this;
  console.log('Current song: ('+song.id+') '+ song.artist + ' - ' + song.title);
  self.currentSong = song;
    
  self.treatUrl(song.url, function(newUrl) {
    if (newUrl){
      self.playClip(function() {
        self.downloadSong(newUrl, function(songFile) {
          if (songFile){
            self.streamSong(songFile, function(result) {
              callback(result);
            });
          }
        });
      });
    }else{
      console.log(" -- Invalid URL, skipping...");
      callback();
    }
  });
};

Provider.prototype.treatUrl = function(url, callback){
  var self = this;
  var parsedUrl;
  console.log(" -- Treating URL: "+ url);
  
  if (!url){
    console.log(" -- Url is undefined.");
    callback(null);
    return;
  }
  try{
    parsedUrl = urlParser.parse(url);
  }catch(e){
    console.log(" -- There was an issue parsing the URL: "+e);
    callback(null);
    return;
  }
  
  if (parsedUrl.protocol == 'https:' || parsedUrl.host == 'api.soundcloud.com'){
    console.log(" -- Protocol is either https or host is soundcloud.");
    callback(null);
    return;
  }
  var request = http.get(parsedUrl, function(response){
    var headers = response.headers;
    var contentType = headers['content-type'];
    var newUrl = headers.location;
    response.on('error', function(e) {
      console.log(' -- Error on response to try to get a true mp3 URL: '+e);
      callback(null);
    });
    if (contentType == 'audio/mpeg'){
      callback(url);
      response.destroy();
      request.destroy();
    }else if (newUrl){
      self.treatUrl(newUrl, callback);
    }else{
      callback(null);
      console.log(' -- The URL is invalid (404 or something).');
    }
  });
  request.on('error', function(e) {
    console.log(' -- Error on request to try to get a true mp3 URL:' + e);
    request.destroy();
    callback(null);
  });
  
};

Provider.prototype.downloadSong = function(url, callback){
  var self = this;
  var track = 'songs/'+self.currentSong.id+'.mp3';
  console.log(' -- Started downloading: '+url);
  var request = http.get(urlParser.parse(url), function(response){
    self.currentDownload = response;
    response.on('data', function(data) {
      fs.appendFile(track, data, function (err) {
        if (err) {
          self.logAndDelete(track, '-- Error while appeding file, going to next song:' + err);
          callback(null);
        }
      });
    });
    response.on('error', function(e) {
      console.log(' -- Error when downloading: '+ e);
      callback(null);
    });
    response.on('end', function() {
      console.log(' -- Download ended successfully.');
      callback(track);
    });
  });
  request.on('error', function(e) {
    console.log(" -- Error on download request: " + e.message);
    callback(null);
  });
};

Provider.prototype.streamSong = function(track, callback){
  var self = this;
  
  console.log(" -- Started streaming.");
  
  if(!self.currentSong.id){
    console.log(" -- The currentSong ID is null, going to next song.");
    callback(null);
    return;
  }
  self.getProbeInfo(track, function(info) {
    if (!info){
      self.logAndDelete(track, ' -- No probe info gathered, going to next song');
      callback(null);
      return;
    }
    var sample_rate = info.sample_rate;
    var bit_rate = info.bit_rate;
    var channels = info.channels;
    if (!sample_rate){
      self.logAndDelete(track, ' -- No sample rate gathered, going to next song.');
      callback(null);
      return;
    }
    if (!bit_rate){
      self.logAndDelete(track, ' -- No bitrate info gathered, going to next song.');
      callback(null);
      return;
    }
    if (!channels || channels != 2){
      self.logAndDelete(track, ' -- This is a mono track, not a stereo one, going to next song.');
      callback(null);
      return;
    }
    var continueStreaming = function(bit_rate, sample_rate, track, innerCallback){
      if (!bit_rate){
        console.log(' -- Problem when streaming, skipping...')
        innerCallback(null);
        return;
      }
      self.currentStream = fs.createReadStream(track);
      console.log(' -- Bitrate: ' + bit_rate + ', Sample rate: ' + sample_rate);
      unthrottle = throttle(self.currentStream, (bit_rate/10) * 1.4);
      self.currentStream.on('data', function(data){
        self.decoder.mp3.decoder.write(data);
      });
      self.currentStream.on('end', function() {
        self.logAndDelete(track, ' -- Streaming finished successfully.');
        innerCallback(true);
      });
      self.currentStream.on('error', function(e) {
        self.logAndDelete(track, ' -- Error when streaming: '+e);
        innerCallback(null);
      });
    };
    if (sample_rate != 44100){
      self.resampleSong(track, bit_rate, sample_rate, continueStreaming);
    }else{
      continueStreaming(bit_rate, sample_rate, track, callback);
    }
  });
};

Provider.prototype.playClip = function(callback) {
  var self = this;
  var clips = fs.readdirSync('clips');
  var total = clips.length;
  var index = Math.floor((Math.random()*total));
  var clip = 'clips/' + clips[index];
  var clipStream = fs.createReadStream(clip);
  self.killStream();
  unthrottle = throttle(clipStream, (320000/10) * 1.4);
  clipStream.on('data', function(data){
    self.decoder.mp3.decoder.write(data);
  });
  clipStream.on('end', function() {
    self.decoder.createStreams();
    callback();
  });
  clipStream.on('error', function(e) {
    callback();
  });

};

Provider.prototype.publishMessage = function(message){
  var self = this;
  var msg = {
    channels: ['playlist'],
    data: message
  };
  self.pubSub.publish('juggernaut', JSON.stringify(msg));
};

Provider.prototype.publishCurrentInfo = function(){
  var self = this;
  var data = {playlist: self.currentPlaylist, song: self.currentSong};
  self.publishMessage(data);
};

Provider.prototype.search = function(query, callback){
  var self = this;
  self.parseSongs(self.apiUrl+'/song/search/'+query+'?results=100', callback);
};

Provider.prototype.trending = function(callback){
  var self = this;
  self.parseSongs(self.apiUrl+'/trending?results=10&start='+Math.floor((Math.random()*100)+1), callback);
};

Provider.prototype.parseSongs = function(url, callback){
  var self = this;
  http.get(urlParser.parse(url), function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {
      var json = null;
      try{json = JSON.parse(body);}catch(e){json = null};
      if (json){
        var songs = self.filterSongs(json.songs);
        callback(songs);
      }else{
        callback(null)
      }
      body = null;
    });
  });
};

Provider.prototype.filterSongs = function(songs){
  return _(songs).reject(function(song) {
    var urlObj;
    if (song.url && typeof(song.url) == 'string'){
      urlObj = urlParser.parse(song.url);
    }
    return (!song.url || !urlObj || urlObj.protocol == 'https:' || urlObj.host == 'api.soundcloud.com');
  });
};

Provider.prototype.getProbeInfo = function(track, callback) {
  var self = this,
      info = {};
  if (!track){
    callback(null);
    return;
  }
  // on my Ubuntu VPS the formats accepted by ffprobe are different then on my mac, so manual work was needed here.
  if (self.app.settings.env && self.app.settings.env != 'production'){
    probe(track, function(err, probeData) {
      if (err){
        callback(null);
      }
      if (probeData.streams){
        info.sample_rate = probeData.streams[0].sample_rate;
        info.channels = probeData.streams[0].channels;
      }
      if (probeData.format){
        info.bit_rate = probeData.format.bit_rate;
      }
      callback(info);
    });
  }else{
    var proc;
    var probeData;
    try{
          proc = spawn('ffprobe', ['-show_files', '-show_streams', track]),
          probeData = [];
    }catch(e){
      console.log(' -- No more memory to spawn ffprobe, restarting...');
      process.exit();
    }
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', function(data) { probeData.push(data);});
    proc.on('error', function() {
      self.logAndDelete(track, ' -- Error when probing.');
      probeData = null;
      proc.kill();
      callback(null);
    });
    proc.on('exit', function() {
      var match;
      if (probeData) probeData = probeData.join('');
      match = probeData.match(/bit_rate=\d*/);
      if (match){
        bit_rate = match[0].split('=')[1];
        info.bit_rate = bit_rate;
      }
      match = probeData.match(/sample_rate=\d*/);
      if (match){
        sample_rate = match[0].split('=')[1];
        info.sample_rate = sample_rate;
      }
      match = probeData.match(/channels=\d*/);
      if (match){
        channels = match[0].split('=')[1];
        info.channels = channels;
      }
      probeData = null;
      callback(info);
      proc.removeAllListeners();
      proc.kill();
    });
  }
};

Provider.prototype.resampleSong = function(track, bit_rate, sample_rate, callback) {
  console.log(' -- Resampling track from '+ sample_rate + ' to 44100.');
  var self = this,
      newTrack = track+'_resampled',
      proc = spawn('lame', ['--resample', '44.1', track, newTrack]),
      probeData = [];
  proc.stdout.setEncoding('binary');
  proc.stdout.on('data', function(data) { probeData.push(data);});
  proc.on('error', function() {
    self.logAndDelete(track, ' -- Error when resampling.');
    probeData = [];
    proc.kill();
    callback(null, null, null);
  });
  proc.on('exit', function() {
    probeData = [];
    fs.unlinkSync(track);
    self.getProbeInfo(newTrack, function(info) {
      callback(info.bit_rate, info.sample_rate, newTrack);
    });
  });
};

Provider.prototype.logAndDelete = function(track, message) {
  var self = this;
  console.log(message);
  fs.unlinkSync(track);
};


module.exports = Provider;