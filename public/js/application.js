function ApplicationClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.config = self.getServerConfigs();
    self.setupPubSub();
    self.setupDOM();
  };
  
  this.getServerConfigs = function(){
    var config = {
      port: JSON.parse($('#portConfig').val())
    , dj: $('#djConfig').val()
    , locations: JSON.parse($('#locations').val())
    , chatUsers: JSON.parse($('#chatUsers').val())
    , listenerLimit: JSON.parse($('#listenerLimit').val())
    , listenerCount: JSON.parse($('#listeners').text())
    , currentPlaylist: JSON.parse($('#playlistConfig').val())
    , currentSong: JSON.parse($('#songConfig').val())
    };
    return config;
  };
  
  this.setupPubSub = function(){
    self.config.pubSub = new Juggernaut
  };
  
  this.setupDOM = function(){
    $('.filter').click(function() {
      $('.filter').removeClass('italic');
      $(this).addClass('italic');
      $('.loading').show();
      $('#tracks-table').slideToggle('slow');
      $.get('/tracks/'+this.id, function(data) {
        $('#tracks-table').html(data);
        $('.loading').hide();
        $('#tracks-table').slideToggle('slow');
      });
    });
    if (self.config.listenerCount >= self.config.listenerLimit){
      $('#limit-alert').show();
    }
  }
  
  this.init();
}

$(function(){
  var application = new ApplicationClient();
  var chatClient  = new ChatClient(application.config);
  var radioClient = new RadioClient(application.config);
  var playlistClient = new PlaylistClient(application.config);
  var mapClient = new MapClient(application.config);
});