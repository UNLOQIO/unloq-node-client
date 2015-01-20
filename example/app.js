/**
 * Example application that uses the MyShield client API
 */

var shield = require('../index'); // this is require('myshield-node')

var authObj = new shield.Auth({
  apiKey: 'key',
  apiSecret: 'secret',
  gateway: 'http://mata.com/'
});

var apiObj = new shield.Api(authObj);

apiObj.test().then(function(d) {
  console.log("GOT DATA",d);
})