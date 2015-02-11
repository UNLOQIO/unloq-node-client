/**
* Example application that uses the MyShield authorization API.
* */

var shield = require('../index');

var authObj = new shield.Auth({
  apiKey: 'key',
  domain: 'http://myshield.dev',
  privateKey: 'pkey',
  publicKey: 'pubkey',
  gateway: 'http://myshield.dev/'
});


var apiObj = new shield.Api(authObj);

var userData = {  // This contains the user information that we want to authorize against the given target user.
  email: 'jane@doe.ro',
  name: 'Jane Doe Doloris'
  // OPTIONAL: ip: the source IP address.
};

var targetUser = 'john@doe.ro';

apiObj
  .authorizeAccess(targetUser, userData, true)
  .then(function(result) {
    console.log("ACCESS Granted. Token:", result.token);
  })
  .error(function(e) {
    console.log("Failed:", e);
  });
