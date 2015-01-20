/*
* These are our components that we're going to expose.
* */
var bluebird = require('bluebird'),
  AuthClass = require('./lib/auth.js'),
  ApiClass = require('./lib/api.js');

/* First thing we do is we wrap the "promise" function over bluebird. */
bluebird.promise = function CreateShieldPromise(handler) {
  var _resolve,
    _reject;
  var pObj = new bluebird(function(resolve, reject) {
    _resolve = resolve;
    _reject = reject;
    try {
      handler(resolve, reject);
    } catch(e) {
      reject(e);
    }
  });
  pObj.resolve = _resolve;
  pObj.reject = _reject;
  pObj.success = pObj.done;
  return pObj;
};

module.exports = {};

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
