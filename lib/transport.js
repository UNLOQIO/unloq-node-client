var bluebird = require('bluebird');
/*
* This is the transport layer. We use this class to perform the requests.
* Currently, we are using request module to do this.
* */

var transport = function MyShieldTransport(auth) {
  this.auth = auth;
  this.method = 'POST';
  // We create our base URL from the auth object.
  this.url = auth.gateway + '/' + auth.version;
  return this;
};

/*
* Sets the path we want to point it to.
* */
transport.prototype.endpoint = function SetEndpoint(point) {
  if(point.charAt(0) !== '/') point = '/' + point;
  this.url += point;
  return this;
};

/*
* Performs the call by calling the endpoint with the previously set method.
* Default method is POST
* This will return a bluebird promise.
* */
transport.prototype.run = function DoRun() {
  return bluebird.promise(function(resolve, reject) {
    console.log("RUN")
  }.bind(this));

};

/*
* Wrapper methods over our HTTP methods.
* */
transport.prototype.post = function DoPost() {
  this.method = "POST";
  return this.run();
};
transport.prototype.get = function DoGet() {
  this.method = 'GET';
  return this.run();
};
transport.prototype.put = function DoPut() {
  this.method = 'PUT';
  return this.run();
};
transport.prototype['delete'] = function DoDelete() {
  this.method = 'DELETE';
  return this.run();
};

module.exports = transport;