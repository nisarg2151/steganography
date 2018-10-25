'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');

const Steg = require('./steg_module');
const Ppm = require('./ppm');

const COURSE = 'cs580w';
const OUT = `/${os.tmpdir()}/${process.pid}.ppm`;

const IMG_DIR = `${process.env.HOME}/${COURSE}/projects/prj1/aux/in`;

function randMsg(len) {
  const min = 32, max = 127; //min inclusive, max exclusive
  const randCode = () => Math.floor(Math.random() * (max - min)) + min;
  return String.fromCharCode(...new Array(len).fill('').map(()=>randCode()));
}

function makePpm(imgPath) {
  return new Ppm(new Uint8Array(fs.readFileSync(imgPath)));
}

function makeTestInfo(imgId) {
  const ppm = makePpm(`${IMG_DIR}/${imgId}`);
  return {
    id: imgId,
    ppm: ppm,
    maxMsgLen: Math.floor(ppm.width*ppm.height*3/8) - MAGIC_LEN - 1,
    toString: function() {
      return `${this.id}: ${this.ppm.toString()}, max=${this.maxMsgLen}`;
    }
  };
}

const VERBOSE = false;
const MAGIC_LEN = 3;


describe("steg", function() {

  let testInfo;
  
  const IMG = 'logo.ppm';

  beforeEach(function() {
    testInfo = makeTestInfo(IMG);
    if (VERBOSE) console.log(`testing for ${testInfo.toString()}`);
  });

  afterEach(function() { if (fs.existsSync(OUT)) { fs.unlinkSync(OUT); }});

  it(`should hide/unhide a random message in ${IMG}`, function() {
    const steg = new Steg(testInfo.id, testInfo.ppm);
    const msgLen = Math.floor(Math.random()*testInfo.maxMsgLen);
    const msg = randMsg(msgLen);
    const hideResult = steg.hide(msg);
    assert(hideResult.ppm);
    fs.writeFileSync(OUT, hideResult.ppm.bytes());
    const unhideResult = new Steg(OUT, makePpm(OUT)).unhide();
    assert(unhideResult.msg);
    assert.equal(unhideResult.msg, msg);
    if (VERBOSE) console.log(`hide/unhide ok for message length ${msgLen}`);
  });

  it(`should not unhide if there is no message`, function() {
    const steg = new Steg(testInfo.id, testInfo.ppm);
    const unhideResult = steg.unhide();
    assert(unhideResult.error);
    assert(unhideResult.error.startsWith('STEG_NO_MSG'));
  });	    

  it (`should not hide if there is already a message`, function() {
    const steg = new Steg(testInfo.id, testInfo.ppm);
    const msgLen = Math.floor(Math.random()*testInfo.maxMsgLen);
    const msg = randMsg(msgLen);
    const hideResult1 = steg.hide(msg);
    assert(hideResult1.ppm);
    fs.writeFileSync(OUT, hideResult1.ppm.bytes());
    const hideResult2 = new Steg(OUT, makePpm(OUT)).hide();
    assert(hideResult2.error);
    assert(hideResult2.error.startsWith('STEG_MSG'));
  });
  
  it(`should hide/unhide a maximal length message`, function() {
    const steg = new Steg(testInfo.id, testInfo.ppm);
    const msgLen = testInfo.maxMsgLen;
    const msg = randMsg(msgLen);
    const hideResult = steg.hide(msg);
    assert(hideResult.ppm);
    fs.writeFileSync(OUT, hideResult.ppm.bytes());
    const unhideResult = new Steg(OUT, makePpm(OUT)).unhide();
    assert(unhideResult.msg);
    assert.equal(unhideResult.msg, msg);
    if (VERBOSE) console.log(`hide/unhide ok for max message length ${msgLen}`);
  });

  it(`should not hide a message which is 1 char too long`, function() {
    const steg = new Steg(testInfo.id, testInfo.ppm);
    const msgLen = testInfo.maxMsgLen + 1;
    const msg = randMsg(msgLen);
    const hideResult = steg.hide(msg);
    assert(hideResult.error);
    assert(hideResult.error.startsWith('STEG_TOO_BIG'));
    if (VERBOSE) console.log(`hide fail for too big message length ${msgLen}`);
  });

  it(`should not be able to unhide a unterminated message`, function() {
    const steg = new Steg(testInfo.id, testInfo.ppm);
    const msgLen = testInfo.maxMsgLen;
    const msg = randMsg(msgLen);
    const hideResult = steg.hide(msg);
    assert(hideResult.ppm);
    fs.writeFileSync(OUT, hideResult.ppm.bytes());
    const offset = //offset of last byte holding hidden message
      testInfo.ppm.hdrBytes.length + (MAGIC_LEN + msgLen + 1)*8 - 1;
    const fd = fs.openSync(OUT, 'r+');
    //clobber last byte with odd value, guaranteeing no NULL terminator
    fs.writeSync(fd, new Uint8Array([1]), 0, 1, offset); 
    fs.closeSync(fd);
    const unhideResult = new Steg(OUT, makePpm(OUT)).unhide();
    assert(unhideResult.error);
    assert(unhideResult.error.startsWith('STEG_BAD_MSG'));
  });

});

describe("boundary cases", function() {

  let testInfos = [];
  
  const BOUNDARY_CASE_IMGS = [
    "logo.ppm",                           //(width*height*3)%8 == 0
    "pexels-photo-86243.ppm",             //(width*heigth*3)%8 == 2
    "garden-rose-red-pink-56866.ppm",     //(width*heigth*3)%8 == 4
    "dahlia-red-blossom-bloom-60597.ppm"  //(width*heigth*3)%8 == 6
  ];

  beforeEach(function() {
    for (const imgId of BOUNDARY_CASE_IMGS) {
      const testInfo = makeTestInfo(imgId);
      testInfos.push(testInfo);
    }
  });

  afterEach(function() { if (fs.existsSync(OUT)) { fs.unlinkSync(OUT); }});

  it(`should hide/unhide a maximal length message`, function() {
    for (const testInfo of testInfos) {
      if (VERBOSE) {
  	console.log(`testing maximal length message for ${testInfo.id}`);
      }
      const steg = new Steg(testInfo.id, testInfo.ppm);
      const msgLen = testInfo.maxMsgLen;
      const msg = randMsg(msgLen);
      const hideResult = steg.hide(msg);
      assert(hideResult.ppm);
      fs.writeFileSync(OUT, hideResult.ppm.bytes());
      const unhideResult = new Steg(OUT, makePpm(OUT)).unhide();
      assert(unhideResult.msg);
      assert.equal(unhideResult.msg, msg);
      if (VERBOSE) {
  	console.log(`hide/unhide ok for max message length ${msgLen}`);
      }
    }
  });

  it(`should not hide a message which is 1 char too long`, function() {
    for (const testInfo of testInfos) {
      if (VERBOSE) {
  	console.log(`testing 1 char too long message for ${testInfo.id}`);
      }
      const steg = new Steg(testInfo.id, testInfo.ppm);
      const msgLen = testInfo.maxMsgLen + 1;
      const msg = randMsg(msgLen);
      const hideResult = steg.hide(msg);
      assert(hideResult.error);
      assert(hideResult.error.startsWith('STEG_TOO_BIG'));
      if (VERBOSE) {
  	console.log(`hide fail for too big message length ${msgLen}`);
      }
    }
  });


});

describe('hide/unhide random messages with random images', function() {

  function randTestInfos(count) {
    const ppms = fs.readdirSync(IMG_DIR).filter((f) => f.match(/\.ppm$/));
    assert(count <= ppms.length);
    const imgIds = [];
    while (imgIds.length < count) { //create count distinct imgIds
      const imgId = ppms[Math.floor(Math.random()*ppms.length)];
      if (imgIds.indexOf(imgId) < 0) imgIds.push(imgId);
    }
    return imgIds.map((id) => makeTestInfo(id));
  }

  
  afterEach(function() { if (fs.existsSync(OUT)) { fs.unlinkSync(OUT); }});

  const COUNT = 5;
  randTestInfos(COUNT).forEach(function (testInfo) {
    it(`must hide/unhide a random message in ${testInfo.id}}`,
       function() {
	 const steg = new Steg(testInfo.id, testInfo.ppm);
	 const msgLen = Math.floor(Math.random()*testInfo.maxMsgLen);
	 const msg = randMsg(msgLen);
	 const hideResult = steg.hide(msg);
	 assert(hideResult.ppm);
	 fs.writeFileSync(OUT, hideResult.ppm.bytes());
	 const unhideResult = new Steg(OUT, makePpm(OUT)).unhide();
	 assert(unhideResult.msg);
	 assert.equal(unhideResult.msg, msg);
	 if (VERBOSE) {
	   console.log(`hide/unhide ok for message length ${msgLen}`);
	 }
       });
  });

});

