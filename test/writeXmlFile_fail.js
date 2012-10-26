//var gdsn = require('gdsn'); // for normal usage after npm install to node_modules
var gdsn = require('../'); // for testing in git or directory not name node-modules (without install)
var log = console.log;

log("Negative test: writing file to missing output directory...");
gdsn.writeXmlFile('path/no_such_dir/test.xml', '<some-xml/>', function(err, result) {
    if (err) {
        log('As expected, an error was received: ' + err);
    }
    else log('writeXmlFile result: ' + result);
});
