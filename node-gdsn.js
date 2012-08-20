var select = require('xpath.js') 
var dom = require('xmldom').DOMParser
var fs = require('fs')

module.exports.getInstanceId = function (xml, cb, debug) 
{
    var log = function (msg) { console.log('gdsn.getInstanceId: ' + msg); }
    log('debug: ' + debug);

    var doc   = new dom().parseFromString(xml);
    var nodes = select(doc, "//ns2:DocumentIdentification/ns2:InstanceIdentifier");

    if (!nodes || !nodes[0]) throw 'gdsn.getInstanceId: No data found';

    if (debug)
    {
        //log('Nodes: ')
        //log(nodes)

        log(nodes[0].localName + ": " + nodes[0].firstChild.data);
        log("node[0]: " + nodes[0].toString());
    }

    cb(null, nodes[0].firstChild.nodeValue); //, debug + '.getInstanceId')
}

module.exports.getInstanceIdFromFile = function (file, cb, debug)
{
    var log = function (msg) { console.log('gdsn.getInstanceIdFromFile: ' + msg); }
    log('debug: ' + debug);

    fs.readFile(file, 'utf-8', function (err, data) {
        if (err) cb(err);

        if (debug) log('data.length: ' + Buffer.byteLength(data));
        module.exports.getInstanceId(data, cb, debug + '.getInstanceIdFromFile');
    });
}
