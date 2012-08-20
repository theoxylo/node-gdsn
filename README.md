## node-gdsn

A GDSN EIP component library for Node.js


## Installation

Install with [npm] (http://github.com/isaacs/npm):

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

    git clone https://github.com/theoxylo/node-gdsn.git
    node node-gdsn/test/test.js node-gdsn/test/cin.xml
