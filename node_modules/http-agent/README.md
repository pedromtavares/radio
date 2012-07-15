# http-agent

A simple agent for performing a sequence of http requests in node.js

## Installation

### Installing npm (node package manager)
<pre>
  curl http://npmjs.org/install.sh | sh
</pre>

### Installing http-agent
<pre>
  npm install http-agent
</pre>

## Usage 

There are several way to use http-agent: 

1. Simple: Pass it a host and an array of strings to visit all of those URLs.
2. Complex: Pass it a host and an array of JSON objects representing all relevant parameters (method, request body, etc.)
3. Iterator: Each time the 'next' event is raised by an agent, you have the opportunity to add or remove URLs you wish to visit. In this sense  

### Using http-agent to visit a set of URLs on a single host with 'GET'
<pre>
  var sys = require('sys'),
      httpAgent = require('path/to/http-agent/lib');
  
  var agent = httpAgent.create('graph.facebook.com', ['apple', 'facebook', 'google']);
  
  agent.addListener('next', function (e, agent) {
    // Simple usage: Just output the raw
    // HTML returned from each request
    sys.puts(agent.body);
    agent.next();
  });
  
  agent.addListener('stop', function (e, agent) {
    sys.puts('Agent has completed visiting all urls');
  });
  
  // Start the agent
  agent.start();
</pre>

### Using http-agent to visit a set of URLs on a single host with complex parameters
Since http-agent is based on top of request, it can take a set of JSON objects for request to use. If you're looking for more documentation about what parameters are relevant to http-agent, see [request][0] which http-agent is built on top of. 

<pre>
  var sys = require('sys'),
      httpAgent = require('path/to/http-agent/lib');
  
  var options = [
    {
      method: 'GET',
      uri: 'apple'
    },
    {
      method: 'GET',
      uri: 'facebook'
    },
    {
      method: 'GET',
      uri: 'http://google.com/'
    }
  ];
  var agent = httpAgent.create('graph.facebook.com', options);
  
  agent.addListener('next', function (e, agent) {
    // Simple usage: Just output the raw
    // HTML returned from each request
    sys.puts(agent.body);
    agent.next();
  });
  
  agent.addListener('stop', function (e, agent) {
    sys.puts('Agent has completed visiting all urls');
  });
  
  // Start the agent
  agent.start();
</pre>

### Using http-agent as an iterator over webpages
Each time an instance of http-agent raises the 'next' event the agent is passed back as a parameter. That allows us to change the control flow of pages each time a page is visited. The agent is also passed back to other important events such as 'stop' and 'back'.
<pre>
  var sys = require('sys'),
      httpAgent = require('path/to/http-agent/lib');
  
  var agent = httpAgent.create('graph.facebook.com', ['apple', 'facebook', 'google']),
      addPage = true;
  
  agent.addListener('next', function (e, agent) {
    if (addPage) {
      // The agent will now also visit 'http://graph.facebook.com/yahoo'
      agent.addUrl('yahoo');
      addPage = false;
    }

    // Simple usage: Just output the raw
    // HTML returned from each request
    sys.puts(agent.body);
    agent.next();
  });
  
  agent.addListener('stop', function (e, agent) {
    sys.puts('Agent has completed visiting all urls');
  });
  
  // Start the agent
  agent.start();
</pre>

## Run Tests
<pre>
  vows test/*-test.js --spec
</pre>

#### Author: [Charlie Robbins](http://www.charlierobbins.com);

[0]: https://github.com/mikeal/request
