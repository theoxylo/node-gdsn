//var gdsn = require('gdsn'); // for normal usage after npm install to node_modules
var gdsn = require('../'); // for testing in git or directory not name node-modules (without install)
var log = console.log;

var file = __dirname + '/bad.xml';

log('__dirname: ' + __dirname);
log('file arg: ' + file);

log("Attempting to process bad xml (not a CIN)...");
var modXml = gdsn.processCinFromOtherDP('<some-xml/>');
var outputFile = file + '_' + Date.now() + '-to_local_party.xml';
gdsn.writeXmlFile(outputFile, modXml);
