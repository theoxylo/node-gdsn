//var gdsn = require('gdsn'); // for normal usage after npm install to node_modules
var gdsn = require('../'); // for testing in git or directory not name node-modules (without install)
var log = console.log;


//gdsn.debug();

if (process.argv.length !== 3) throw 'Usage: node path/test.js path/test.xml'

var file = process.argv.length == 3 ? process.argv.pop() : '';
log('file arg: ' + file);

gdsn.getInstanceIdFromFile(
    file,
    function(err, id) {
        if (err) {
            throw(err);
        }
        console.log('doc instance id: ' + id);
    }
);


log("Changing document instance id and saving to new file...");
gdsn.readXmlFile(
    file,
    function (err, xml) { // cb
        if (err) {
            throw err;
        }
        log('original xml length: ' + Buffer.byteLength(xml));
        
        var oldId = gdsn.getInstanceId(xml);
        log("old id from original xml: " + oldId);
        
        var modXml = gdsn.updateInstanceId(xml, oldId + '_MOD');
        log('modified xml length: ' + Buffer.byteLength(modXml));
        
        var newId = gdsn.getInstanceId(modXml);
        log("new id from modified xml: " + newId);
        //log("modified xml: " + modXml);
        
        gdsn.writeXmlFile(file + '-MOD', modXml);
    }
);


