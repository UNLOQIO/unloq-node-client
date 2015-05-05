/**
 * Example application that uses the UNLOQ client API
 */
var unloq = require('../index'); // this is require('unloq')
var config = require('./config');

var apiObj = new unloq.Api(config);

apiObj
  .authenticate({
    email: 'ro@rarara.ra'
  }, ['first_name'])
  .on('pending', function() {
    console.log("Pending...");
  })
  .then(function(accessToken) {
    // TODO: generate session.
    var sessionId = new Date().getTime() + Math.random().toString();
    console.log("Access token:", accessToken)
    return apiObj.tokenData(accessToken, {
      sessionId: sessionId,
      duration: 3000
    });
  })
  .then(function(userData) {
    console.log("Request terminated. User:", userData);
  })
  .error(function(e) {
    console.log("Failed:", e);
  });
