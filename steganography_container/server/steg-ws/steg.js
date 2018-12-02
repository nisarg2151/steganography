'use strict';

const Ppm = require('./ppm');

/** prefix which always precedes actual message when message is hidden
 *  in an image.
 */
const STEG_MAGIC = 'stg';
const STEG_MAGIC_LEN = STEG_MAGIC.length;

/** # of bits in a byte */
const CHAR_BIT = 8;


/** Constructor which takes a Ppm image */
function Steg(ppm) {
  this.ppm = ppm;
}

module.exports = Steg;

/****** Error Handling
 * When an error is detected, a StegError object is thrown.  This
 * object has the following properties:
 * 
 *  code:     A string giving a code for the error.
 *  message:  A detailed description of the message.
 *  isDomain: This field is always true.
 */

/** Hide message msg using PPM image contained in this Steg object
 *  and return a new PPM image containing the hidden message.
 *
 *  The output image ppmOut will be formed from the image contained in
 *  this Steg object and msg as follows.
 *
 *    1.  The meta-info (header, comments, resolution, color-depth)
 *        for ppmOut is set to that of the PPM image contained in this
 *        Steg object.
 *
 *    2.  A magicMsg is formed as the concatenation of STEG_MAGIC,
 *        msg and the NUL-character '\0'.
 *
 *    3.  The bits of the character codes of magicMsg including the
 *        terminating NUL-character are unpacked (MSB-first) into the
 *        LSB of successive pixel bytes of the ppmOut image.  Note
 *        that the pixel bytes of ppmOut should be identical to those
 *        of the image in this Steg object except that the LSB of each
 *        pixel byte will contain the bits of magicMsg.
 *
 *  The function should detect the following errors:
 *
 *    STEG_TOO_BIG:   The provided image is not large enough 
 *                    to allow hiding magicMsg.
 *    STEG_MSG:       The image contained in this Steg object may already
 *                    contain a hidden message; detected by seeing
 *                    this Steg object's underlying image pixel bytes
 *                    starting with a hidden STEG_MAGIC string.
 *
 */
Steg.prototype.hide = function(msg) {
  if (this.checkMagic()) {
    const msg = `${this.ppm.id}: image already contains a hidden message`;
    throw new StegError('STEG_MSG', msg);
  }
  else if ((STEG_MAGIC_LEN + msg.length + 1) >
	   (this.ppm.bytes.length - this.ppm.nHeaderBytes)/CHAR_BIT) {
    const msg = `${this.ppm.id}: message too big to be hidden in image`;
    throw new StegError('STEG_TOO_BIG', msg);
  }
  const ppmOut = new Ppm(this.ppm.id, this.ppm);
  const bytes = ppmOut.bytes;
  let byteIndex = ppmOut.nHeaderBytes;
  const magicMsg = STEG_MAGIC + msg + '\0';
  for (const c of magicMsg) {
    const charCode = c.charCodeAt();
    let mask = 1 << (CHAR_BIT - 1);
    while (mask != 0) {
      if ((charCode & mask) === 0) {
	bytes[byteIndex] = bytes[byteIndex] & ~1;
      }
      else {
	bytes[byteIndex] = bytes[byteIndex] | 1;
      }
      byteIndex++;
      mask >>= 1;
    }
  }
  return ppmOut;
}

/** Return message hidden in this Steg object.  
 *
 *  The function will detect the following errors:
 *
 *    STEG_NO_MSG:    The image contained in this Steg object does not
 *                    contain a hidden message; detected by not
 *                    seeing this Steg object's underlying image pixel
 *                    bytes starting with a hidden STEG_MAGIC
 *                    string.
 *    STEG_BAD_MSG:   A bad message was decoded (the NUL-terminator
 *                    was not found).
 *
 */
Steg.prototype.unhide = function() {
  if (!this.checkMagic()) {
    const errMsg = `${this.ppm.id}: image does not have a message`;
    throw new StegError('STEG_NO_MSG', errMsg);
  }
  else {
    const msg = this.unhideLo(STEG_MAGIC_LEN);
    if (msg === undefined) {
      const errMsg = `${this.ppm.id}: bad message`;
      throw new StegError('STEG_BAD_MSG', errMsg);
    }
    else {
      return msg;
    }
  }
}

Steg.prototype.checkMagic = function() {
  const magic = this.unhideLo(0, STEG_MAGIC_LEN);
  return magic === STEG_MAGIC;
}

Steg.prototype.unhideLo = function(msgCharOffset, msgLen = -1) {
  const nHeaderBytes = this.ppm.nHeaderBytes;
  const bytes = this.ppm.bytes;
  const maxOffset =
    nHeaderBytes + Math.floor((bytes.length - nHeaderBytes)/8)*8;
  let i = nHeaderBytes + msgCharOffset * CHAR_BIT;
  let msg = '';
  let charCode, mask;
  while (i < maxOffset) {
    mask = 1 << (CHAR_BIT - 1);
    charCode = 0;
    while (mask !== 0 && i < maxOffset) {
      if ((bytes[i++] & 1) != 0) charCode = charCode | mask;
      mask >>= 1;
    }
    if (charCode === 0) break;
    msg += String.fromCharCode(charCode);
    if (msgLen > 0 && msg.length >= msgLen) break;
  }
  if (msgLen < 0 && (mask !== 0 || charCode !== 0)) return undefined;
  return msg;
}

function StegError(code, message) {
  this.code = code;
  this.message = message;
  this.isDomain = true;
}
