var forge = require('node-forge'),
  btoa = require('btoa'),
  atob = require('atob'),
  pki = forge.pki;
/*
* This is a public key wrapper over node-forge.publicKey that knows
* how to handle encoding, creation and other such things.
* */
var public = function PairPublicKey(keyData) {
  this.__key = (typeof keyData === 'object' ? keyData : null);
  this.__encoded = (typeof keyData === 'string' ? keyData : null);
};


/*
 * Stringifies the key data and base64 encodes it for storage.
 * */
public.prototype.toString = public.prototype.toJSON = function Encode() {
  if(!this.__encoded) {
    try {
      var a = pki.publicKeyToAsn1(this.__key);
      var b = forge.asn1.toDer(a);
      this.__encoded = btoa(b.data);
    } catch(e) {
      return null;
    }
  }
  return this.__encoded;
};

public.prototype.decode = function Decode() {
  if(this.__key !== null) return true;
  try {
    // We first decode the base64 der content.
    var a = atob(this.__encoded);
    var asn = forge.asn1.fromDer(forge.util.createBuffer(a));
    this.__key = pki.publicKeyFromAsn1(asn);
    return true;
  } catch(e) {
    return false;
  }
};


/*
* Private function that will encrypt the given 100char chunk of data.
* Returns the encrypted string as a base64 encoding or an error object.
* */
function encryptChunk(data) {
  try {
    var encryptedBytes = this.__key.encrypt(data, 'RSAES-PKCS1-V1_5');
    var encryptedBase64 = btoa(encryptedBytes);
    return encryptedBase64;
  } catch(e) {
    return e;
  }
}

/*
 * The function will encrypt the given data with the public key,
 * We will encrypt the json stringified data into chunks of 100chars, separated
 * by a hashtag char (#)
 * */
public.prototype.encrypt = function EncryptData(data) {
  if(!this.decode()) return null;
  try {
    var stringData = JSON.stringify(data);
  } catch(e) {
    log.warn('Public.decrypt: failed to stringify data.');
    log.debug(data);
    return null;
  }
  var i = 0,
    chunkSize = 100,
    fullEncryption = '';
  while(i < stringData.length) {
    var chunk = stringData.substr(i, chunkSize);
    i += chunkSize;
    var encData = encryptChunk.call(this, chunk);
    if(encData instanceof Error) return null;
    fullEncryption += encData;
    if(i < stringData.length) {
      fullEncryption += '#';
    }
  }
  return fullEncryption;
};

module.exports = public;