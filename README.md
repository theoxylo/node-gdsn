## node-gdsn

A GDSN EIP component library for Node.js


## Installation

Get the latest published release from [npm] (http://github.com/isaacs/npm) [v001_20120820]

    npm install gdsn


## Usage

    var gdsn = require('gdsn');

    gdsn.getInstanceIdFromFile('path/cin.xml',
        function(err, id)
        {
            if (err) console.log(err);
            console.log('cin doc instance id: ' + id);
        }
    );


## Development
    
Get the latest version from GitHub and execute:

    git clone https://github.com/theoxylo/node-gdsn.git node_modules/gdsn
    cd node_modules/gdsn
    npm install
    cd ../..
    node -e "console.log(require('gdsn').getVersion())"
