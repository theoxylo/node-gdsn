var select = require('xpath.js')
var xmldom = require('xmldom')
var fs = require('fs')

module.exports = Gdsn

function Gdsn(opts) {
  if (!(this instanceof Gdsn)) return new Gdsn(opts)

  this.xmldom_parser = new xmldom.DOMParser()
  this.xmldom_serializer = new xmldom.XMLSerializer()

  opts = opts || {} 
  if (!opts.templatePath) opts.templatePath = __dirname + '/templates/'
  if (!opts.homeDataPoolGln) opts.homeDataPoolGln = '1100001011285'
  console.log('GDSN options:')
  console.log(opts)

  this.getXmlDom = function(xml, cb) {
    var doc = this.xmldom_parser.parseFromString(xml, "text/xml")
    if (cb) cb(null, doc)
    else return doc
  }

  this.handleErr = function(err, cb) {
    if (err) {
      cb(err)
      return true
    }
    return false
  }
  
  this.readXmlFile = function(file, cb) {
    var log = function(msg) {
      console.log('gdsn.readXmlFile: ' + msg)
    }
    var self = this
    fs.readFile(file, 'utf-8', function (err, xml) {
      if (self.handleErr(err, cb)) return
      log('file byte count: ' + Buffer.byteLength(xml))
      cb(null, xml)
    })
  }

  this.writeXmlFile = function(file, xml, cb) {
    var log = function(msg) {
      console.log('gdsn.writeXmlFile: ' + msg)
    }
    var self = this
    fs.writeFile(file, xml, 'utf-8', function (err, xml) {
      if (self.handleErr(err, cb)) return
      cb(null, 'File saved: ' + file)
    })
  }
  
  this.getMessageInfo = function(doc) {
    if (doc.constructor === String) doc = this.getXmlDom(doc)
    var info = {}
    info.id        =  select(doc, "//*[local-name()='InstanceIdentifier']")[0].firstChild.data
    info.sender    =  select(doc, "//*[local-name()='Sender']/*[local-name() = 'Identifier']")[0].firstChild.data
    info.receiver  =  select(doc, "//*[local-name()='Receiver']/*[local-name() = 'Identifier']")[0].firstChild.data
    info.type      =  select(doc, "//*[local-name()='DocumentIdentification']/*[local-name() = 'Type']")[0].firstChild.data
    info.ts =  select(doc, "//*[local-name()='DocumentIdentification']/*[local-name() = 'CreationDateAndTime']")[0].firstChild.data
    return info
  }
  
  this.populateResponseTemplate = function(doc, info) {
    var resId = "cin_resp_" + new Date().getTime()

    select(doc, "//*[local-name()='Sender']/*[local-name()='Identifier']")[0].firstChild.data = info.receiver
    select(doc, "//*[local-name()='Receiver']/*[local-name()='Identifier']")[0].firstChild.data = info.sender
    select(doc, "//*[local-name()='DocumentIdentification']/*[local-name()='InstanceIdentifier']")[0].firstChild.data = resId
    select(doc, "//*[local-name()='CreationDateAndTime']")[0].firstChild.data = info.ts
    select(doc, "//*[local-name()='Scope']/*[local-name()='InstanceIdentifier']")[0].firstChild.data = resId
    select(doc, "//*[local-name()='RequestingDocumentCreationDateTime']")[0].firstChild.data = info.ts
    select(doc, "//*[local-name()='RequestingDocumentInstanceIdentifier']")[0].firstChild.data = info.id
    select(doc, "//*[local-name()='uniqueCreatorIdentification']")[0].firstChild.data = resId
    select(doc, "//*[local-name()='gln']")[0].firstChild.data = info.receiver
  }
  
  this.createCinResponse = function(doc, cb) {
    var log = function(msg) {
      console.log('gdsn.createCinResponse: ' + msg)
    };
    
    var msgIn = this.getMessageInfo(doc);
    log("inbound msg info: ");
    console.log(msgIn);
    
    var self = this;
    this.readXmlFile(opts.templatePath + "GDSNResponse_template.xml", function (err, responseTemplate) {
      if (self.handleErr(err, cb)) return
      self.getXmlDom(responseTemplate, function (err, res) {
        self.populateResponseTemplate(res, msgIn)
        
        var message = res.getElementsByTagName("eanucc:message")[0]
        
        var eANUCCResponse = res.createElement("gdsn:eANUCCResponse")
        eANUCCResponse.setAttribute("responseStatus", "ACCEPTED")
        var sender = res.createElement("sender")
        sender.appendChild(res.createTextNode(msgIn.sender))
        eANUCCResponse.appendChild(sender)
        var receiver = res.createElement("receiver")
        receiver.appendChild(res.createTextNode(msgIn.receiver))
        eANUCCResponse.appendChild(receiver)

        var nodes = select(doc, "//*[local-name() = 'transaction']/entityIdentification")
        
        var i, j, responseNode, documentReceived
        for (i = 0; i < nodes.length; i++) {
          responseNode = eANUCCResponse.cloneNode(true)
          documentReceived = res.createElement("documentReceived")
          for (j = 0; j < nodes[i].childNodes.length; j++) {
            if (nodes[i].childNodes[j].nodeType === 1) {
              documentReceived.appendChild(nodes[i].childNodes[j].cloneNode(true))
            }
          }
          responseNode.appendChild(documentReceived)
          message.appendChild(responseNode)
        }
        
        var resXml = new xmldom.XMLSerializer().serializeToString(res)
        log("Response xml length: " + resXml.length)
        
        cb(null, resXml)
      }) // end getXmlDom
    })
  }

  this.forwardCinFromOtherDP = function(doc, cb) {
    var log = function(msg) {
      console.log('gdsn.forwardCinFromOtherDP: ' + msg)
    };

    var info = this.getMessageInfo(doc)

    // check that receiver is the home data pool:
    if (info.receiver !== opts.homeDataPoolGln) {
      cb({
        name: 'processCinFromOtherDP',
        message: 'message must be addressed to home data pool GLN ' + opts.homeDataPoolGln
      })
      return
    }
    // set sender to home data pool
    select(doc, "//*[local-name() = 'Sender']/*[local-name() = 'Identifier']")[0].firstChild.data = info.receiver

    // get data recipient (same for all transactions) and set new receiver gln
    var dataRecipient = select(doc, "//catalogueItem/dataRecipient")[0].firstChild.data
    log("CatalogueItem.dataRecipient GLN: " + dataRecipient)
    if (dataRecipient === opts.homeDataPoolGln) {
      cb({
        name: 'processCinFromOtherDP',
        message: 'dataRecipient must be a local party, not the data pool'
      })
      return
    }
    select(doc, "//*[local-name() = 'Receiver']/*[local-name() = 'Identifier']")[0].firstChild.data = dataRecipient

    // update InstanceIdentifier and message uniqueCreatorIdentification/gln
    var newId = 'cin_' + Date.now() + '_' + dataRecipient
    select(doc, "//*[local-name() = 'InstanceIdentifier']")[0].firstChild.data = newId
    select(doc, "//*[local-name() = 'message']/entityIdentification/uniqueCreatorIdentification")[0].firstChild.data = newId
    select(doc, "//*[local-name() = 'message']/entityIdentification/contentOwner/gln")[0].firstChild.data = opts.homeDataPoolGln

    // generate new CIN xml
    var modXml = this.xmldom_serializer.serializeToString(doc)
    
    cb(null, modXml)
  }
}
