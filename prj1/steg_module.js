#!/usr/bin/env nodejs

'use strict';

const Ppm = require('./ppm');

/** prefix which always precedes actual message when message is hidden
 *  in an image.
 */
const STEG_MAGIC = 'stg';
const STEG_MAGIC_LEN = STEG_MAGIC.length;

/** # of bits in a byte */
const CHAR_BIT = 8;


/** Constructor which takes some kind of ID and a Ppm image */
function StegModule(id, ppm) {
  this.id = id;
  this.ppm = ppm;
}

/** Hide message msg using PPM image contained in this StegModule object
 *  and return an object containing the new PPM image.
 *
 *  Specifically, this function will always return an object.  If an
 *  error occurs, then the "error" property of the return'd object
 *  will be set to a suitable error message.  If everything ok, then
 *  the "ppm" property of return'd object will be set to a Ppm image
 *  ppmOut which is derived from this.ppm with msg hidden.
 *
 *  The ppmOut image will be formed from the image contained in this
 *  StegModule object and msg as follows.
 *
 *    1.  The meta-info (header, comments, resolution, color-depth)
 *        for ppmOut is set to that of the PPM image contained in this
 *        StegModule object.
 *
 *    2.  A magicMsg is formed as the concatenation of STEG_MAGIC,
 *        msg and the NUL-character '\0'.
 *
 *    3.  The bits of the character codes of magicMsg including the
 *        terminating NUL-character are unpacked (MSB-first) into the
 *        LSB of successive pixel bytes of the ppmOut image.  Note
 *        that the pixel bytes of ppmOut should be identical to those
 *        of the image in this StegModule object except that the LSB of each
 *        pixel byte will contain the bits of magicMsg.
 *
 *  The function should detect the following errors:
 *
 *    STEG_TOO_BIG:   The provided pixelBytes array is not large enough 
 *                    to allow hiding magicMsg.
 *    STEG_MSG:       The image contained in this StegModule object may already
 *                    contain a hidden message; detected by seeing
 *                    this StegModule object's underlying image pixel bytes
 *                    starting with a hidden STEG_MAGIC string.
 *
 * Each error message must start with the above IDs (STEG_TOO_BIG, etc).
 */
StegModule.prototype.hide = function(msg) {
  if (this.checkMagic()) {
    return {
      error: `STEG_MSG: ${this.id}: image already contains a hidden message`
    };
  }
  else if ((STEG_MAGIC_LEN + msg.length + 1) >
	   this.ppm.pixelBytes.length/CHAR_BIT) {
    return {
      error: `STEG_TOO_BIG: ${this.id}: message too big to be hidden in image`
    };
  }
  const ppmOut = new Ppm(this.ppm);
  const bytes = ppmOut.pixelBytes;
  let byteIndex = 0;
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
  return { ppm: ppmOut };
}

/** Return message hidden in this StegModule object.  Specifically, if
 *  an error occurs, then return an object with "error" property set
 *  to a string describing the error.  If everything is ok, then the
 *  return'd object should have a "msg" property set to the hidden
 *  message.  Note that the return'd message should not contain
 *  STEG_MAGIC or the terminating NUL '\0' character.
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
 * Each error message must start with the above IDs (STEG_NO_MSG, etc).
 */
StegModule.prototype.unhide = function() {
  if (!this.checkMagic()) {
    return { error: `STEG_NO_MSG: ${this.id}: image does not have a message` };
  }
  else {
    const msg = this.unhideLo(STEG_MAGIC_LEN);
    if (msg === undefined) {
      return { error: `STEG_BAD_MSG: ${this.id}: bad message` };
    }
    else {
      return { msg: msg };
    }
  }
}

StegModule.prototype.checkMagic = function() {
  const magic = this.unhideLo(0, STEG_MAGIC_LEN);
  return magic === STEG_MAGIC;
}

StegModule.prototype.unhideLo = function(msgCharOffset, msgLen = -1) {
  const bytes = this.ppm.pixelBytes;
  const maxOffset = Math.floor(bytes.length/8)*8;
  let i = msgCharOffset * CHAR_BIT;
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

module.exports = StegModule;
