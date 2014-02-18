var http = require('http'),
    https = require('https'),
    httpAgent = require('http-agent'),
    urlParser = require('url'),
    throttle = require('throttle'),
    _ = require('../vendor/underscore')._,
    fs = require('fs'),
    spawn = require("child_process").spawn,
    probe = require('node-ffprobe'),
    async = require('async'),
    request = require('request');

function Provider(app, decoder){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  self.decoder = decoder;
  self.app = app;
  self.init();
}

Provider.prototype.init = function(){
  var self = this;
  
  self.playlists = [];
  self.currentPlaylist = {};
  self.currentSong = {};
  self.apiUrl = self.app.settings.server.apiUrl;
  self.started = false;
};

Provider.prototype.start = function(restart){
  var self = this;
  if (!restart){
    self.init();
  };
  self.started = true;
  self.automatic = true;
  async.whilst(
    function() {return self.automatic && self.started},
    function(callback){
      self.nextPlaylist(callback);
    },
    function(err){
      console.log("**Provider stopped!");
    }
  );
};

Provider.prototype.stop = function() {
  var self = this;
  self.init();
  self.killStream();
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
  if (self.clipStream){
    self.clipStream.removeAllListeners();
    if (self.clipStream.readable) self.clipStream.destroy();
  }
};

Provider.prototype.createPlaylist = function(name, songs, userId, automatic, uid, callback){
  var self = this;
  var playlist = {name: name, songs: songs, id: new Date().getTime(), automatic: automatic, user_id: userId, uid: uid};
  self.playlists.push(playlist);
  console.log("** Added playlist to queue: " + playlist.name + '. Automatic: ' + playlist.automatic);
  callback(playlist);
};

Provider.prototype.jumpPlaylist = function(){
  var self = this;
  if (!self.currentPlaylist || self.currentPlaylist.automatic){
    self.automatic = false;
    async.whilst(
      function() {return self.processingSong},
      function(callback){
        setTimeout(callback, 1000);
      },
      function(err){
        self.nextPlaylist(function() {self.start(true)});
      }
    );
    
  }
}

Provider.prototype.nextPlaylist = function(callback){
  var self = this;
  self.currentPlaylist = self.playlists.shift();
  if (self.currentPlaylist && self.currentPlaylist.songs.length > 0){
    console.log("** New Playlist: "+ self.currentPlaylist.name);
    async.eachSeries(self.currentPlaylist.songs, function (song, innerCallback) {
      self.nextSong(song, function(closed) {
        if (closed && closed == 'closed'){
          innerCallback(new Error('Closed!'));
        }else{
          console.log(' -- Going to next song...');
          innerCallback();
        }
      });
    }, function (err) {
      if (err) { ' -- Playlist abruptly stopped.' }
      console.log(' -- Playlist finished, going to the next playlist');
      callback();
    });
  }else{
    console.log("** Grabing next playlist from server...");
    var data = {token: self.app.settings.server.keys.token};
    request.post(
      self.app.settings.server.siteUrl + '/playlists/next',
      { form: data},
      function (error, response, body) {}
    );
  }
};

Provider.prototype.nextSong = function(song, callback){
  var self = this;
  console.log('Current song: ('+song.id+') '+ song.artist + ' - ' + song.title);
  self.currentSong = song;
  self.publishCurrentInfo();
  self.processingSong = true;  
  self.treatUrl(song.url, function(newUrl) {
    if (newUrl){
      self.playClip(function() {
        self.downloadSong(newUrl, function(songFile) {
          if (songFile){
            self.streamSong(songFile, function(result) {
              callback(result);
            });
          }else{
            callback();
          }
        });
      });
    }else{
      console.log(" -- Invalid URL, skipping...");
      callback();
    }
  });
};

Provider.prototype.treatUrl = function(url, callback, dontLog){
  var self = this;
  var parsedUrl;
  var soundcloudId = '?client_id=3cQaPshpEeLqMsNFAUw1Q'
  
  if (!dontLog){console.log(" -- Treating URL: "+ url);}
  
  if (!url){
    if (!dontLog){console.log(" -- Url is undefined.");}
    callback(null);
    return;
  }
  try{
    parsedUrl = urlParser.parse(url);
  }catch(e){
    if (!dontLog){console.log(" -- There was an issue parsing the URL: "+e);}
    callback(null);
    return;
  }
  
  if (parsedUrl.host == 'api.soundcloud.com' && !parsedUrl.query){
    self.treatUrl(url + soundcloudId, callback, dontLog);
    return;
  }
  
  
  var responseCallback = function(response){
    var headers = response.headers;
    var contentType = headers['content-type'];
    var newUrl = headers.location;
    response.on('error', function(e) {
      if (!dontLog){console.log(' -- Error on response to try to get a true mp3 URL: '+e);}
      callback(null);
    });
    if (contentType == 'audio/mpeg'){
      callback(url);
      response.destroy();
      request.destroy();
    }else if (newUrl){
      self.treatUrl(newUrl, callback, dontLog);
    }else{
      callback(null);
      if (!dontLog){console.log(' -- The URL is invalid (404 or something).');}
    }
  };
  
  if (parsedUrl.protocol == 'https:'){
    var request = https.get(parsedUrl, responseCallback);
  }else{
    var request = http.get(parsedUrl, responseCallback);
  }
  
  request.on('error', function(e) {
    if (!dontLog){console.log(' -- Error on request to try to get a true mp3 URL:' + e);}
    request.destroy();
    callback(null);
  });
  
};

Provider.prototype.downloadSong = function(url, callback){
  var self = this;
  var track = 'songs/'+self.currentSong.id+'.mp3';
  var parsedUrl = urlParser.parse(url);
  var responseCallback = function(response){
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
  };
  
  console.log(' -- Started downloading: '+url);
  if (parsedUrl.protocol == 'https:'){
    var request = https.get(parsedUrl, responseCallback);
  }else{
    var request = http.get(parsedUrl, responseCallback);
  }
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
    if (!bit_rate || bit_rate < 50000){
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
      self.processingSong = false;
      console.log(' -- Bitrate: ' + bit_rate + ', Sample rate: ' + sample_rate);
      unthrottle = throttle(self.currentStream, (bit_rate/10) * 1.25);
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
      callback(null);
      //self.resampleSong(track, bit_rate, sample_rate, continueStreaming, callback);
    }else{
      continueStreaming(bit_rate, sample_rate, track, callback);
    }
  });
};

Provider.prototype.playClip = function(callback) {
  var self = this;
  if ((Math.random() * 2 + 1) > 2){ // dont activate the clip all the time
    self.killStream();
    self.decoder.createStreams();
    callback();
    return;
  }
  var clips = fs.readdirSync('clips');
  var total = clips.length;
  var index = Math.floor((Math.random()*total));
  var clip = 'clips/' + clips[index];
  var clipStream = fs.createReadStream(clip);
  self.killStream();
  self.clipStream = clipStream;
  unthrottle = throttle(clipStream, (320000/10) * 1.2);
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

Provider.prototype.publishCurrentInfo = function(){
  var self = this;
  var data = {current_playlist: self.currentPlaylist, current_track: self.currentSong, token: self.app.settings.server.keys.token};
  request.post(
    self.app.settings.server.siteUrl + '/playlists/current',
    { form: data},
    function (error, response, body) {}
  );
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
      if (json && json.status_code != 502){
        var songs = self.filterSongs(json.songs);
        callback(songs);
      }else{
        callback(null)
      }
      body = null;
    });
  }).on('error', function(e) {
    console.log("Error while trying to download and parse song list: " + e.message);
    callback(null);
  });
};

Provider.prototype.filterSongs = function(songs){
  return _(songs).reject(function(song) {
    var urlObj;
    if (song.url && typeof(song.url) == 'string'){
      urlObj = urlParser.parse(song.url);
    }
    return (!song.url || !urlObj);
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

Provider.prototype.resampleSong = function(track, bit_rate, sample_rate, callback, outerCallback) {
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
      callback(info.bit_rate, info.sample_rate, newTrack, outerCallback);
    });
  });
};

Provider.prototype.logAndDelete = function(track, message) {
  var self = this;
  console.log(message);
  fs.unlinkSync(track);
};


module.exports = Provider;