var Transport = require('./transport.js'),
  bluebird = require('bluebird');
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

  /*
  * This API endpoint will perform a MyShield AUTHENTICATION against the given email/{phone}. It will usually take a few seconds
  * for the promise to fulfil, as it simulates the in-browser login.
  * EVENTS:
  *   pending - when the notification reached the user
  *
  * ERRORS:
  *   USER_DENIED - the user rejected the login
  *   USER_TIMEOUT - the user did not approve nor deny in the given timeframe
  *   DEVICE_UNREACHABLE - we failed to reach the user's device in the given timeframe.
  *
  * NOTE:
  *     denied, timeout, unreachable will reject the promise.
  * NOTE2:
  *   The promise will resolve with the accessToken as its first argument.
  * */
  api.prototype.authenticate = function AuthenticateUser(domain, email, phoneDigits) {
    var ENDPOINT = '/remote/authenticate';
    return bluebird.promise(function(resolve, reject) {
      var promise = this;
      if(typeof email !== 'string' || email === '') {
        var e = new Error('Invalid e-mail address');
        e.code = 'INVALID_DATA';
        return reject(e);
      }
      var payload = {
        domain: domain,
        email: email
      };
      if(typeof phoneDigits !== 'undefined') {
        payload['digits'] = phoneDigits;
      }
      var tObj = new Transport(auth, true)
      tObj.timeout(false);
      var transportPromise = tObj.endpoint(ENDPOINT).post(payload);
      transportPromise.error(reject);
      transportPromise
        .on('pending', function() {
          promise.emit('pending');
        })
        .on('approved', function(d) {
          try {
            var token = d.data.token;
            resolve(token);
          } catch(e) {
            e.code = 'SERVER_ERROR';
            e.message = 'API Returned an invalid response.';
            return reject(e);
          }
        })
        .on('denied', function(d) {
          var e = new Error('The user denied the login');
          e.code = 'USER_DENIED';
          return reject(e);
        })
        .on('timeout', function() {
          var e = new Error('The user failed to approve the login in the given timeframe.');
          e.code = 'USER_TIMEOUT';
          return reject(e);
        })
        .on('error', function() {
          var e =  new Error('Internal server error.');
          e.code = 'SERVER_ERROR';
          return reject(e);
        })
        .on('unreachable', function() {
          var e = new Error('Failed to contact any device.');
          e.code = 'DEVICE_UNREACHABLE';
          return reject(e);
        });
    });
  };

  /*
  * This endpoint will be used right after retrieving an access token for an authenticated e-mail.
  * After the login is confirmed, the service must generate a session id and map the access token to
  * the session id. This is to enable remote login.
  * Arguments:
  *     accessToken - the previously generated access token from authenticate()
  *     sessionId - the locally generated session ID, or cookie Id that the user will receive
  *     duration - the number of seconds the session will be available, optional.
  * */
  api.prototype.confirmToken = function AttachSessionToAccessToken(accessToken, sessionId, duration) {
    var ENDPOINT = '/remote/token/confirm';
    return bluebird.promise(function(resolve, reject) {
      if(typeof accessToken !== 'string' || accessToken == '') {
        var e = new Error('Invalid access token.');
        e.code = 'INVALID_DATA';
        return reject(e);
      }
      if(typeof sessionId !== 'string' || sessionId === '') {
        var e = new Error('Invalid session ID.');
        e.code = 'INVALID_DATA';
        return reject(e);
      }
      var payload = {
        token: accessToken,
        session: sessionId
      };
      if(typeof duration === 'number') {
        payload['duration'] = duration;
      }
      var tObj = new Transport(auth);
      tObj.timeout(4000);
      tObj.endpoint(ENDPOINT).post(payload).then(function(resultData) {
        resolve(resultData.data);
      }).error(reject);
    }.bind(this));
  };

  return api;
});