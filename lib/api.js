var crypto = require('crypto'),
  url = require('url'),
  Transport = require('./transport.js'),
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
  var DEFAULT_TIMEOUT = 6000;

  function ApiError(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }


  /*
   * This API endpoint will perform a Unloq AUTHENTICATION against the given email/{phone}. It will usually take a few seconds
   * for the promise to fulfil, as it simulates the in-browser login.
   * EVENTS:
   *   // pending - when the notification reached the user
   *
   *  OPTIONS:
   *    -events = false - turns off event listening and listens only for the approve/deny final request.
   *    - socket - if specified, the socket we listen for the "close" event to abort the request.
   * ERRORS:
   *   DENIED - the user rejected the login
   *   TIMEOUT - the user did not approve nor deny in the given timeframe
   *   ABORTED - when the connection closes unexpectedly.
   *
   * NOTE:
   *     denied, timeout will reject the promise.
   * NOTE2:
   *   The promise will resolve with the accessToken as its first argument.
   * */
  api.prototype.authenticate = function AuthenticateUser(credentials, opt) {
    var ENDPOINT = 'authenticate';
    if(typeof opt !== 'object' || !opt) opt = {};
    if(opt.events !== false) {
      ENDPOINT += '?events=true';
    }
    return bluebird.promise(function(resolve, reject) {
      var promise = this;
      if(typeof credentials !== 'object' || credentials == null) {
        var e = new Error('Invalid credentials');
        e.code = 'INVALID_DATA';
        return reject(e);
      }
      // The API works with either e-mail or phone number as the primary credentials.
      var payload = {},
        hasCredentials = false;
      if(typeof credentials.email === 'string' && credentials.email !== '' && credentials.email.indexOf('@') !== -1) {
        payload['email'] = credentials.email;
        hasCredentials = true;
      }
      if(typeof credentials.token !== 'undefined' && credentials.token) {
        payload['token'] = credentials.token.toString();
      }
      payload.method = (typeof credentials.method === 'string' ? credentials.method : 'UNLOQ');
      if(typeof opt.data === 'object' && opt.data) {
        for(var key in opt.data) {
          if(key !== 'email' && key !== 'token') {
            payload[key] = opt.data[key];
          }
        }
      }
      if(!hasCredentials) {
        var e = new Error('At least one primary credential is required');
        e.code = 'INVALID_DATA';
        return reject(e);
      }
      var tObj = new Transport(auth, opt.events !== false),
        isCompleted = false;
      tObj.timeout(false);
      var transportPromise = tObj.endpoint(ENDPOINT).post(payload);
      this.cancel = function CancelRequest() {
        transportPromise.cancelRequest();
      };
      function onSocketClose() {
        if(isCompleted) return;
        transportPromise.cancelRequest();
      }
      function bindSocket() {
        if(!opt.socket) return;
        opt.socket.removeListener('close', onSocketClose);
        opt.socket.once('close', onSocketClose);
      }
      function unbindSocket() {
        if(!opt.socket) return;
        opt.socket.removeListener('close', onSocketClose);
      }
      bindSocket();
      transportPromise.error(reject);
      transportPromise
        .on('pending', function() {
          promise.emit('pending');
        })
        .on('approved', function(d) {
          unbindSocket();
          isCompleted = true;
          try {
            var data = d.data;
            resolve(data);
          } catch(e) {
            e.code = 'SERVER_ERROR';
            e.message = 'API Returned an invalid response.';

            return reject(e);
          }
        })
        .on('denied', function(d) {
          unbindSocket();
          isCompleted = true;
          var msg = 'The user denied the login';
          if(d.data && d.data.security_field) {
            msg += '. Please provide ' + d.data.security_field + ' on next try.';
          }
          var e = new Error(msg);
          e.code = 'DENIED';
          if(d.data && d.data.security_field) {
            e.security_field = d.data.security_field;
          }
          return reject(e);
        })
        .on('timeout', function() {
          unbindSocket();
          isCompleted = true;
          var e = new Error('The user failed to approve the login in the given timeframe.');
          e.code = 'TIMEOUT';
          return reject(e);
        })
        .on('error', function(err) {
          unbindSocket();
          isCompleted = true;
          if(typeof err === 'object' && err) {
            var e = new Error(err.message || 'Internal server error');
            e.code = err.code || 'SERVER_ERROR';
            if(err.data) e.data = err.data;
          } else {
            var e =  new Error('Internal server error.');
            e.code = 'SERVER_ERROR';
          }
          return reject(e);
        })
        .then(function(resp) {
          unbindSocket();
          if(isCompleted) return;
          isCompleted = true;
          if(typeof resp.data !== 'object' && !resp.data.token) {
            var e = new Error('An unexpected error occurred and the token is missing.');
            e.code = 'SERVER_ERROR';
            return reject(e);
          }
          resolve(resp.data);
        }).catch(function(err) {
          unbindSocket();
          if(isCompleted) return;
          isCompleted = true;
          reject(err);
        });
    });
  };

  /*
  * This call can be used by applications that have enabled app-linking.
  * When a user first signs in with UNLOQ to an app, the following happen:
  * 1. The UNLOQ device generates a 32-char secret key
  * 2. The UNLOQ device will do a POST request to the application's link webhook, having the following:
  *   Querystring: key={applicationApiKey}, id={unloqProfileId}
  *   Headers: X-Unloq-Signature: The SHA256 signature of the querystring (+ the link webhook path), signed with the application's Api SECRET
  *   Body: secret={DeviceAppSecret} - the secret key that was generated by the device, stored on the device only and shared with the application.
  *
  * 3. Any sub-sequent authentication requests with UNLOQ (including the first one) will attach to the user's information in the access token, the following
  *   link_key: a randomly generated string on every new authentication request
  *   link_signature: base64-encoded SHA256(secret, link_key) = the signed string of the link key, with the DeviceAppSecret
  * */
  api.prototype.verifyLink = function VerifyUserLink(linkKey, linkSignature, deviceSecret) {
    try {
      if(typeof linkKey !== 'string' || !linkKey || typeof linkSignature !== 'string' || !linkSignature) return false;
      if(typeof deviceSecret !== 'string' || deviceSecret === '') {
        console.warn('UNLOQ.verifyLink: provided deviceSecret is not a string or empty.');
        return false;
      }
      var signedLinkKey = crypto.createHmac('sha256', deviceSecret).update(linkKey).digest('base64');
      if(signedLinkKey === linkSignature) return true;
      return false;
    } catch(e) {
      return false;
    }
  };

  /*
  * The call will verify the signature of an incoming webhook.
  * Arguments:
  *   signature - the X-Unloq-Signature header.
   *   data - the incoming POST data.
  * Steps:
  *   1. Create a string with the PATH of the given URL (excluding protocol, domain and port, just the PATH with its querystring.)
  *   2. Sort the data alphabetically by key
  *   3. Append each KEY,VALUE of the data to the string.
  *   4.HMAC-SHA256 with the configured API SECRET
  *   5. Base64 encode the signature and verify it against what we've got.
  * */
  api.prototype.verifySign = function VerifyWebhookSignature(signature, path, data) {
    try {
      if(typeof data !== 'object' || !data) data = {};
      if(typeof signature !== 'string' || signature === '') return false;
      var signed = '',
        sorted = [];
      if(path.indexOf('http') === -1) { // we have only the path
        signed = path;
      } else {  // we have the full URL. We get only the path from it.
        signed = url.parse(path).path;
      }
      if(signed.charAt(0) !== '/') signed = '/' + signed;
      for(var key in data) {
        if(data.hasOwnProperty(key)) {
          sorted.push(key);
        }
      }
      sorted.sort();
      for(var i=0; i < sorted.length; i++) {
        var _val = data[sorted[i]];
        if(typeof _val === 'undefined') _val = '';
        signed = signed + sorted[i] + _val;
      }
      var signHash = crypto.createHmac('sha256', auth.secret).update(signed).digest('base64');
      if(signature === signHash) return true;
      return false;
    } catch(e) {
      return false;
    }
  };

  /*
  * This endpoint will try and retrieve the associated data with the given access token.
  * sessionData.sid - the session ID we want to attach to this token.
  * sessionData.duration - the estimated session duration in seconds.
  * */
  api.prototype.authToken = function GetAuthAccessToken(token, sessionData) {
    var ENDPOINT = 'token/session';
    return bluebird.promise(function(resolve, reject) {
      if(typeof sessionData !== 'object' || !sessionData) sessionData = {};
      sessionData.token = token;
      var tObj = new Transport(auth);
      tObj.timeout(DEFAULT_TIMEOUT);
      tObj.endpoint(ENDPOINT).post(sessionData).then(function(resultData) {
        resolve(resultData.data);
      }).error(reject);
    });
  };

  /*
  * This endpoint will be used right after retrieving an access token for an authenticated e-mail.
  * After the login is confirmed, the service must generate a session id and map the access token to
  * the session id. This is to enable remote login.
  * Arguments:
  *     accessToken - the previously generated access token from authenticate()
  *     data.session_id - the locally generated session ID, or cookie Id that the user will receive
  *     data.duration - the number of seconds the session will be available, optional.
  * */
  api.prototype.tokenData = function AttachSessionToAccessToken(accessToken, _data) {
    var ENDPOINT = 'token';
    return bluebird.promise(function(resolve, reject) {
      if(typeof accessToken !== 'string' || accessToken === '') {
        return reject(ApiError('INVALID_DATA', 'Access token is required.'));
      }
      var data = (typeof _data === 'object' && _data ? _data : {});
      var payload = {
        token: accessToken
      };
      if(typeof data.session_id === 'string') {
        payload['session'] = data.session_id;
      }
      if(typeof data.duration === 'string' || typeof data.duration === 'number') {
        payload['duration'] = parseInt(data.duration);
      }
      var tObj = new Transport(auth);
      tObj.timeout(DEFAULT_TIMEOUT);
      tObj.endpoint(ENDPOINT).post(payload).then(function(resultData) {
        resolve(resultData.data);
      }).error(reject);
    }.bind(this));
  };

  /**
  * Applications that have enabled the web SDK can request a temporary access token for the given e-mail or UnloqID, that can be used to
   * call the authorize and the encryption key request endpoints.
   * Arguments:
   *  data.email - the Unloq account e-mail address
   *    OR
   *  data.unloq_id - the UnloqID of the user we want to create the token for.
   *  data.device_token - the 2fa device token.
   *  _duration - (optional) - the number of seconds the token is available. Defaults to 60 seconds
   *  Resolves with:
   *    - res.token - the access token
   *    - res.unloq_id - the user's UnloqID
  * */
  api.prototype.generateToken = function GenerateTemporaryAccessToken(data, _duration) {
    var ENDPOINT = 'token/generate';
    return bluebird.promise(function(resolve, reject) {
      if(typeof data !== 'object' || !data) {
        return reject(ApiError('INVALID_DATA', 'Invalid arguments.'));
      }
      if(typeof data.device_token === 'undefined') {
        return reject(ApiError('INVALID_DEVICE_TOKEN', 'Missing device token.'));
      }
      if(typeof data.unloq_id === 'undefined' && typeof data.email === 'undefined') {
        return reject(ApiError('INVALID_CREDENTIALS', 'Please specify the e-mail address or the UnloqID'));
      }
      var payload = {
        device_token: data.device_token
      };
      if(typeof data.email === 'string') {
        payload.email = data.email;
      } else {
        payload.unloq_id = data.unloq_id
      }
      if(typeof _duration === 'number' && _duration > 0) {
        payload.duration = _duration
      }
      var tObj = new Transport(auth);
      tObj.timeout(DEFAULT_TIMEOUT);
      tObj.endpoint(ENDPOINT).post(payload).then(function(resultData) {
        resolve(resultData.data);
      }).error(reject);
    });
  };

  return api;
});