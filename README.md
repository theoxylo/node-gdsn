## node-gdsn

A GDSN EIP component library for Node.js


## Installation

Get the latest published release from [npm] (http://github.com/isaacs/npm) [v002_20121015]

    npm install gdsn


## Usage

    var gdsn = require('gdsn');

    // read id from file:
    gdsn.getInstanceIdFromFile('path/cin.xml',
        function(err, id)
        {
            if (err) console.log(err);
            console.log('cin doc instance id: ' + id);
        }
    );
    
    // update id and save to new file:
    gdsn.readXmlFile(
        file,
        function (err, xml) {
            if (err)  throw err;
            
            var oldId = gdsn.getInstanceId(xml);
            var modXml = gdsn.updateInstanceId(xml, oldId + '_MOD');
            gdsn.writeXmlFile(file + '-MOD', modXml);
        }
    );


## Development
    
Get the latest version from GitHub instead of npm:

    mkdir project_dir
    cd project_dir
    git clone https://github.com/theoxylo/node-gdsn.git node_modules/gdsn
    cd node_modules/gdsn
    npm install
    node test/test.js test/cin.xml
