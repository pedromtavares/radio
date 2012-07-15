function PlaylistClient (config) {
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  
  var self = this;
  
  self.config = config;
  
  this.init = function(){
    self.currentSong = config.currentSong;
    self.currentPlaylist = config.currentPlaylist;
    self.setupPubSub();
    self.setupDOM();
  };
  
  this.setupPubSub = function(){
    self.config.pubSub.subscribe('playlist', function (message) {
      var playlist = message.playlist;
      var song = message.song;
      self.nextPlaylist(playlist);
      self.nextSong(song);
    });
  };
  
  this.nextPlaylist = function(playlist){
    if (!self.currentPlaylist || playlist.id != self.currentPlaylist.id){
      self.currentPlaylist = playlist;
      $('#playlist_name').text(playlist.name);
      $playlist = $('#playlist');
      $playlist.empty();
      playlist.songs.forEach(function(song) {
        $playlist.append('<li id="song_'+song.id+'">'+song.artist+' - '+song.title+'</li>');
      });
    }
  };
  
  this.nextSong = function(song){
    if (!self.currentSong || song.id != self.currentSong.id){
      self.setCurrentSong(song);
      self.appendDownloadLink();
    }
  };
    
  this.appendDownloadLink = function(){
    var song = self.currentSong;
    var html = ' (<a href="'+song.url+'" target="_blank">clique aqui pra baixar</a>)';
    $('#song_'+song.id).append(html);
  };
  
  this.setCurrentSong = function(song){
    if (song){
      self.currentSong = song;
    }else{
      song = self.currentSong;
    }
    $('#playlist li').removeClass('current');
    $('#song_'+song.id).addClass('current');
  };
  
  this.setupDOM = function(){
    self.setCurrentSong();
    self.appendDownloadLink();
    $('#searchSubmit').click(function() {
      var query = $('#playlistSearch').val();
      $('#searchResults').empty();
      $('#playlistLoading').show();
      $.getJSON('/search/'+query, function(data) {
        data.forEach(function(song) {
          var $song = $("<li data-song='"+song.id+"'>"+song.artist+" - "+song.title+"</li>");
          $song.on('click', function() {
            $('#chosenSongs').append($(this).detach());
          });
          $('#searchResults').append($song);
        });
        $('#playlistLoading').hide();
      });
    });
    $('#playlistClean').click(function() {
     $('#chosenSongs').empty();
    });
    $('#playlistSubmit').click(function() {
      var ids = [];
      var name = $('#playlistName').val();
      $('#chosenSongs').children().each(function(index, element) {
        ids.push($(this).data('song'));
      });
      $.post('/playlist', {ids: ids, name: name}, function() {
        $.fancybox.close();
      });
    });
  };
  
  this.init();
}