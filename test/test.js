//var gdsn = require('gdsn'); // for normal usage after npm install to node_modules
//var gdsn = require('../node-gdsn.js'); // for testing in git without install
var gdsn = require('../'); // for testing in git or directory not name node-modules (without install)
var assert = require('assert');
var log = console.log;

//gdsn.debug();

if (process.argv.length !== 3) throw 'Usage: node path/test.js path/test.xml'

var file = process.argv.length == 3 ? process.argv.pop() : '';
log('file arg: ' + file);

gdsn.getInstanceIdFromFile(file,
    function(err, id, debug) {
        if (err) console.log(err);
        assert(id);
        console.log('doc instance id: ' + id);
    }
    , 'test.js-' + file
);

/*
gdsn.updateInstanceId(file, 'testId_123', function(err, modXml) {
    if (err) console.log(err);
    log('Modified xml: ' + modXml);
});
*/


