/*
 * functional-request-test.js: Tests for functional requests (i.e. requests that generate 
 *                             their own ClientRequest) using HttpAgent
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
    httpAgent = require('../lib/http-agent');

vows.describe('httpAgent').addBatch({
  
}).export(module);