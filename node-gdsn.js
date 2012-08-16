var select = require('xpath.js') 
var dom = require('xmldom').DOMParser
var fs = require('fs')
var log = console.log

module.exports.getInstanceIdFromFile = function (file, cb, debug)
{
    fs.readFile(file, 'utf-8', 
        function (err, xml) 
        {
            if (err) cb(err);

            var doc = new dom().parseFromString(xml);
            var nodes = select(doc, "//ns2:DocumentIdentification/ns2:InstanceIdentifier");

            if (!nodes && !nodes[0]) throw 'No data found';

            if (debug)
            {
                //log('Nodes: ')
                //log(nodes)

                log(nodes[0].localName + ": " + nodes[0].firstChild.data);
                log("node[0]: " + nodes[0].toString());
            }

            cb(null, nodes[0].firstChild.nodeValue)
        }
    );
}
