/**
 * Example application that uses the UNLOQ client API
 */
var unloq = require('../index'); // this is require('unloq')
var config = require('./config');

var authObj = new unloq.Auth({
  apiKey: 'jkasdfnknasdlkfnjkasdnlkfjnlasdnfasdjnfjk234nf',
  apiSecret: '34jn5klj34n5jkln2jn4kl23nl4jk23nl4nl23kn4kj23nkl4n23l'
});

var apiObj = new unloq.Api(authObj);

apiObj
  .authenticate({
    email: 'rar@ra.ra',
    digits: '787'
  })
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
