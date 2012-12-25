var http = require('http'),
    https = require('https'),
    httpAgent = require('http-agent'),
    urlParser = require('url'),
    throttle = require('throttle'),
    _ = require('../vendor/underscore')._,
    fs = require('fs'),
    spawn = require("child_process").spawn,
    probe = require('node-ffprobe'),
    memwatch = require('memwatch');

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
  self.trending(function(songs) {
    self.createPlaylist('Rádio da Galere - DJ automático', _(songs).map(function(song) {return song.id;}), true, function() {
      self.nextPlaylist();
    });
  });
};

Provider.prototype.stop = function() {
  var self = this;
  self.init();
  self.killStream();
  self.reloadClients();
  self.started = false;
  songs = fs.readdirSync('songs');
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
    songs.push(JSON.parse(res.body).song);
    agent.next();
  });
  agent.on('stop', function(e, res) {
    var playlist = {name: name, songs: songs, id: new Date().getTime(), automatic: automatic};
    self.playlists.push(playlist);
    if (!self.currentPlaylist || self.currentPlaylist.automatic){
      self.nextPlaylist();
    }
    callback();
  });
  agent.start();
};

Provider.prototype.nextPlaylist = function(){
  var self = this;
  self.currentPlaylist = self.playlists.shift();
  if (self.currentPlaylist){
    console.log("** New Playlist: "+ self.currentPlaylist.name);
    self.nextSong();
  }else{
    self.start();
  }
};

Provider.prototype.nextSong = function(shift){
  var self = this;
  if (!self.currentPlaylist || !self.currentPlaylist.songs){
    self.nextPlaylist();
    return;
  }
  if (shift){
    self.currentPlaylist.songs.shift();
  }
  var song = self.currentPlaylist.songs[0];
  if (song){
    self.currentSong = song;
    self.publishCurrentInfo();
    var url = song.url;
    console.log('Current song: ('+song.id+') '+ song.artist + ' - ' + song.title);
    self.treatUrl(url, function(newUrl) {
      if (!newUrl){
        self.nextSong(true);
      }else{
        self.downloadSong(newUrl);
      }
    });
  }else{
    self.nextPlaylist();
  }
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

Provider.prototype.downloadSong = function(url){
  var self = this;
  var track = 'songs/'+self.currentSong.id+'.mp3';
  console.log(' -- Started downloading: '+url);
  var request = http.get(urlParser.parse(url), function(response){
    self.currentDownload = response;
    response.on('data', function(data) {
      fs.appendFile(track, data, function (err) {
        if (err) {
          self.logDeleteAndSkip(track, '-- Error while appeding file, going to next song:' + err);
        }
      });
    });
    response.on('error', function(e) {
      console.log(' -- Error when downloading: '+ e);
      self.nextSong(true);
    });
    response.on('end', function() {
      console.log(' -- Download ended successfully.');
      self.streamSong();
    });
  });
  request.on('error', function(e) {
    console.log(" -- Error on download request: " + e.message);
    self.nextSong(true);
  });
};

Provider.prototype.streamSong = function(){
  var self = this;
  
  console.log(" -- Started streaming.");
  
  if(!self.currentSong.id){
    console.log(" -- The currentSong ID is null, going to next song.");
    self.nextSong(true);
    return;
  }
  var hd = new memwatch.HeapDiff();
  var track = 'songs/'+self.currentSong.id+'.mp3';
  self.getProbeInfo(track, function(info) {
    if (!info){
      self.logDeleteAndSkip(track, ' -- No probe info gathered, going to next song');
      return;
    }
    var sample_rate = info.sample_rate;
    var bit_rate = info.bit_rate;
    var channels = info.channels;
    if (!sample_rate){
      self.logDeleteAndSkip(track, ' -- No sample rate gathered, going to next song.');
      return;
    }
    if (!bit_rate){
      self.logDeleteAndSkip(track, ' -- No bitrate info gathered, going to next song.');
      return;
    }
    if (!channels || channels != 2){
      self.logDeleteAndSkip(track, ' -- This is a mono track, not a stereo one, going to next song.');
      return;
    }
    var continueStreaming = function(bit_rate, sample_rate, track){
      self.killStream();
      self.decoder.createStreams();
      self.currentStream = fs.createReadStream(track);
      console.log(' -- Bitrate: ' + bit_rate + ', Sample rate: ' + sample_rate);
      unthrottle = throttle(self.currentStream, (bit_rate/10) * 1.4);
      // self.currentStream.pipe(self.decoder.mp3.decoder);
      self.currentStream.on('data', function(data){
        self.decoder.mp3.decoder.write(data);
      });
      self.currentStream.on('end', function() {
        self.decoder.mp3.decoder.end();
        console.log(JSON.stringify(hd.end(), null, 2));
        self.logDeleteAndSkip(track, ' -- Streaming finished successfully.');
      });
      self.currentStream.on('error', function(e) {
        self.logDeleteAndSkip(track, ' -- Error when streaming: '+e);
      });
    };
    if (sample_rate != 44100){
      self.resampleSong(track, bit_rate, sample_rate, continueStreaming);
    }else{
      continueStreaming(bit_rate, sample_rate, track);
    }
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
      var json = JSON.parse(body);
      var songs = self.filterSongs(json.songs);
      callback(songs);
    });
  });
};

Provider.prototype.filterSongs = function(songs){
  return _(songs).reject(function(song) {
    var urlObj = urlParser.parse(song.url);
    return (!song.url || urlObj.protocol == 'https:' || urlObj.host == 'api.soundcloud.com');
  });
};

Provider.prototype.getProbeInfo = function(track, callback) {
  var self = this,
      info = {};
  if (!track){
    callback(null);
    return;
  }
  memwatch.gc();
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
    var proc = spawn('ffprobe', ['-show_files', '-show_streams', track]),
        probeData = [];
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', function(data) { probeData.push(data);});
    proc.on('error', function() {
      self.logDeleteAndSkip(track, ' -- Error when probing.');
      proc.kill();
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
    self.logDeleteAndSkip(track, ' -- Error when resampling.');
    proc.kill();
  });
  proc.on('exit', function() {
    fs.unlinkSync(track);
    self.getProbeInfo(newTrack, function(info) {
      callback(info.bit_rate, info.sample_rate, newTrack);
    });
  });
};

Provider.prototype.logDeleteAndSkip = function(track, message) {
  var self = this;
  console.log(message);
  fs.unlinkSync(track);
  self.nextSong(true);
};

module.exports = Provider;