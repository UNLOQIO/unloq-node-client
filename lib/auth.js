var extend = require('node.extend'),
  path = require('path'),
  PublicKey = require('./pair/public.js'),
  PrivateKey = require('./pair/private.js');
/*
* This is our Authentication configuration object. This will be used in all our API calls.
* As one of its main functionality is its save() / restore() functions that will allow it to dump the auth data.
* */

module.exports = (function ClassConstructor() {
  var config = {
    privateKey: null,
    publicKey: null,
    apiKey: null,
    domain: null,   // the domain used by the app
    endpoint: 'api/',
    gateway: 'http://myshield.dev'
  };

  var publicObj,// these are the public/private key objects.
    privateObj;

  var auth = function MyShieldAuth(_config) {
    if(typeof _config !== 'object') _config = {};
    config = extend(true, config, _config);
    publicObj = new PublicKey(config.publicKey);
    privateObj = new PrivateKey(config.privateKey);
  };

  function getter(key, callback) {
    Object.defineProperty(auth.prototype, key, {
      configurable: false,
      enumerable: false,
      get: callback
    });
  }

  /*
  * Encrypts the data we received.
  * */
  auth.prototype.encrypt = function EncryptData(data) {
    // Encryption is disabled
    return data;
  };

  getter('key', function() {
    return config.apiKey;
  });
  getter('domain', function() {
    return config.domain;
  });

  getter('gateway', function() {
    var g = config.gateway;
    if(g.lastIndexOf('/') == g.length-1) {
      g = g.substr(0, g.length-1);
    }
    g += '/' + config.endpoint;
    return g;
  });

  /* Checks if our configuration is valid */
  auth.prototype.isValid = function IsAuthValid() {
    if(!config.privateKey || !config.publicKey || !config.apiKey) return false;
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
    if(config.domain) {
      isValid = true;
      d['domain'] = config.domain;
    }
    if(config.apiKey) {
      isValid = true;
      d['apiKey'] = config.apiKey;
    }
    if(!isValid) return null;
    return JSON.stringify(d);
  };

  auth.prototype.__type = 'auth';
  return auth;
});