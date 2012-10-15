var select = require('xpath.js') 
var xmldom = require('xmldom')
var fs = require('fs')

module.exports.getVersion = function() {
    var version = "0.0.1.b3";
    return {
        module: 'gdsn',
        version: version,
        build_status: 'dev'
    };
}

module.exports.readXmlFile = function(file, cb) {
    var log = function (msg) { 
        console.log('gdsn.readXmlFile: ' + msg); 
    };
    fs.readFile(
        file, 
        'utf-8', 
        function (err, xml) { // cb
            if (err) {
                cb(err);
            }
            log('file byte count: ' + Buffer.byteLength(xml));
            cb(null, xml);
        }
    );
}

module.exports.writeXmlFile = function(file, xml) {
    var log = function (msg) { 
        console.log('gdsn.writeXmlFile: ' + msg); 
    };
    fs.writeFile(
        file, 
        xml,
        'utf-8', 
        function (err, xml) { // cb
            if (err) {
                log(err);
            }
            log('file saved: ' + file);
        }
    );
}

module.exports.getInstanceId = function(xml) {
    var log = function(msg) {
        console.log('gdsn.getInstanceId: ' + msg);
    };

    var doc   = new xmldom.DOMParser().parseFromString(xml);
    //var nodes = select(doc, "//ns2:DocumentIdentification/ns2:InstanceIdentifier");
    var nodes = select(doc, "//*[local-name() = 'InstanceIdentifier']");

    if (!nodes || !nodes[0]) {
        var msg = 'getInstanceId: InstanceIdentifier node not found';
        throw msg;
    }

    log(nodes[0].localName + ": " + nodes[0].firstChild.data);
    log("node[0]: " + nodes[0].toString());

    var instanceId = nodes[0].firstChild.nodeValue;
    return instanceId;
}

module.exports.getInstanceIdFromFile = function(file, cb) {
    var log = function (msg) { 
        console.log('gdsn.getInstanceIdFromFile: ' + msg); 
    };
    module.exports.readXmlFile(
        file,
        function (err, xml) { // cb
            if (err) {
                cb(err);
            }
            log('xml length: ' + Buffer.byteLength(xml));
            var instanceId = module.exports.getInstanceId(xml);
            log('found instanceId ' + instanceId);
            cb(null, instanceId);
        }
    );
}

module.exports.updateInstanceId = function(xml, newId) {
    var log = function(msg) {
        console.log('gdsn.updateInstanceId: ' + msg);
    };
    var doc   = new xmldom.DOMParser().parseFromString(xml);
    var nodes = select(doc, "//*[local-name() = 'InstanceIdentifier']");
    if (!nodes || !nodes[0]) {
        throw 'gdsn.updateInstanceId: InstanceIdentifier not found';
    }
    nodes[0].firstChild.data = newId;
    log(nodes[0].localName + " new id: " + nodes[0].firstChild.data);
    var modXml = new xmldom.XMLSerializer().serializeToString(doc);
    return modXml;
}

module.exports.debug = function() {
    logProps(xmldom)
    logProps(new xmldom.DOMParser());
    logProps(new xmldom.XMLSerializer());
}

var logProps = function(obj) {
    console.log('logProps(' + obj + '):')
    var prop;
    for (prop in obj) {
        console.log('obj[' + prop + ']: ' + obj[prop]);
    }
}

