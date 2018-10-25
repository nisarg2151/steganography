'use strict';

const axios = require('axios');


function StegWs(baseUrl) {
  this.stegUrl = `${baseUrl}/api`;
}

module.exports = StegWs;

StegWs.prototype.getImagesUrl = function(group) {
  return `${this.stegUrl}/images`;
}

StegWs.prototype.list = async function(group) {
  try {
    const url = `${this.stegUrl}/images/${group}`;
    const response = await axios.get(url);
    return response.data;
  }
  catch (err) {
    throw (err.response.data) ? err.response.data : err;
  }
};

StegWs.prototype.hide = async function(srcGroup, srcName, outGroup, msg) {
  try {
    const url = `${this.stegUrl}/steg/${srcGroup}/${srcName}`;
    const params = { outGroup: outGroup, msg: msg, };
    const response = await axios.post(url, params);
    const location = response.headers['location'];
    const match = location && location.match(/[^\/]+\/[^\/]+$/);
    if (!location || !match) {
      const err = 'cannot get hide image location';
      throw { response: { data: undefined},  message: err };
    }
    else {
      return match[0];
    }
  }
  catch (err) {
    throw (err.response.data) ? err.response.data : err;
  }  
};

StegWs.prototype.unhide = async function(group, name) {
  try {
    const url = `${this.stegUrl}/steg/${group}/${name}`;
    const response = await axios.get(url);
    return response.data.msg;
  }
  catch (err) {
    throw (err.response.data) ? err.response.data : err;
  }  
};

