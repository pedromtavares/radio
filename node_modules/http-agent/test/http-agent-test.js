/*
 * http-agent-test.js: Tests for simple HttpAgent usage
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */

var path = require('path'),
    sys = require('sys'),
    events = require('events'),
    assert = require('assert'),
    vows = require('vows'),
    httpAgent = require('../lib/http-agent'),
    helpers = require('./helpers');

vows.describe('httpAgent').addBatch({
  "When using an httpAgent": {
    "to browse a path of urls": {
      "the next event": {
        topic: function () {
          var agent = helpers.createAgent();
          agent.addListener('next', this.callback);
          agent.start();
        },
        "should be raised after start": function (e, agent) { 
          assert.instanceOf(agent, httpAgent.HttpAgent);
          assert.isNotNull(agent.response);
        }
      },
      "the next() method": {
        topic: function () {
          var agent = helpers.createAgent();
          agent.addListener('next', this.callback);
          agent.start();
        },
        "should emit the next event": function (e, agent) {
          assert.instanceOf(agent, httpAgent.HttpAgent);
        }
      }
    }
  }
}).addBatch({
  "When using an httpAgent": {
    "simple usage of": {
      "the create() method": {
        topic: helpers.createAgent(),
        "should return a valid httpAgent": function (agent) {
          assert.instanceOf(agent, httpAgent.HttpAgent)
          assert.equal(agent.nextUrls.length, 3);
          assert.equal(agent.nextUrls[0], 'graph.facebook.com/barackobama');
          assert.equal(agent.prevUrls.length, 0);
          assert.equal(agent.host, 'graph.facebook.com');
        },
        "should return a valid event emitter": function (agent) {
          assert.isFunction(agent.addListener);
          assert.isFunction(agent.removeListener);
          assert.isFunction(agent.listeners);
          assert.isFunction(agent.emit);
        },
      },
      "the stop() method": {
        topic: function () {
          var agent = helpers.createAgent();
          agent.addListener('stop', this.callback);
          agent.start();
          agent.stop();
        },
        "should emit the stopped event when previously started": function (e, agent) {
          assert.instanceOf(agent, httpAgent.HttpAgent);
        }
      },
      "the start() method": {
        topic: function () {
          var agent = helpers.createAgent();
          agent.addListener('start', this.callback);
          agent.start();
        },
        "should emit the started event": function (e, agent) {
          assert.instanceOf(agent, httpAgent.HttpAgent);
        }
      },
      "the next() method": {
        topic: function () {
          var agent = helpers.createAgent();
          agent.addListener('next', this.callback);
          agent.start();
        },
        "should emit the next event": function (e, agent) {
          assert.instanceOf(agent, httpAgent.HttpAgent);
          assert.equal(agent.nextUrls.length, 2);
          assert.equal(agent.nextUrls[0], 'graph.facebook.com/facebook');
        }
      },
      "the next() method when passed a url parameter": {
        topic: function () {
          var agent = helpers.createAgent();
          self = this;
            
          // Remark: This is a bit of a hack, vows should support
          // async topic callbacks for multiple event chains.
          var nextCallback = function (e,agent) {
            agent.removeListener('next', nextCallback);
            agent.addListener('next', self.callback);
            agent.next("yahoo");
          };
            
          agent.addListener('next', nextCallback);
          agent.start();
        },
        "should emit the next event": function (e, agent) {
          assert.instanceOf(agent, httpAgent.HttpAgent);
          assert.equal(agent.nextUrls.length, 2);
          assert.equal(agent.prevUrls.length, 2);
          assert.equal(agent.prevUrls[0], "graph.facebook.com/yahoo");
          assert.equal(agent.nextUrls[0], 'graph.facebook.com/facebook');
        }
      },
      "the addUrl() method": {
        topic: helpers.createAgent(),
        "should append a url to the set of nextUrls": function (agent) {
          agent.addUrl('apple');
          assert.equal(agent.nextUrls.length, 4);
          assert.equal(agent.nextUrls[3], 'graph.facebook.com/apple');
        }
      }
    }
  }
}).addBatch({
  "When using an httpAgent": {
    "the back() method": {
      "when called before start": {
        topic: function () {
          var agent = helpers.createAgent();
          agent.addListener('next', this.callback);
          
          // Remark: Never mess with agent._running when consuming httpAgent. 
          agent._running = true;
          agent.back();
        },
        "should raise the next event with an error": function (e, agent) {
          assert.isNotNull(e);
        }
      },
      "when called after start": {
        topic: function () {
          var agent = helpers.createAgent();
          self = this;
        
          // Remark: This is a bit of a hack, vows should support
          // async topic callbacks for multiple event chains.
          var nextCallback = function (e,agent) {
            agent.removeListener('next', nextCallback);
            agent.addListener('next', self.callback);
            agent.back();
          };
        
          agent.addListener('next', nextCallback);
          agent.start();
        },
        "should emit the next event": function (e, agent) {
          assert.instanceOf(agent, httpAgent.HttpAgent);
          assert.equal(agent.nextUrls.length, 2);
          assert.equal(agent.prevUrls.length, 2);
          assert.equal(agent.prevUrls[0], "graph.facebook.com/barackobama");
          assert.equal(agent.nextUrls[0], 'graph.facebook.com/facebook');
        }
      }
    }
  }
}).export(module);
