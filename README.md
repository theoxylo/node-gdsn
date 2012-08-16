## node-gdsn

A GDSN component library for Node.js


## Installation

Install with [npm] (http://github.com/isaacs/npm):

    npm install gdsn


## Usage

    var gdsn = require('../node-gdsn');

    gdsn.getInstanceIdFromFile('test/cin.xml', 
        function(err, id)
        {
            if (err) console.log(err);
            assert(id);
            console.log('doc instance id: ' + id);
        }
    );


