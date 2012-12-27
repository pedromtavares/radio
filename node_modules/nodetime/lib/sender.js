
var nt;

var infoBuffer;
var metricsBuffer = [];
var samplesBuffer = {};
var slowSamplesBuffer = {};

exports.init = function(_nt) {
  nt = _nt;

  nt.on('info', function(info) {
    if(!nt.headless)
      infoBuffer = info;
  });

  nt.on('metric', function(metric) {
    if(!nt.headless)
      metricsBuffer.push(metric);
  });

  nt.on('sample', function(sample) {
    if(nt.headless || !nt.sessionId) return;

    if(!nt.paused && sample._filtered) {
      samplesBuffer[sample._group] || (samplesBuffer[sample._group] = []);
      samplesBuffer[sample._group].push(sample);
    }

    if(nt.history) {
      slowSamplesBuffer[sample._group] || (slowSamplesBuffer[sample._group] = []);
      slowSamplesBuffer[sample._group].push(sample);
    }
  });

  // send slow samples and empty buffer
  nt.setInterval(function() {
    try {
      sendSlowSamples();
    }
    catch(e) {
      nt.error(e);
    }
  }, 60000);

  // send samples and metrics 
  nt.setInterval(function() {
    try {
      sendInfo();
      sendMetrics();
      sendSamples();
    }
    catch(e) {
      nt.error(e);
    }
  }, 2000);


  // empty buffer if no sessionId for more than 30 sec
  nt.setInterval(function() {
    try {
      if(!nt.sessionId) 
        metricsBuffer = [];
    }
    catch(e) {
      nt.error(e);
    }
  }, 30000);
};


var sendInfo = function() {
  if(!nt.sessionId || !infoBuffer) return;

  nt.apiClient.send({cmd: 'updateData', args: infoBuffer});
  infoBuffer = undefined;
};


var sendMetrics = function() {
  if(!nt.sessionId || metricsBuffer.length == 0) return;

  metricsBuffer.forEach(function(metric) {
    nt.apiClient.send({cmd: 'updateData', args: metric});
  });

  metricsBuffer = [];
};


var sendSamples = function() {
  if(!nt.sessionId) return;

  for(var group in samplesBuffer) {
    var samples = samplesBuffer[group].sort(function(a, b) {
      return b._ms - a._ms;
    });

    for(var i = 0; i < (samples.length < 5 ? samples.length : 5); i++) {
      nt.apiClient.send({cmd: 'updateData', args: samples[i]});
    }
  }

  samplesBuffer = {};
};


var sendSlowSamples = function() {
  for(var group in slowSamplesBuffer) {
    var samples = slowSamplesBuffer[group].sort(function(a, b) {
      return b._ms - a._ms;
    });

    for(var i = 0; i < (samples.length < 5 ? samples.length : 5); i++) {
      samples[i]._slow = true;
      nt.apiClient.send({cmd: 'updateData', args: samples[i]});
    }
  }

  slowSamplesBuffer = {};
};


