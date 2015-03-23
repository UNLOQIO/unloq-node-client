var Transport = require('./transport.js'),
  Auth = require('./auth.js'),
  bluebird = require('bluebird');
/*
* This is our API functionality that we expose to our consumers.
* */

module.exports = (function ClassConstructor() {
  var auth = null;    // this is an unloq.Auth instance.
  var api = function UnloqApi(authObj) {
    if(typeof authObj !== 'object' || authObj === null) {
      throw new Error('Unloq.Api: First constructor argument must be an instance of unloq.Auth');
    }
    // If we receive only the object with configuration, we try and create the auth object.
    if(authObj.__type !== 'auth') {
      var AuthClass = Auth();
      authObj = new AuthClass(authObj);
    }
    auth = authObj;
  };

  /*
  * This API endpoint will perform a Unloq AUTHENTICATION against the given email/{phone}. It will usually take a few seconds
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
  api.prototype.authenticate = function AuthenticateUser(email, phoneDigits) {
    var ENDPOINT = 'authenticate';
    return bluebird.promise(function(resolve, reject) {
      var promise = this;
      if(typeof email !== 'string' || email === '') {
        var e = new Error('Invalid e-mail address');
        e.code = 'INVALID_DATA';
        return reject(e);
      }
      var payload = {
        domain: auth.domain,
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
        .on('error', function(code) {
          var e =  new Error('Internal server error.');
          e.code = (typeof code === 'string' ? code : 'SERVER_ERROR');
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
  * This will perform user authorization on behalf of the application.
  * Arguments:
  *   targetEmail - the user that will receive the authorization notification. This must be a valid Unloq user.
  *   userData.email - the email of the user that wants to gain access to the application on behalf of the target user.
  *   userData.name (optional) - the display name of the user that requires access to the application.
  *   userData.image (optional) - the thumbnail image URL of the user that wants to gain access to the application.
  *   userData.ip (optional) - the display IP address of the user that requires access to the application.
  *   userData.domain (optional) - If the request is made of a different domain than the unloq.Auth one, this will overwrite the latter.
  *   isTimeLimited (optional, default: false) - is this a one-time access or a period-restricted access. Period restricted accesses will have to implement access de-authorization.
  *
  * */
  api.prototype.authorizeAccess = function AuthorizeUserAccess(targetEmail, userData, isTimeLimited) {
    var ENDPOINT = 'authorize/user';
    return bluebird.promise(function(resolve, reject) {
      if(typeof targetEmail !== 'string' || targetEmail.trim() === '') return reject(new Error('TARGET_EMAIL_REQUIRED'));
      if(typeof userData !== 'object' || userData == null) return reject(new Error('USER_DATA_REQUIRED'));
      if(typeof userData['email'] !== 'string' || userData['email'].trim() === '') return reject(new Error('USER_EMAIL_REQUIRED'));
      var requestData = {
        email: targetEmail,
        user_email: userData['email'],
        time_limited: (typeof isTimeLimited === 'boolean' ? isTimeLimited : false)
      };
      if(typeof userData['name'] === 'string') requestData['user_name'] = userData['name'];
      if(typeof userData['image'] === 'string') requestData['user_image'] = userData['image'];
      if(typeof userData['ip'] === 'string') requestData['user_ip'] = userData['ip'];
      if(typeof userData['domain'] === 'string') {
        requestData['domain'] = userData.domain;
      } else {
        if(auth.domain) requestData['domain'] = auth.domain;
      }
      var tObj = new Transport(auth, true)
      tObj.timeout(false);
      tObj.endpoint(ENDPOINT);
      tObj.post(requestData).then(function(accessData) {
        resolve(accessData.data);
      }).error(function(err) {
        reject(err);
      });
    }.bind(this));
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
    var ENDPOINT = 'token/confirm';
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