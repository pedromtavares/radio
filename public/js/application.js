function ApplicationClient(){
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  var self = this;
  
  this.init = function(){
    self.config = self.getServerConfigs();
    self.setupBayeuxHandlers();
  };
  
  this.getServerConfigs = function(){
    var config = {
      port: JSON.parse($('#portConfig').val())
    , dj: $('#djConfig').val()
    , locations: JSON.parse($('#locations').val())
    };
    return config;
  };
  
  this.setupBayeuxHandlers = function() {
    self.config.fayeClient = new Faye.Client("http://" + window.location.hostname + ':' + self.config.port + '/faye', {
      timeout: 120
    });
  };
  
  this.init();
}

$(function(){
  var application = new ApplicationClient();
  var radioClient = new RadioClient(application.config);
  var chatClient  = new ChatClient(application.config);
  if ($('#map').length!=0){
    var mapClient = new MapClient(application.config);
  }
  
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

});