var select = require('xpath.js')
var xmldom = require('xmldom')
var fs = require('fs')

// settings to be moved to config file later

module.exports = function Gdsn(opts) {

  if (!(this instanceof Gdsn)) return new Gdsn(opts)

  this.opts = opts || {} // e.g. { homeDataPoolGln: '1100001011285' }

  var homeDataPoolGln = opts.homeDataPoolGln

  var version = "0.0.4"

  this.getVersion = function() {
    return {
      module: 'gdsn',
      version: version,
      build_status: 'dev'
    }
  }

  this.readXmlFile = function(file, cb) {
    var log = function(msg) {
      console.log('gdsn.readXmlFile: ' + msg)
    };
    fs.readFile(
    file, 'utf-8',

    function(err, xml) { // cb
      if (err) {
        cb(err)
      }
      log('file byte count: ' + Buffer.byteLength(xml))
      cb(null, xml)
    });
  }

  this.writeXmlFile = function(file, xml, cb) {
    var log = function(msg) {
      console.log('gdsn.writeXmlFile: ' + msg)
    };
    fs.writeFile(
    file,
    xml, 'utf-8',

    function(err, xml) { // cb
      if (err) {
        if (!cb) throw err
        cb(err)
        return
      }
      if (cb) cb(null, 'File saved: ' + file)
      else log('File saved: ' + file)
    });
  }

  this.createCinResponse = function(xml, cb) {
    var log = function(msg) {
      console.log('gdsn.getInstanceId: ' + msg)
    };
    var doc = new xmldom.DOMParser().parseFromString(xml)
    var senderGln = select(doc, "//*[local-name() = 'Sender']/*[local-name() = 'Identifier']")[0].firstChild
    log("sender gln: " + senderGln)
    
    this.readXmlFile("./templates/GDSNResponse_template.xml", function (err, responseTemplate) {
      
      var res = new xmldom.DOMParser().parseFromString(responseTemplate)
      
      var recId = select(res, "//*[local-name() = 'Receiver']/*[local-name() = 'Identifier']")[0]
      log("recId: " + recId.firstChild.nodeValue)
      recId.firstChild.nodeValue = senderGln
      console.log("recId: " + recId.firstChild.nodeValue)
      
      select(res, "//*[local-name() = 'InstanceIdentifier']")[0].data = "CIN_RESP_" // + new Date().getTime()
      
      var message = res.getElementsByTagName("eanucc:message")[0]
      
      var eANUCCResponse = res.createElement("gdsn:eANUCCResponse")
      eANUCCResponse.setAttribute("responseStatus", "ACCEPTED")
      var sender = res.createElement("sender")
      sender.appendChild(res.createTextNode(senderGln))
      eANUCCResponse.appendChild(sender)
      var receiver = res.createElement("receiver")
      receiver.appendChild(res.createTextNode(homeDataPoolGln))
      eANUCCResponse.appendChild(receiver)

      var nodes = select(doc, "//*[local-name() = 'transaction']/entityIdentification")
      
      for (var i = 0; i < nodes.length; i++) {
        var response = eANUCCResponse.cloneNode(true)
        var documentReceived = res.createElement("documentReceived")
        
        for (var j = 0; j < nodes[i].childNodes.length; j++) {
          if (nodes[i].childNodes[j].nodeType === 1) {
            //log(nodes[i].childNodes[j])
            documentReceived.appendChild(nodes[i].childNodes[j])
          }
        }
        
        response.appendChild(documentReceived)
        message.appendChild(response)
      }
      
      var modXml = new xmldom.XMLSerializer().serializeToString(res)
      //log("response xml: " + modXml)
      
      if (cb) cb(null, modXml)
      else return modXml
    })
  }

  this.getInstanceId = function(xml, cb) {
    var log = function(msg) {
      console.log('gdsn.getInstanceId: ' + msg)
    };
    var doc = new xmldom.DOMParser().parseFromString(xml)
    //var nodes = select(doc, "//ns2:DocumentIdentification/ns2:InstanceIdentifier")
    var nodes = select(doc, "//*[local-name() = 'InstanceIdentifier']")

    if (!nodes || !nodes[0]) {
      throw {
        name: 'getInstanceId',
        message: 'InstanceIdentifier node not found'
      }
    }

    log(nodes[0].localName + ": " + nodes[0].firstChild.data)
    log(nodes[0].localName + ": " + nodes[0].firstChild)
    log("nodes[0]: " + nodes[0].toString())
    log("nodes[0]: ")
    console.log(nodes[0].constructor)

    var instanceId = nodes[0].firstChild.data
    if (cb) cb(null, instanceId)
    else return instanceId
  }

  this.getInstanceIdFromFile = function(file, cb) {
    var log = function(msg) {
      console.log('gdsn.getInstanceIdFromFile: ' + msg)
    };
    var self = this
    this.readXmlFile(file, function(err, xml) { // cb
      if (err) {
        cb(err);
      }
      log('xml length: ' + Buffer.byteLength(xml))
      var instanceId = self.getInstanceId(xml)
      log('found instanceId ' + instanceId)
      cb(null, instanceId)
    });
  }

  this.updateInstanceId = function(xml, newId) {
    var log = function(msg) {
      console.log('gdsn.updateInstanceId: ' + msg)
    };
    var doc = new xmldom.DOMParser().parseFromString(xml)
    var nodes = select(doc, "//*[local-name() = 'InstanceIdentifier']")
    if (!nodes || !nodes[0]) {
      throw {
        name: 'updateInstanceId',
        message: 'InstanceIdentifier node not found'
      }
    }
    nodes[0].firstChild.data = newId
    log(nodes[0].localName + " new id: " + nodes[0].firstChild.data)
    var modXml = new xmldom.XMLSerializer().serializeToString(doc)
    return modXml
  }

  this.processCinFromOtherDP = function(xml, cb) {
    var log = function(msg) {
      console.log('gdsn.processCinFromOtherDP: ' + msg)
    };
    var doc = new xmldom.DOMParser().parseFromString(xml)

    // check that receiver is the home data pool:
    var receiverNodes = select(doc, "//*[local-name() = 'Receiver']/*[local-name() = 'Identifier']")
    if (!receiverNodes || !receiverNodes[0]) {
      throw {
        name: 'processCinFromOtherDP',
        message: 'Receiver.Identifier not found'
      }
    }
    var receiver = receiverNodes[0].firstChild.data;
    log("Original Receiver.Identifier GLN: " + receiver)
    if (receiver !== homeDataPoolGln) {
      throw {
        name: 'processCinFromOtherDP',
        message: 'message must be addressed to home data pool GLN ' + homeDataPoolGln
      }
    }

    // get data recipient and set new receiver gln:
    var dataRecipientNodes = select(doc, "//catalogueItem/dataRecipient")
    if (!dataRecipientNodes || !dataRecipientNodes[0]) {
      throw {
        name: 'processCinFromOtherDP',
        message: 'Receiver.Identifier not found'
      }
    }
    var dataRecipient = dataRecipientNodes[0].firstChild.data
    log("CatalogueItem.dataRecipient GLN: " + dataRecipient)
    receiverNodes[0].firstChild.data = dataRecipient

    // set sender to home data pool
    var senderNodes = select(doc, "//*[local-name() = 'Sender']/*[local-name() = 'Identifier']")
    if (!senderNodes || !senderNodes[0]) {
      throw {
        name: 'processCinFromOtherDP',
        message: 'Sender.Identifier not found'
      }
    }
    senderNodes[0].firstChild.data = homeDataPoolGln;

    // set message owner to home data pool
    var ownerNodes = select(doc, "//*[local-name() = 'message']/entityIdentification/contentOwner/gln");
    if (!ownerNodes || !ownerNodes[0]) {
      throw {
        name: 'processCinFromOtherDP',
        message: 'message owner not found'
      }
    }
    ownerNodes[0].firstChild.data = homeDataPoolGln

    // update InstanceIdentifier and message uniqueCreatorIdentification to new id
    var newId = 'cin_' + Date.now() + '_' + dataRecipient
    var idNodes = select(doc, "//*[local-name() = 'InstanceIdentifier']")
    if (!idNodes || !idNodes[0]) {
      throw {
        name: 'processCinFromOtherDP',
        message: 'InstanceIdentifier not found'
      }
    }
    idNodes[0].firstChild.data = newId
    idNodes = select(doc, "//*[local-name() = 'message']/entityIdentification/uniqueCreatorIdentification")
    if (!idNodes || !idNodes[0]) {
      var error = {
        name: 'processCinFromOtherDP',
        message: 'message uniqueCreatorIdentification not found'
      }
      if (cb) cb(error, null)
      else throw error
    }
//    if (!idNodes[0].firstChild) {
//      idNodes[0].appendChild(newChild)
//    }

    idNodes[0].firstChild.data = newId

    // generate new CIN xml
    var modXml = new xmldom.XMLSerializer().serializeToString(doc)
    //return modXml
    
    if (!cb) return modXml // for sync usage
    else cb(null, modXml)       // for async
  }

  this.debug = function() {
    this.logProps(xmldom)
    this.logProps(new xmldom.DOMParser())
    this.logProps(new xmldom.XMLSerializer())
  }

  this.logProps = function(obj) {
    console.log('logProps(' + obj + '):')
    var prop
    for (prop in obj) {
      console.log('obj[' + prop + ']: ' + obj[prop])
    }
  }
}