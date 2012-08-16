## node-gdsn

A GDSN component library for Node.js


## Installation

Install with [npm] (http://github.com/isaacs/npm):

    npm install gdsn


## Usage

    var gdsn = require('gdsn');

    gdsn.getInstanceIdFromFile('./node_modules/gdsn/test/cin.xml',
        function(err, id)
        {
            if (err) console.log(err);
            console.log('doc instance id: ' + id);
        }
    );
