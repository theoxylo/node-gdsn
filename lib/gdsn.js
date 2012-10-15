var select = require('xpath.js') 
var xmldom = require('xmldom')
var fs = require('fs')

module.exports.getVersion = function () {
    var version = "0.0.1.b2";
    return { module: 'gdsn', version: version, build_status: 'dev' };
}

module.exports.getInstanceId = function (xml, cb, debug) {
    
    var log = function (msg) { console.log('gdsn.getInstanceId: ' + msg); }
    log('debug: ' + debug);

    var doc   = new xmldom.DOMParser().parseFromString(xml);
    //var nodes = select(doc, "//ns2:DocumentIdentification/ns2:InstanceIdentifier");
    var nodes = select(doc, "//*[local-name() = 'InstanceIdentifier']");

    if (!nodes || !nodes[0]) throw 'gdsn.getInstanceId: No data found';

    if (debug)
    {
        //log('Doc: ')
        //log(doc)

        log(nodes[0].localName + ": " + nodes[0].firstChild.data);
        log("node[0]: " + nodes[0].toString());
    }

    cb(null, nodes[0].firstChild.nodeValue); //, debug + '.getInstanceId')
}

module.exports.getInstanceIdFromFile = function (file, cb, debug)
{
    var log = function (msg) { console.log('gdsn.getInstanceIdFromFile: ' + msg); }
    log('debug: "' + debug + '"');

    fs.readFile(file, 'utf-8', function (err, data) {
        if (err) cb(err);

        if (debug) log('data.length: ' + Buffer.byteLength(data));
        module.exports.getInstanceId(data, cb, debug + '.getInstanceIdFromFile');
    });
}

module.exports.updateInstanceId = function (file, newId, cb) {

    fs.readFile(file, 'utf-8', function (err, xml) {

        var log = function (msg) { console.log('gdsn.updateInstanceId: ' + msg); }

        if (err) cb(err);

        var doc   = new xmldom.DOMParser().parseFromString(xml);
        var nodes = select(doc, "//*[local-name() = 'InstanceIdentifier']");

        if (!nodes || !nodes[0]) throw 'gdsn.getInstanceId: No data found';

        nodes[0].firstChild.nodeValue = newId;

        log(nodes[0].localName + ": " + nodes[0].firstChild.data);

        var modXml = new xmldom.XMLSerializer().serializeToString(doc);

        cb(null, modXml);
    });
}

module.exports.debug = function ()
{
    logProps(xmldom)
    logProps(new xmldom.DOMParser());
    logProps(new xmldom.XMLSerializer());
}

var logProps = function (obj)
{
    console.log('logProps(' + obj + '):')
    var prop;
    for (prop in obj)
    {
        console.log('obj[' + prop + ']: ' + obj[prop]);
    }
}

