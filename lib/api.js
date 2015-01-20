var Transport = require('./transport.js');
/*
* This is our API functionality that we expose to our consumers.
* */

module.exports = (function ClassConstructor() {
  var auth = null;    // this is an shield.Auth instance.
  var api = function MyShieldApi(authObj) {
    if(typeof authObj !== 'object' || authObj === null || authObj.__type !== 'auth') {
      throw new Error('MyShield.Api: First constructor argument must be an instance of shield.Auth');
    }
    auth = authObj;
  };

  api.prototype.test = function() {
    var t = new Transport(auth);
    return t.endpoint('/gica').post();
  };

  return api;
});