//var gdsn = require('gdsn'); // for normal usage after npm install to node_modules
var gdsn = require('../'); // for testing in git or directory not name node-modules (without install)
var log = console.log;


//gdsn.debug();

if (process.argv.length !== 3) throw 'Usage: node path/test.js path/test.xml'

var file = process.argv.length == 3 ? process.argv.pop() : '';
log('file arg: ' + file);

log("Transforming CIN from other data pool for local trading party recipient...");
gdsn.readXmlFile( file, function (err, xml) {
    if (err) throw err;
    var modXml = gdsn.processCinFromOtherDP(xml);
    gdsn.writeXmlFile(file + '-to_local_party.xml', modXml);
});
