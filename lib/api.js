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
  var DEFAULT_TIMEOUT = 4000;

  function ApiError(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }

  /*
  * This API endpoint will create an UNLOQ user account on behalf of the current application. This may be considered as
  * an on-boarding call for the app's users.
  * Required data:
  *   first_name - the user's first name
  *   last_name - the user's last name
  *   email - the user's valid e-mail address
  *   phone_number - the user's valid phone number.
  *     OPTIONAL:
  *   ip - the user's IP address
  * */
  api.prototype.createAccount = function AccountCreate(data) {
    var ENDPOINT = 'account/create';
    return bluebird.promise(function(resolve, reject) {
      if(typeof data !== 'object' || !data) {
        return reject(ApiError('INVALID_DATA', 'Invalid account data.'));
      }

      if(typeof data.first_name !== 'string') return reject(ApiError('INVALID_DATA', 'Missing account first name'));
      if(typeof data.last_name !== 'string') return reject(ApiError('INVALID_DATA', 'Missing account last name'));
      if(typeof data.email !== 'string' || data.email.indexOf('@') === -1) return reject(ApiError('INVALID_DATA', 'Missing account e-mail address.'));
      if(typeof data.phone_number === 'undefined') return reject(ApiError('INVALID_DATA', 'Missing account phone number.'));
      // Once we have all that sorted out, we do the post request.
      var tObj = new Transport(auth);
      tObj.timeout(DEFAULT_TIMEOUT);
      tObj.endpoint(ENDPOINT).post(data).then(function(resultData) {
        resolve(resultData.data);
      }).error(reject);
    });
  };

  /*
  * Returns the verification status of the given UNLOQ account id
  * For this to work, the account ID must be from a previously created (by the service) UNLOQ account
  * */
  api.prototype.accountStatus = function GetAccountStatus(userId) {
    var ENDPOINT = 'account/status/';
    return bluebird.promise(function(resolve, reject) {
      if(typeof userId !== 'string' && typeof userId !== 'number') {
        return reject(ApiError('ID_REQUIRED', 'Invalid UNLOQ user id.'));
      }
      ENDPOINT += userId;
      var tObj = new Transport(auth);
      tObj.timeout(DEFAULT_TIMEOUT);
      tObj.endpoint(ENDPOINT).get().then(function(result) {
        resolve(result.data);
      }).error(reject);
    });
  };

  /*
  * Once an application will create an UNLOQ user account, it may call this endpoint to re-send verification information
   * to the given e-mail address. This will only work for accounts created by the application in the first place.
   * Required data:
    *   email - the account email address.
  * */
  api.prototype.resendAccountVerification = function ResendAccountVerification(userId) {
    var ENDPOINT = 'account/resend';
    return bluebird.promise(function(resolve, reject) {
      if(typeof userId !== 'string' && typeof userId !== 'number') {
        return reject(ApiError('ID_REQUIRED', 'Invalid UNLOQ user id.'));
      }
      var tObj = new Transport(auth);
      tObj.timeout(DEFAULT_TIMEOUT);
      tObj.endpoint(ENDPOINT).post({
        id: userId
      }).then(function(result) {
        resolve(result.message);
      }).error(reject);
    });
  };

  /*
  * This API endpoint will perform a Unloq AUTHENTICATION against the given email/{phone}. It will usually take a few seconds
  * for the promise to fulfil, as it simulates the in-browser login.
  * EVENTS:
  *   pending - when the notification reached the user
  *
  * ERRORS:
  *   USER_NOT_FOUND
  *   USER_DENIED - the user rejected the login
  *   USER_TIMEOUT - the user did not approve nor deny in the given timeframe
  *   DEVICE_UNREACHABLE - we failed to reach the user's device in the given timeframe.
  *   ABORTED - when the connection closes unexpectedly.
  *
  * NOTE:
  *     denied, timeout, unreachable will reject the promise.
  * NOTE2:
  *   The promise will resolve with the accessToken as its first argument.
  * */
  api.prototype.authenticate = function AuthenticateUser(credentials, _scope) {
    var ENDPOINT = 'authenticate?events=true';
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
      if(typeof credentials.phone_number === 'string' && credentials.phone_number !== '') {
        hasCredentials = true;
        payload['phone_number'] = credentials.phone_number;
      }
      if(typeof credentials.digits === 'string' || typeof credentials.digits === 'number') {
        payload['digits'] = credentials.digits;
      }
      if(typeof _scope === 'string' && _scope !== '') {
        payload['scope'] = _scope;
      } else if(_scope instanceof Array) {
        payload['scope'] = _scope.join(',');
      }
      if(!hasCredentials) {
        var e = new Error('At least one primary credential is required (email or phone_number)');
        e.code = 'INVALID_DATA';
        return reject(e);
      }
      var tObj = new Transport(auth, true)
      tObj.timeout(false);
      var transportPromise = tObj.endpoint(ENDPOINT).post(payload);
      this.cancel = function CancelRequest() {
        transportPromise.cancelRequest();
      };
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
          var msg = 'The user denied the login';
          if(d.data && d.data.security_field) {
            msg += '. Please provide ' + d.data.security_field + ' on next try.';
          }
          var e = new Error(msg);
          e.code = 'USER_DENIED';
          if(d.data && d.data.security_field) {
            e.security_field = d.data.security_field;
          }
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

  return api;
});