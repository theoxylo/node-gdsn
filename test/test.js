var gdsn = require('../node-gdsn');
var assert = require('assert');

// positive
gdsn.getInstanceIdFromFile('test/cin.xml', 
    function(err, id)
    {
        if (err) console.log(err);
        assert(id);
        console.log('doc instance id: ' + id);
    }
);
