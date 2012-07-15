/*
 * complex-request-test.js: Tests for complex requests using HttpAgent
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */

var path = require('path'),
    sys = require('sys'),
    http = require('http'),
    events = require('events'),
    assert = require('assert'),
		net = require('net'),
    vows = require('vows'),
    httpAgent = require('../lib/http-agent'),
    helpers = require('./helpers');

var complexUrls = [
  {
    method: 'GET',
    uri: 'barackobama'
  },
  {
    method: 'GET',
    uri: 'facebook'
  },
  {
    method: 'GET',
    uri: 'google'
  }
];

vows.describe('httpAgent/object-request').addBatch({
  "When using an httpAgent": {
    "to browse an undefined url": {
      topic: function () {
        var agent = helpers.createAgent({ urls: [undefined] });
        agent.addListener('next', this.callback);
        agent.start();
      },
      "should throw an error": function (err, agent) {
        assert.isNotNull(err);
      }
    },
    "to browse a path of complex urls": {
      "the next event": {
        topic: function () {
          var agent = helpers.createAgent({ urls: complexUrls });
          agent.addListener('next', this.callback);
          agent.start();
        },
        "should be raised after start": function (e, agent) { 
          assert.instanceOf(agent, httpAgent.HttpAgent);
          assert.isNotNull(agent.response);
        }
      }
    }
  }
}).export(module);