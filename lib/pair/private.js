var forge = require('node-forge'),
  btoa = require('btoa'),
  atob = require('atob'),
  pki = forge.pki;
/*
* This is a private key wrapper over node-forge.privateKey that knows
* how to handle encoding, creation and other such things.
* */
var private = function PairPrivateKey(keyData) {
  this.__key = (typeof keyData === 'object' ? keyData : null);
  this.__encoded = (typeof keyData === 'string' ? keyData : null);
};

/*
 * Stringifies the key data and base64 encodes it for storage.
 * */
private.prototype.toString = private.prototype.toJSON = function Encode() {
  if(!this.__encoded) {
    try {
      var a = pki.privateKeyToAsn1(this.__key);
      var b = forge.asn1.toDer(a);
      this.__encoded = btoa(b.data);
    } catch(e) {
      return null;
    }
  }
  return this.__encoded;
};

/*
* Decodes a given base64 previously encoded key.
* */
private.prototype.decode = function DecodeKey() {
  if(this.__key !== null) return true;
  try {
    // We first decode the base64 der content.
    var a = atob(this.__encoded);
    var asn = forge.asn1.fromDer(forge.util.createBuffer(a));
    this.__key = pki.privateKeyFromAsn1(asn);
    return true;
  } catch(e) {
    return false;
  }
};

/*
* This will try and decrypt a given chunk 100length encrypted base64 data.
* */
function decryptChunk(data) {
  try {
    var decodedData = atob(data);
    var decryptedChunk = this.__key.decrypt(decodedData, 'RSAES-PKCS1-V1_5');
    return decryptedChunk;
  } catch(e) {
    return e;
  }
}

/*
* Decrypts the given public-key encrypted string.
* */
private.prototype.decrypt = function Decrypt(data) {
  if(typeof data !== 'string' || data === '') return null;
  if(!this.decode()) return null;
  // First thing we do is we split the base64 encryptions into smaller chunks separated by hashtag
  var chunks = data.split('#'),
    fullDecryption = '',
    isError = false;
  for(var i= 0, len = chunks.length; i < len; i++) {
    var encodedChunk = chunks[i],
      decryptedChunk = decryptChunk.call(this, encodedChunk);
    if(decryptedChunk instanceof Error) {
      log.warn('Service.pair.private: Failed to decrypt data');
      log.debug(decryptedChunk);
      isError = true;
      break;
    }
    fullDecryption += decryptedChunk;
  }
  if(isError) return null;
  try {
    var data = JSON.parse(fullDecryption);
    return data;
  } catch(e) {
    log.warn('Pair.private: failed to parse decrypted data.');
    log.debug(e);
    log.debug(fullDecryption);
    return null;
  }
};

module.exports = private;