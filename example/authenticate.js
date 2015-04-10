/**
 * Example application that uses the UNLOQ client API
 */
var unloq = require('../index'); // this is require('unloq-node')

var authObj = new unloq.Auth({
  apiKey: 'jkasdfnknasdlkfnjkasdnlkfjnlasdnfasdjnfjk234nf',
  apiSecret: '34jn5klj34n5jkln2jn4kl23nl4jk23nl4nl23kn4kj23nkl4n23l'
});

var apiObj = new unloq.Api(authObj);

apiObj
  .authenticate('john@doe.ro','111')
  //.authenticate('john@ypt0e.ro', '515')
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
