/**
* Example application that uses the Unloq access authorization API.
* */

var unloq = require('../index');

var authObj = new unloq.Auth({
  apiKey: 'key',
  domain: 'http://unloq.dev',
  privateKey: 'pkey',
  publicKey: 'pubkey',
  gateway: 'http://unloq.dev/'
});


var apiObj = new unloq.Api(authObj);

var userData = {  // This contains the user information that we want to authorize against the given target user.
  email: 'a@doe.ro',
  name: 'Jane Doe Doloris'
  // OPTIONAL: ip: the source IP address.
};

var targetEmail = 'john@doe.ro';

apiObj
  .authorizeAccess(targetEmail, userData, true)
  .then(function(result) {
    console.log("ACCESS Granted. Token:", result.token);
  })
  .error(function(e) {
    console.log("Failed:", e);
  });
