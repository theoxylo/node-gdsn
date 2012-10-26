[![build status](https://secure.travis-ci.org/theoxylo/node-gdsn.png)](http://travis-ci.org/theoxylo/node-gdsn)

## node-gdsn

A GDSN EIP component library for Node.js


## Installation

Get the latest published release from [npm] (http://github.com/isaacs/npm) [v003_20121025]

    npm install gdsn

Or add to package.json and 

    npm install


## Usage

    var gdsn = require('gdsn');
    var file = 'path/cin.xml';

    gdsn.readXmlFile(file, function(err, xml) {
        if (err) {
            log('Error: ' + err);
            return;
        }
        var modXml = gdsn.processCinFromOtherDP(xml); // sync, throws err
        var outputFile = 'cin_to_local_party_' + new Date().getTime() + '.xml';
        gdsn.writeXmlFile(outputFile, modXml, function(err, result) {
            if (err) {
                log('Error writing CIN file: ' + err);
            }
            else {
                log('Success! Created new CIN file ' + outputFile);
            }
        });
    });


## Development
    
Get the latest version from GitHub instead of npm:

    mkdir project_dir
    cd project_dir
    git clone https://github.com/theoxylo/node-gdsn.git node_modules/gdsn
    cd node_modules/gdsn
    npm install
    node test/test.js test/cin.xml