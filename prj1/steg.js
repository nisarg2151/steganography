#!/usr/bin/env nodejs

'use strict'

const Ppm = require('./ppm');
const StegModule = require('./steg_module');

const fs = require('fs');
const path = require('path'); 

/** print msg on stderr and exit. */
function die(msg) {
  console.error(msg);
  process.exit(1);
}

/** Asynchronously read file ppmFileName, construct a StegModule
 *  from its data and call fn on the constructed object.
 */
function doSteg(ppmFileName, fn) {
  fs.readFile(ppmFileName, function(err, data) {
    if (err) {
      die(`cannot read ${ppmFileName}: ${err}`);
    }
    const ppm = new Ppm(new Uint8Array(data));
    if (ppm.error) die(`${ppmFileName}: ${ppm.error}`);
    const steg = new StegModule(path.basename(ppmFileName), ppm);
    fn(steg);
  });
}

/** Output the bytes of the image resulting from hiding msg using the
 *  image contained in steg.
 */
function hide(steg, msg) {
  const result = steg.hide(msg);
  if (result.error) {
    console.error(result.error);
  }
  else {
    process.stdout.write(Buffer.from(result.ppm.bytes()));
  }
}

/** Output the message hidden within the image contained in steg. */
function unhide(steg) {
  const result = steg.unhide();
  if (result.error) {
    console.error(result.error);
  }
  else {
    console.log(result.msg);
  }
}

/** Top-level routine.  Dispatch based on # of arguments. */
function go(argv) {
  switch (argv.length) {
  case 3:
    doSteg(argv[2], (steg) => unhide(steg));
    break;
  case 4:
    doSteg(argv[2], (steg) => hide(steg, argv[3]));
    break;
  default:
    die(`usage: ${path.basename(argv[1])} PPM_FILE_NAME [MSG]`);
    break;
  }
}

go(process.argv);

   
