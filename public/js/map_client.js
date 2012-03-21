function MapClient (config) {
  if (! (this instanceof arguments.callee)){
    return new arguments.callee(arguments);
  }
  
  var self = this;
  
  self.config = config;
  
  this.init = function(){
    self.setupPubSub();
    self.drawMap();
    self.viewDidResize();
    self.drawMarkers(self.config.locations);
  };
  
  this.setupPubSub = function(){
    self.config.pubSub.subscribe('map', function (message) {
      self.drawMarker(message);
    });
  }
  
  this.drawMarkers = function(locations){
    if (locations.length != 0){
      for(var location in locations){
        var l = locations[location];
        if(l && l.city && l.latitude && l.longitude){
          var obj = {latitude: l.latitude, longitude: l.longitude, city: l.city, name: l.name};
          self.drawMarker(obj);
        }
      }
    }
  }

  this.viewDidResize = function(){
    var self = this,
      width = $('#map').width(),
      windowHeight = $(window).height(),
      mapCanvasHeight = 600;
    self.map.setSize(width, mapCanvasHeight);
    // $('#map').css({
    //   'margin-top': (windowHeight - mapCanvasHeight) / 2.0
    // });
  }

  this.drawMap = function(){
    var self = this;
    self.map = Raphael('map', 0, 0);
    //self.map.canvas.setAttribute('viewBox', '0 0 567 369');
    self.map.canvas.setAttribute('viewBox', '60 215 160 100');
    //self.map.canvas.setAttribute('viewBox', '-690 -658 1415 1415');
    //self.map.canvas.setAttribute('viewBox', '-800 -500 1750 1000');

    self.map.path(mapPath).attr({
      stroke: 'black',
      fill: '#EEE'
    }).attr({
      'stroke-width': 0.1
    });
  }

  this.geoCoordsToMapCoords = function(latitude, longitude){
    latitude = parseFloat(latitude);
    longitude = parseFloat(longitude);

    var mapWidth = 567,
      mapHeight = 369,
      x, y, mapOffsetX, mapOffsetY;

    x = (mapWidth * (180 + longitude) / 360) % mapWidth;

    latitude = latitude * Math.PI / 180;
    y = Math.log(Math.tan((latitude / 2) + (Math.PI / 4)));
    y = (mapHeight / 2) - (mapWidth * y / (2 * Math.PI));

    mapOffsetX = mapWidth * 0.026;
    mapOffsetY = mapHeight * 0.141;

    return {
      x: (x - mapOffsetX) * 0.97,
      y: (y + mapOffsetY + 15),
      xRaw: x,
      yRaw: y
    };
  }

  this.drawMarker = function(message){
    var self = this,
      latitude = message.latitude,
      longitude = message.longitude,
      text = message.name,
      x, y;
      
    if (message.city){
      city = message.city.replace('�', 'ã'),
    };

    var mapCoords = this.geoCoordsToMapCoords(latitude, longitude);
    x = mapCoords.x;
    y = mapCoords.y;

    var person = self.map.path(personPath);
    person.scale(0.01, 0.01);
    person.translate(-255, -255); // Reset location to 0,0
    person.translate(x, y);
    person.attr({
      fill: 'red',
      stroke: 'transparent',
      cursor: 'crosshair'
    });

    var title = self.map.text(x, y - 3.5, text);
    title.attr({
      fill: 'black',
      "font-size": 3,
      "font-family": "'Helvetica Neue', 'Helvetica', sans-serif",
      'font-weight': 'bold'
    });
    var subtitle = self.map.text(x, y + 4.5, city);
    subtitle.attr({
      fill: '#999',
      "font-size": 3,
      "font-family": "'Helvetica Neue', 'Helvetica', sans-serif"
    });

    var hoverFunc = function () {
      person.attr({
        fill: 'orange'
      });
      $(title.node).fadeIn('fast');
      $(subtitle.node).fadeIn('fast');
    };
    var hideFunc = function () {
      person.attr({
        fill: 'red'
      });
      $(title.node).fadeOut('slow');
      $(subtitle.node).fadeOut('slow');
    };
    $(person.node).hover(hoverFunc, hideFunc);

    person.animate({
      scale: '.01, .01'
    }, 2000, 'elastic', function () {
      $(title.node).fadeOut(5000);
      $(subtitle.node).fadeOut(5000);
    });
  }

  this.init();
}