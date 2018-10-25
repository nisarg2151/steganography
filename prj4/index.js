#!/usr/bin/env nodejs

'use strict';

const StegWs = require('./steg-ws');
const steg = require('./steg');

const assert = require('assert');
const process = require('process');


function usage() {
  console.error(`usage: ${process.argv[1]} PORT WS_BASE_URL`);
  process.exit(1);
}

function getPort(portArg) {
  let port = Number(portArg);
  if (!port) usage();
  return port;
}

const BASE = '';

async function go(args) {
  try {
    const port = getPort(args[0]);
    const wsBaseUrl = args[1];
    const ws = new StegWs(wsBaseUrl);
    steg(port, BASE, ws);
  }
  catch (err) {
    console.error(err);
  }
}
    

if (process.argv.length != 4) usage();
go(process.argv.slice(2));
