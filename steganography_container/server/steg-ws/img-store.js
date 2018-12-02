'use strict';

const Ppm = require('./ppm');

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {promisify} = require('util');
const exec = promisify(require('child_process').exec);
const mongo = require('mongodb').MongoClient;


/****** Error Handling
 * When an error is detected, an ImgError object is thrown (which will
 * reject any return'd promise).  This object has the following
 * properties:
 * 
 *  code:     A string giving a code for the error.
 *  message:  A detailed description of the message.
 *  isDomain: This field is always true.
 */

/** This module provides an interface for storing, retrieving and
 *  querying images from a database. An image is uniquely identified
 *  by two non-empty strings:
 *
 *    Group: a string which does not contain any NUL ('\0') 
 *           characters.
 *    Name:  a string which does not contain any '/' or NUL
 *           characters.
 *
 *  Note that the image identification does not include the type of
 *  image.  So two images with different types are regarded as
 *  identical iff they have the same group and name.
 *  
 *  Error Handling: If a function detects an error with a defined
 *  error code, then it must return a rejected promise rejected with
 *  an object containing the following two properties:
 *
 *    errorCode: the error code
 *    message:   an error message which gives details about the error.
 *
 *  If a function detects an error without a defined error code, then
 *  it may reject with an object as above (using a distinct error
 *  code), or it may reject with a JavaScript Error object as
 *  appropriate.
 */

function ImgStore(client, db) {
  this.client = client;
  this.db = db;
  this.nextId = 0;
}

ImgStore.prototype.close = close;
ImgStore.prototype.get = get;
ImgStore.prototype.list = list;
ImgStore.prototype.meta = meta;
ImgStore.prototype.put = put;
ImgStore.prototype.putWithAutoName = putWithAutoName;
ImgStore.prototype.putBytes = putBytes;

async function newImgStore(doClear=true) {
  const client = await mongo.connect(MONGO_URL);
  const db = client.db(DB_NAME);
  const imgStore = new ImgStore(client, db);
  if (doClear) await imgStore.clear();
  return imgStore;
}
module.exports = newImgStore;

/** URL for database images on mongodb server running on default port
 *  on localhost
 */
const MONGO_URL = 'mongodb://mymongodb:27017';
const DB_NAME = 'images';

const BYTES_TABLE = 'bytes', META_TABLE = 'metaInfos';

//List of permitted image types.
const IMG_TYPES = [
  'ppm', //must be first
  'png'
];


/** Release all resources held by this image store.  Specifically,
 *  close any database connections.
 */
async function close() {
  this.client.close();
}

/** Retrieve image specified by group and name.  Specifically, return
 *  a promise which resolves to a Uint8Array containing the bytes of
 *  the image formatted for image format type.
 *
 *  Defined Error Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_NAME:    name is invalid (contains a '/' or NUL-character).
 *    BAD_TYPE:    type is not one of the supported image types.
 *    NOT_FOUND:   there is no stored image for name under group.
 */
async function get(group, name, type) {
  const err = isBadGroup(group) || isBadName(name) || isBadType(type);
  if (err) throw err;
  const imgId = toImgId(group, name, type);
  const ret = await this.db.collection(BYTES_TABLE).find({_id: imgId});
  const result = await ret.toArray();
  if (result.length === 0) {
    throw new ImgError('NOT_FOUND',
		       `no ${type} image named ${name} in group ${group}`);
  }
  assert(result.length === 1);
  return new Uint8Array(new Buffer(result[0].base64, 'base64'));
}

/** Return promise which resolves to an array containing the names of
 *  all images stored under group.  The resolved value should be an
 *  empty array if there are no images stored under group.
 *
 *  The implementation of this function must not read the actual image
 *  bytes from the database.
 *
 *  Defined Errors Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 */
async function list(group) {
  const err = isBadGroup(group);
  if (err) throw err;
  const ret = await this.db.collection(META_TABLE).find({group: group});
  return (await ret.toArray()).map((meta) => meta.name);
}

/** Return promise which resolves to an object containing
 *  meta-information for the image specified by group and name.
 *
 *  The return'd object must contain the following properties:
 *
 *    width:         a number giving the width of the image in pixels.
 *    height:        a number giving the height of the image in pixels.
 *    maxNColors:    a number giving the max # of colors per pixel.
 *    nHeaderBytes:  a number giving the number of bytes in the 
 *                   image header.
 *    creationTime:  the time the image was stored.  This must be
 *                   a number giving the number of milliseconds which 
 *                   have expired since 1970-01-01T00:00:00Z.
 *
 *  The implementation of this function must not read the actual image
 *  bytes from the database.
 *
 *  Defined Errors Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_NAME:    name is invalid (contains a '/' or NUL-character).
 *    NOT_FOUND:   there is no stored image for name under group.
 */
async function meta(group, name) {
  const err = isBadGroup(group) || isBadName(name);
  if (err) throw err;
  const imgId = toImgId(group, name);
  const ret = await this.db.collection(META_TABLE).find({_id: imgId});
  const result = await ret.toArray();
  if (result.length === 0) {
    throw new ImgError('NOT_FOUND', `no image named ${name} in group ${group}`);
  }
  assert(result.length === 1);
  const meta = result[0];
  return ['creationTime', 'width', 'height', 'maxNColors', 'nHeaderBytes']
    .reduce((acc, e) => { acc[e] = meta[e]; return acc; }, {});    
}

/** Store the image specified by imgPath in the database under the
 *  specified group with name specified by the base-name of imgPath
 *  (without the extension).  The return'd promise resolves to
 *  the name derived for the image.
 *
 *  Defined Error Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_FORMAT:  the contents of the file specified by imgPath does 
 *                 not satisfy the image format implied by its extension. 
 *    BAD_TYPE:    the extension for imgPath is not a supported type
 *    EXISTS:      the database already contains an image under group
 *                 with name specified by the base-name of imgPath
 *                 (without the extension). 
 *    NOT_FOUND:   the path imgPath does not exist.
 * 
 */
async function put(group, imgPath) {
  const err = isBadGroup(group) || isBadExt(imgPath) || isBadPath(imgPath);
  if (err) throw err;
  const [name, ext] = pathToNameExt(imgPath);
  const bytes = await readFile(imgPath);
  return await this.putBytes(group, bytes, ext, name);
}

/** Store the image specified by imgPath in the database under the
 *  specified group with an auto-generated name. The return'd promise
 *  resolves to the auto-generated name.
 *
 *  Defined Error Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_FORMAT:  the contents of the file specified by imgPath does 
 *                 not satisfy the image format implied by its extension. 
 *    BAD_TYPE:    the extension for imgPath is not a supported type
 *    NOT_FOUND:   the path imgPath does not exist.
 * 
 */
async function putWithAutoName(group, imgPath) {
  const err = isBadGroup(group) || isBadExt(imgPath) || isBadPath(imgPath);
  if (err) throw err;
  const [name, ext] = pathToNameExt(imgPath);
  const bytes = await readFile(imgPath);
  return await this.putBytes(group, bytes, ext);
}

/** Store the image specified by Uint8Array bytes in the database
 *  under the specified group.  The type of the image is determined by
 *  the type argument which must be either ppm or png.  The return'd
 *  promise resolves to the name (if specified) or a newly created
 *  unique name for this image.
 *
 *  Defined Error Codes:
 *
 *    BAD_GROUP:   group is invalid (contains a NUL-character).
 *    BAD_FORMAT:  the content of bytes is not in the format 
 *                 implied by type.
 *    BAD_TYPE:    the type argument is not "png" or "ppm"
 * 
 */
async function putBytes(group, bytes, type, name=undefined) {
  const err = isBadGroup(group) || isBadType(type);
  if (err) throw err;
  if (typeof name === 'undefined') name = (this.nextId++).toString();
  for (const type1 of IMG_TYPES) {
    const cvtBytes =
      (type1 === type) ? bytes : await convert(bytes, name, type, type1);
    try {
      await this.storeBytes(group, name, type1, cvtBytes);
    }
    catch (err) {
      if (isDuplicateError(err)) {
	const msg = `group '${group}' already has an image named '${name}'`;
	throw new ImgError('EXISTS', msg);
      }
      else {
	throw err;
      }
    }
  }
  return name;
}

ImgStore.prototype.clear = clear;

async function clear() {
  await this.db.collection(BYTES_TABLE).deleteMany({});
  await this.db.collection(META_TABLE).deleteMany({});
}

async function convert(bytes, id, srcType, destType) {
  const srcPath = `${os.tmpdir()}/${id}.${srcType}`;
  const destPath = `${os.tmpdir()}/${id}.${destType}`;
  await writeFile(bytes, srcPath);
  await doConvert(srcPath, destPath);
  const cvtBytes = await readFile(destPath);
  await unlink([srcPath, destPath]);
  return cvtBytes;
}

async function writeFile(bytes, path) {
  try {
    await promisify(fs.writeFile)(path, bytes);
  }
  catch (err) {
    throw new ImgError('WRITE_ERROR', `cannot write ${path}: ${err}`);
  }
}

async function readFile(path) {
  try {
    const buffer = await promisify(fs.readFile)(path);
    return new Uint8Array(buffer);
  }
  catch (err) {
    throw new ImgError('READ_ERROR', `cannot read ${path}: ${err}`);
  }
}

async function unlink(paths) {
  for (const path of paths) {
    try {
      promisify(fs.unlink)(path);
    }
    catch (err) {
      throw new ImgError('UNLINK_ERROR', `cannot unlink ${path}: ${err}`);
    }
  }
}

async function doConvert(srcPath, destPath) {
  try {
    const cmd = `convert ${srcPath} ${destPath} 2>/dev/null`;
    await exec(cmd);
  }
  catch (err) {
    throw new ImgError('BAD_FORMAT',
		       `cannot convert ${srcPath}: ${err.message.trim()}`);
  }
}

function isDuplicateError(err) {
  const msg = err.message;
  return (msg.indexOf('duplicate') >= 0 && msg.indexOf('11000') >= 0);
}

ImgStore.prototype.storeBytes = storeBytes;

async function storeBytes(group, name, type, bytes) {
  const imgId = toImgId(group, name);
  if (type === 'ppm') {
    const ppm = new Ppm(imgId, bytes);
    if (ppm.errorCode && ppm.message) throw ppm;
    const info = ['width', 'height', 'maxNColors', 'nHeaderBytes']
      .reduce(function (acc, k) {
    	acc[k] = ppm[k];
    	return acc;
      }, { _id: imgId, creationTime: Date.now(), group: group, name: name });
    const metaInfos = this.db.collection(META_TABLE);
    const metaRet = await metaInfos.insertOne(info);
    assert(metaRet.insertedId === imgId);	  
  }
  const img = {
    _id: toImgId(group, name, type),
    base64: Buffer.from(bytes).toString('base64')
  };
  const bytesTable = this.db.collection(BYTES_TABLE);
  const bytesRet = await bytesTable.insertOne(img);
  assert(bytesRet.insertedId === img._id);
  return;
}



//Utility functions

const NAME_DELIM = '/', TYPE_DELIM = '.';

/** Form id for image from group, name and optional type. */
function toImgId(group, name, type) {
  let v = `${group}${NAME_DELIM}${name}`;
  if (type) v += `${TYPE_DELIM}${type}`
  return v;
}

/** Given imgId of the form group/name return [group, name]. */
function fromImgId(imgId) {
  const nameIndex = imgId.lastIndexOf(NAME_DELIM);
  assert(nameIndex > 0);
  return [imgId.substr(0, nameIndex), imgId.substr(nameIndex + 1)];
}

/** Given a image path imgPath, return [ name, ext ]. */
function pathToNameExt(imgPath) {
  const typeDelimIndex = imgPath.lastIndexOf(TYPE_DELIM);
  const ext = imgPath.substr(typeDelimIndex + 1);
  const name = path.basename(imgPath.substr(0, typeDelimIndex));
  return [name, ext];
}

//Error utility functions

function isBadGroup(group) {
  return (group.trim().length === 0 || group.indexOf('\0') >= 0) &&
    new ImgError('BAD_GROUP', `bad image group ${group}`);
}

function isBadName(name) {
  return (name.trim().length === 0 ||
	  name.indexOf('\0') >= 0 || name.indexOf('/') >= 0) &&
    new ImgError('BAD_NAME', `bad image name '${name}'`);
}

function isBadPath(path) {
  return !fs.existsSync(path) &&
    new ImgError('NOT_FOUND', `file ${path} not found`);
}

function isBadExt(imgPath) {
  const lastDotIndex = imgPath.lastIndexOf('.');
  const type = (lastDotIndex < 0) ? '' : imgPath.substr(lastDotIndex + 1);
  return IMG_TYPES.indexOf(type) < 0 &&
    new ImgError('BAD_TYPE', `bad image type '${type}' in path ${imgPath}`);
}

function isBadType(type) {
  return IMG_TYPES.indexOf(type) < 0 &&
    new ImgError('BAD_TYPE', `bad image type '${type}'`);
}

/** Build an image error object using errorCode code and error 
 *  message msg. 
 */
function ImgError(code, msg) {
  this.errorCode = code;
  this.message = msg;
  this.isDomain = true;
}
