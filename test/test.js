//var gdsn = require('gdsn'); // for normal usage after install to node_modules install
var gdsn = require('../node-gdsn.js'); // for testing in git without install
var assert = require('assert');
var log = console.log;

if (process.argv.length !== 3) throw 'Usage: node path/test.js path/test.xml'

var file = process.argv.length == 3 ? process.argv.pop() : "";
log('file arg: ' + file);

gdsn.getInstanceIdFromFile(file,
    function(err, id, debug) {
        if (err) console.log(err);
        assert(id);
        console.log('doc instance id: ' + id);
    }
    //, 'test.js-' + file
);
