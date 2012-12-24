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
      if (song == 'reload'){
        window.location.reload();
        return;
      }
      // only show after 15 secs
      setTimeout(function() {
        self.nextPlaylist(playlist);
        self.nextSong(song);
      }, 15000)
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
    $('#create_playlist').click(function() {
      $('#playlistFancybox').show();
      $('#playlistSearch').focus();
    });
    $('#playlistSearch').keypress(function(e){
      if(e.which == 13){
        var query = $(this).val();
        $('#searchResults').empty();
        $('#playlistLoading').show();
        $.getJSON('/search/'+encodeURIComponent(query), function(data) {
          if (data == null){
            return;
          }
          data.forEach(function(song, index) {
            if (index % 2 != 0){
              var divClass = 'even';
            }else{
              var divClass = 'odd';
            }
            var image = '';
            if (song.image && song.image.small){
              image = "<img src='"+song.image.small+"'/>"
            }
            var $song = $("<li data-song='"+song.id+"' data-url='"+song.url+"' class='"+divClass+" search_result'>"+image+"<a>"+song.artist+" - "+song.title+"</a></li>");
            $song.on('click', function() {
              if ($('#chosenSongs').children().length < 5){
                var removed = $(this).detach().removeClass('even').addClass('odd').addClass('chosen_result');
                checkIfUrlIsValid($(this).data('url'), function(result) {
                 if (result){
                   $('#chosenSongs').append(removed);
                 } else{
                   alert('A música escolhida contém um erro (link quebrado), favor escolher outra');
                 }
                });
              }else{
                alert("O tamanho máximo da playlist deve ser de 5 músicas!");
              }
            });
            $('#searchResults').append($song);
          });
          $('#playlistLoading').hide();
          $('#playlistHelp').show();
        });
       }
    });
    $('#playlistClean').click(function() {
     $('#chosenSongs').empty();
    });
    $('#playlistSubmit').click(function() {
      var ids = [];
      var name = $('#playlistName').val();
      if (name == ''){
        alert('Escreva um nome para sua playlist!');
        $('#playlistName').focus();
        return;
      }
      $('#chosenSongs').children().each(function(index, element) {
        ids.push($(this).data('song'));
      });
      if (ids.length == 0){
        alert('Sua playlist deve conter ao menos uma música.');
        return;
      }
      $(this).hide();
      $.post('/playlist', {ids: ids, name: name}, function() {
        $.fancybox.close();
        $('ul#searchResults').empty();
        $('#chosenSongs').empty();
        $('#playlistSearch').val('');
        $('#playlistHelp').hide();
        $('#playlistName').val('');
        $('#create_playlist').hide();
        alert("Playlist enviada com sucesso! Caso não exista outras playlists na fila, a sua será carregada em cerca de 20 segundos.");
      });
    });
    $('#queueLink').click(function() {
      $queue = $('#playlistQueue');
      if ($queue.is(':hidden')){
        $.getJSON('/playlists', function(data) {
          if (data.length == 0){
            $queue.html('<hr/><div class="center">Não há playlists na fila</div><br class="clear"/>');
          }else{
            var html = '';
            html += '<hr/><table>';
            data.forEach(function(playlist) {
              html += '<tr class="center"><td>'+playlist.name+'</td><td>';
              playlist.songs.forEach(function(song) {
                html += '<ul>';
                html += '<li>'+song.artist+' - '+song.title+'</li>'
                html += '</ul>';
              });
              html += '</td></tr>';
              $queue.html(html);
            });
          }
          $queue.slideDown();
        });
      }else{
        $queue.slideUp();
      }
    });
  };
  
  this.init();
}

function checkIfUrlIsValid (url, callback) {
  $('#playlistLoading').show();
  $.get('/check/'+encodeURIComponent(url), function(data) {
    if (data == 'ok'){
      callback(true);
    }else{
      callback(false);
    }
    $('#playlistLoading').hide();
  });
}