/**
 * Example application that uses the Unloq client API
 */
var unloq = require('../index'); // this is require('unloq-node')

var authObj = new unloq.Auth({
  apiKey: 'key',
  privateKey: 'pkey',
  publicKey: 'pubkey',
  domain: 'http://unloq.dev/',
  gateway: 'http://unloq.dev'
});

var apiObj = new unloq.Api(authObj);

apiObj
  .authenticate('john@psspw.ro', '680')
  //.authenticate('john@2r5ls.ro','887')
  //.authenticate('john@ypt0e.ro', '515')
  .on('pending', function() {
    console.log("Pending...");
  })
  .then(function(accessToken) {
    // TODO: generate session.
    var sessionId = new Date().getTime() + Math.random().toString();
    console.log("Access token:", accessToken)
    //return apiObj.confirmToken(accessToken, sessionId, 3600);
  })
  .then(function(userData) {
    console.log("Request terminated. User:", userData);
  })
  .error(function(e) {
    console.log("Failed:", e);
  });
