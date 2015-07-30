/*
* These are our components that we're going to expose.
* */
var EventEmitter = require('events').EventEmitter,
  bluebird = require('bluebird'),
  AuthClass = require('./lib/auth.js'),
  ApiClass = require('./lib/api.js');


/* First thing we do is we wrap the "promise" function over bluebird. */
bluebird.promise = function CreateUnloqPromise(handler) {
  var _resolve,
    _reject,
    eventObj = new EventEmitter();
  var pObj = new bluebird(function(resolve, reject) {
    _resolve = resolve;
    _reject = reject;
    process.nextTick(function() {
      try {
        handler.call(pObj, resolve, reject);
      } catch(e) {
        reject(e);
      }
    });
  });
  pObj.resolve = _resolve;
  pObj.reject = _reject;
  pObj.success = pObj.done;
  pObj.on = function OnEvent() {
    eventObj.on.apply(eventObj, arguments);
    return pObj;
  };
  pObj.emit = function EmitEvent() {
    eventObj.emit.apply(eventObj, arguments);
    return pObj;
  };
  pObj.once = function OnSingleEvent() {
    eventObj.once.apply(eventObj, arguments);
    return pObj;
  };
  return pObj;
};

module.exports = {};

module.exports.defaults = function SetDefaultConfig(config) {
  if(typeof config !== 'object' || !config) return this;
  AuthClass.setDefaultConfig(config);
  return this;
};

Object.defineProperty(module.exports, 'Auth', {
  configurable: false,
  enumerable: false,
  get: function() {
    return AuthClass();
  }
});
Object.defineProperty(module.exports, 'Api', {
  enumerable: false,
  configurable: false,
  get: function() {
    return ApiClass();
  }
});
