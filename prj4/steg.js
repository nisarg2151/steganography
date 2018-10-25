'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const mustache = require('mustache');
const querystring = require('querystring');
const multer = require('multer');
const upload = multer();

const STATIC_DIR = 'statics';
const TEMPLATES_DIR = 'templates';

function serve(port, base, ws) {
  const app = express();
  app.locals.port = port;
  app.locals.base = base;
  app.locals.ws = ws;
  process.chdir(__dirname);
  app.use(base, express.static(STATIC_DIR));
  setupTemplates(app);
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}


module.exports = serve;

/***************************** Fields Info ******************************/

const FIELDS_INFO = {
  name: {
    friendlyName: 'Image Name',
  },
  group: {
    friendlyName: 'Image Group',
  },
  msg: {
    friendlyName: 'Hide Message',
  },
};
  
/******************************** Routes *******************************/

const MSG_FILE = 'msgFile';

function setupRoutes(app) {
  const base = app.locals.base;
  app.get(`${base}/hide.html`, doForm(app, 'Hide'));
  app.get(`${base}/unhide.html`, doForm(app, 'Unhide'));
  app.post(`${base}/hide.html`, upload.single(MSG_FILE), doForm(app, 'Hide'));
  app.post(`${base}/unhide.html`, bodyParser.urlencoded({extended: false}),
	   doForm(app, 'unhide'));
}

const [HIDE_GROUP, UNHIDE_GROUP] = [ 'inputs', 'steg' ];

function doForm(app, cmd) {
  return async function(req, res) {
    const isHide = cmd === 'Hide';
    const group = isHide ? HIDE_GROUP : UNHIDE_GROUP;
    let model;
    let template = 'form';
    if (req.body && req.body.submit) {
      [model, template] = await doHideUnhide(app, req, isHide);
    }
    else {
      try {
	model = await makeFormModel(app, isHide);
      }
      catch (err) {
	model = { cmd: cmd, errors: wsErrors(err), }
      }
    }
    const html = doMustache(app, template, model);
    res.send(html);
  };
}

async function doHideUnhide(app, req, isHide) {
  let model, template;
  let [values, errors] = checkSubmitErrors(app, req, isHide);
  if (errors.length === 0) {
    try {
      const name  = values.name;
      const result = await (
	isHide
          ?  app.locals.ws.hide(HIDE_GROUP, name, UNHIDE_GROUP, values.msg)
          :  app.locals.ws.unhide(UNHIDE_GROUP, name)
      );
      const status = isHide
        ? `message successfully hidden in image ${result}`
        : `message successfully recovered from image ${UNHIDE_GROUP}/${name}`;
      const cmd = (isHide) ? 'Hide' : 'Unhide';
      model = { cmd: cmd, status: status, message: isHide ? '' : result };
      template = 'success';
    }
    catch (err) {
      errors = wsErrors(err) 
    }
  }
  if (errors.length > 0) {
    model = await makeFormModel(app, isHide, req.body, errors);
    model = Object.assign(model, values);
    template = 'form';
  }
  return [model, template];
}

function checkSubmitErrors(app, req, isHide) {
  const errors = [];
  const values = Object.assign({}, req.body);
  const cmd = (isHide) ? 'Hide' : 'Unhide';
  const group = (isHide) ? HIDE_GROUP : UNHIDE_GROUP;
  if (isHide) { //check for message
    const fileData = req.file && req.file.buffer && req.file.buffer.toString();
    values.msg = fileData || values.message;
    if (fileData && values.message) {
      errors.push('ambiguous message: specified by both textbox and file');
    }
    else if (!values.msg || values.msg.length === 0) {
      errors.push('hide message must be specified in textbox or by ' +
		  'selecting a file');
    }
  }
  checkRequired(values, ['name', 'group'], errors);
  return [values, errors];
}

async function makeFormModel(app, isHide, values={}, errors=[]) {
  const group = isHide ? HIDE_GROUP : UNHIDE_GROUP;
  const names = await groupImages(app, group, values);
  const labels = makeLabels(names);
  return {
    base: app.locals.base,
    imagesUrl: app.locals.ws.getImagesUrl(),
    group: group,
    names: names,
    label: () => (name, render) => labels[render(name)], 
    cmd: isHide ? 'Hide' : 'Unhide',
    isHide: isHide,
    errors: errors,
  };
}

async function groupImages(app, group, values={}) {
  const names = await app.locals.ws.list(group);
  return names.map(function(name) {
    return {
      name: name,
      checked: values.name === name ? 'checked' : '',
    };
  });
}

function checkRequired(values, required, errors) {
  required.forEach(function (k) {
    if (!values[k] || values[k].trim().length === 0) {
      const name = (FIELDS_INFO[k] && FIELDS_INFO[k].friendlyName) || k;
      errors.push(`${name} must be specified`);
    }
  });
}

/************************ General Utilities ****************************/

function makeLabels(names) {
  const MAX_PREFIX_LEN = 8;
  const labels = {};
  const seen = {};
  names.forEach((n) => {
    const name = n.name;
    const m = name.match(/^(.{1,8})\W/);
    const base = m ? m[1] : name.substr(0, MAX_PREFIX_LEN);
    let [label, i] = [base, 1];    
    while (seen[label]) label = base + i++;
    labels[name] = seen[label] = label;
  });
  return labels;
}

/** Decode an error thrown by web services into an errors hash
 *  with a _ key.
 */
function wsErrors(err) {
  const msg = (err.message) ? err.message : 'web service error';
  console.error(msg);
  return [ msg ];
}

function doMustache(app, templateId, view) {
  const templates = { images: app.templates.images };
  return mustache.render(app.templates[templateId], view, templates);
}

function setupTemplates(app) {
  app.templates = {};
  for (let fname of fs.readdirSync(TEMPLATES_DIR)) {
    const m = fname.match(/^([\w\-]+)\.ms$/);
    if (!m) continue;
    try {
      app.templates[m[1]] =
	String(fs.readFileSync(`${TEMPLATES_DIR}/${fname}`));
    }
    catch (e) {
      console.error(`cannot read ${fname}: ${e}`);
      process.exit(1);
    }
  }
}

