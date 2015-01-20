var extend = require('node.extend'),
  path = require('path');
/*
* This is our Authentication configuration object. This will be used in all our API calls.
* As one of its main functionality is its save() / restore() functions that will allow it to dump the auth data.
* */

module.exports = (function ClassConstructor() {
  var config = {
    privateKey: null,
    publicKey: null,
    apiKey: null,
    apiSecret: null,
    version: 'v1',
    endpoint: 'api',
    gateway: 'http://myshield.dev'
  };

  var auth = function MyShieldAuth(_config) {
    if(typeof _config !== 'object') _config = {};
    config = extend(true, config, _config);
  };

  /* We expose the gateway and api version */
  Object.defineProperty(auth.prototype, 'gateway', {
    configurable: false,
    enumerable: false,
    get: function() {
      var g = config.gateway;
      if(g.lastIndexOf('/') == g.length-1) {
        g = g.substr(0, g.length-1);
      }
      g += '/' + config.endpoint;
      return g;
    }
  });
  /* And the version API */
  Object.defineProperty(auth.prototype, 'version', {
    configurable: false,
    enumerable: false,
    get: function() {
      return config.version;
    }
  });

  /* Checks if our configuration is valid */
  auth.prototype.isValid = function IsAuthValid() {
    if(!config.privateKey || !config.publicKey || !config.apiKey || !config.apiSecret) return false;
    return true;
  };

  /*
  * This will restore the previously saved settings. (we only save the api credentials anyhow.
  * */
  auth.prototype.set = function RestoreCredentials(_config) {
    if(typeof _config === 'object' && _config !== null) {
      config = extend(true, config, _config);
      return this;
    }
    if(typeof _config === 'string') {
      try {
        _config = JSON.parse(_config);
        config = extend(true, config, _config);
      } catch(e) {
        console.warn('MyShield.Auth: failed to parse configuration.');
      }
      return this;
    }
    return this;
  };

  /*
  * Saves the configuration options so that we can persist them.
  * */
  auth.prototype.store = function SaveConfiguration() {
    var d = {},
      isValid = true;
    if(config.privateKey) {
      isValid = true;
      d['privateKey'] = config.privateKey;
    }
    if(config.publicKey) {
      isValid = true;
      d['publicKey'] = config.publicKey;
    }
    if(config.apiKey) {
      isValid = true;
      d['apiKey'] = config.apiKey;
    }
    if(config.apiSecret) {
      isValid = true;
      d['apiSecret'] = config.apiSecret;
    }
    if(!isValid) return null;
    return JSON.stringify(d);
  };

  auth.prototype.__type = 'auth';
  return auth;
});