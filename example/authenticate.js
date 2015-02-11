/**
 * Example application that uses the MyShield client API
 */

var shield = require('../index'); // this is require('myshield-node')

var authObj = new shield.Auth({
  apiKey: 'key',
  privateKey: 'pkey',
  publicKey: 'pubkey',
  gateway: 'http://myshield.dev/'
});

var apiObj = new shield.Api(authObj);

apiObj
  .authenticate('http://myshield.dev/','jane@ifrpc.ro', '492')
  .on('pending', function() {
    console.log("Pending...");
  })
  .then(function(accessToken) {
    // TODO: generate session.
    var sessionId = new Date().getTime() + Math.random().toString();
    console.log("Access token:", accessToken)
    return apiObj.confirmToken(accessToken, sessionId, 3600);
  })
  .then(function(userData) {
    console.log("Request terminated. User:", userData);
  })
  .error(function(e) {
    console.log("Failed:", e);
  });
