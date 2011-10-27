function ApplicationClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.config = self.getServerConfigs();
    self.setupBayeuxHandlers();
    self.setupDOMHandlers();
  };
  
  this.getServerConfigs = function(){
    var config = {
      port: JSON.parse($('#portConfig').val())
    , dj: $('#djConfig').val()
    , locations: JSON.parse($('#locations').val())
    , chatUsers: JSON.parse($('#chatUsers').val())
    , listenerLimit: JSON.parse($('#listenerLimit').val())
    , listenerCount: JSON.parse($('#listeners').text())
    };
    return config;
  };
  
  this.setupBayeuxHandlers = function(){
    self.config.fayeClient = new Faye.Client("http://" + window.location.hostname + ':' + self.config.port + '/faye', {
      timeout: 120
    });
  };
  
  this.setupDOMHandlers = function(){
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
  if (application.config.dj != 'false'){
    var radioClient = new RadioClient(application.config);
  }else{
    var playlistClient = new PlaylistClient(application.config);
  }
  if ($('#map').length!=0){
    var mapClient = new MapClient(application.config);
  }
});