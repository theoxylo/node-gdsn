//var gdsn = require('gdsn'); // for normal usage after npm install to node_modules
var gdsn = require('../'); // for testing in git or directory not name node-modules (without install)
var log = console.log;


//gdsn.debug();

/*
if (process.argv.length !== 3) {
    log('Usage: node test/index.js test/cin_from_other_dp.xml');
    process.exit(1);
}
*/

var file = process.argv.length == 3 ? process.argv.pop() : __dirname + '/cin_from_other_dp.xml';

log('__dirname: ' + __dirname);
log('file arg: ' + file);

log("Transforming CIN from other data pool for local trading party recipient...");
gdsn.readXmlFile(file, function(err, xml) {
    if (err) {
        log('Error: ' + err);
        process.exit(1);
    }
    var modXml = gdsn.processCinFromOtherDP(xml); // sync
    var outputFile = 'cin_to_local_party_' + new Date().getTime() + '.xml';
    gdsn.writeXmlFile(outputFile, modXml, function(err, result) {
        if (err) {
            log('Error: ' + err);
            process.exit(1);
        }
        log('Success! Created new CIN file ' + outputFile);
    });
});
