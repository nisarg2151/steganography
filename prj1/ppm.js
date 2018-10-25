#!/usr/bin/env nodejs

'use strict';

const TextDecoder = require('util').TextDecoder;
const assert = require('assert');

/** If this constructor is called with an existing Ppm object, then it
 *  returns a deep copy of the object.  If it is called with a
 *  Uint8Array bytes[] then PPM meta and data information is extracted
 *  into the constructed object.
 *
 *  It is assumed that bytes[] contains all the bytes of a P6 PPM
 *  image, including meta-information.  Specifically, bytes[] should
 *  be in the following format:
 *
 *     1.  A 2-byte "magic number", specifying the format.  Only legal values
 *         for this project are "P6" (in ASCII).
 *     2.  One of more whitespace characters as defined by the isspace()
 *         function from <ctype.h>
 *     3.  A positive ASCII integer giving the width X of the image in pixels.
 *     4.  Whitespace as above.
 *     5.  A positive ASCII integer giving the height Y of the image in pixels.
 *     6.  Whitespace as above.
 *     7.  A positive ASCII integer giving the maximum color value of each
 *         pixel.  For this project, this value should always be 255.
 *     8.  A single whitespace character.
 *     9.  The data for the pixels in the image.  Since each pixel is
 *         represented by 3 RGB color values, the pixel data must have
 *         exactly 3*X*Y bytes.
 * 
 * The return'd object contains the following fields:
 * 
 *    width:       The width of the image.
 *    height:      The height of the image.
 *    maxColors:   The max # of colors in the image.
 *    hdrBytes:    A Uint8Array giving the bytes constituting the
 *                 header of the image.
 *    pixelBytes:  A Uint8Array giving the bytes constituting the
 *                 pixel data of the image.
 */
function Ppm(arg) {
  assert.equal(arguments.length, 1);
  if (typeof arg === 'object' && arg.constructor === Ppm) {
    const ppm = arg;
    Object.assign(this, ppm);
    this.hdrBytes = this.hdrBytes.slice();
    this.pixelBytes = this.pixelBytes.slice();
  }
  else {
    const bytes = arg;
    assert.equal(typeof bytes, 'object');
    assert.equal(bytes.constructor, Uint8Array);
    const format = ppmFormat(bytes);
    if (!format) {
      return { error: 'bad image format' }
    }
    else {
      Object.assign(this, format); delete this.pixelsIndex;
      this.hdrBytes = bytes.slice(0, format.pixelsIndex);
      this.pixelBytes = bytes.slice(format.pixelsIndex);
    }
  }
}

/** Return a Uint8Array containing all the bytes for this image. */
Ppm.prototype.bytes = function() {
  const bytes = new Uint8Array(this.hdrBytes.length + this.pixelBytes.length);
  bytes.set(this.hdrBytes);
  bytes.set(this.pixelBytes, this.hdrBytes.length);
  return bytes;
}

Ppm.prototype.toString = function() {
  return `ppm: ${this.width}x${this.height}`
}

const PPM_FORMAT = 'P6';

/** If bytes constitute a valid PPM image, then return an object
 *  giving its width, height, maxColors image parameters.  Additionally,
 *  it will also contain a pixelsIndex property giving the start of
 *  the image pixel data in bytes.  
 *
 *  If bytes does not constitute a valid PPM image, return undefined.
 */
function ppmFormat(bytes) {
  const bufIndex = new BufIndex(bytes);
  const c0 = bufIndex.nextChar(), c1 = bufIndex.nextChar();
  if (c0 !== PPM_FORMAT[0] && c1 !== PPM_FORMAT[1]) return undefined;
  const width = bufIndex.nextInt();
  const height = bufIndex.nextInt();
  const maxColors = bufIndex.nextInt();
  const pixelsIndex = bufIndex.index + 1;
  if (width > 0 && height > 0 && maxColors === 255 &&
      bytes.length === pixelsIndex + width*height*3) {
    return {
      width: width,
      height: height,
      maxColors: maxColors,
      pixelsIndex: pixelsIndex
    };
  }
  else {
    return undefined;
  }
}

/** An object which tracks a byte buffer and index. */
function BufIndex(buf, index=0) {
  this.buf = buf;
  this.index = index;
}

/** Return the next character from buffer; update index. 
 *  Return undefined on error.
 */
BufIndex.prototype.nextChar = function() {
  const buf = this.buf, i = this.index;
  return i < buf.length ? String.fromCharCode(buf[this.index++]) : undefined;
}

/** Return the next non-negative integer read from buffer at the
 *  current index, updating index. Ignore whitespace before the
 *  integer digits.  Return undefined on error.
 */
BufIndex.prototype.nextInt = function() {
  const nextIndex = advanceOverNextInt(this.buf, this.index);
  if (nextIndex > 0) {
    const str = new TextDecoder().decode(this.buf.slice(this.index, nextIndex));
    this.index = nextIndex;
    return Number(str);
  }
  else {
    return undefined;
  }
}
  

/** Starting at buf[index] advance index over a sequence of whitespace
 *  followed by a sequence of digits.  Return index just past the digits.
 *  Return -1 if sequence of digits is not found.
 */
function advanceOverNextInt(buf, index) {
  while (index < buf.length && isspace(buf[index])) index++;
  if (index >= buf.length || !isdigit(buf[index])) return -1;
  while (index < buf.length && isdigit(buf[index])) index++;
  return index;
}

/** An object which maps whitespace character codes to 'space',
 *  digit character codes to 'digit', all others to undefined.
 */
const CTYPES = new function() {
  for (const c of ' \t\n\r') { this[c.charCodeAt()] = 'space'; }
  for (const c of '0123456789') { this[c.charCodeAt()] = 'digit'; }
}

function isspace(byte) {
  return CTYPES[byte] === 'space';
}

function isdigit(byte) {
  return CTYPES[byte] === 'digit';
}


module.exports = Ppm;
