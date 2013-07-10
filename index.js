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
  console.log("GDSN options:")
  console.log(opts)

  if (!opts.homeDataPoolGln.length || opts.homeDataPoolGln.length !== 13) {
    console.log("Error: invalid home data pool GLN: " + opts.homeDataPoolGln)
    process.exit(1)
  }

  this.handleErr = function(err, cb) {
    if (err) {
      if (cb) cb(err)
      return true
    }
    return false
  }
  
  this.readFile = function(filename, cb) {
    var self = this
    fs.readFile(filename, 'utf-8', function (err, content) {
      if (self.handleErr(err, cb)) return
      console.log("gdsn.readFile: " + filename + " (" + Buffer.byteLength(content) + " bytes)")
      cb(null, content)
    })
  }

  this.getXmlDomForString = function(xml, cb) {
    var $dom = this.xmldom_parser.parseFromString(xml, "text/xml")
    if (cb) cb(null, $dom)
    else return $dom
  }

  this.getXmlDomForFile = function(filename, cb) {
    var self = this
    this.readFile(filename, function(err, content) {
      if (self.handleErr(err, cb)) return
      self.getXmlDomForString(content, cb)
    })
  }

  this.writeFile = function(filename, content, cb) {
    var self = this
    fs.writeFile(filename, content, function (err) {
      if (self.handleErr(err, cb)) return
      console.log("gdsn.writeFile: " + filename + " (" + Buffer.byteLength(content) + " bytes)")
    })
  }
  
  this.getMessageInfo = function($msg) {
    if ($msg.constructor === String) $msg = this.getXmlDomForString($msg)
    var info = {}
    //DocumentIdentification
    info.sender   = select($msg, "//*[local-name()='Sender']/*[local-name()='Identifier']")[0].firstChild.data
    info.receiver = select($msg, "//*[local-name()='Receiver']/*[local-name()='Identifier']")[0].firstChild.data
    info.id       = select($msg, "//*[local-name()='DocumentIdentification']/*[local-name()='InstanceIdentifier']")[0].firstChild.data
    info.type     = select($msg, "//*[local-name()='DocumentIdentification']/*[local-name()='Type']")[0].firstChild.data
    info.ts       = select($msg, "//*[local-name()='DocumentIdentification']/*[local-name()='CreationDateAndTime']")[0].firstChild.data
    return info
  }
  
  this.populateResponseTemplate = function(dom, args) {
    // since it is our template, we know the literal namespace prefixes
    select(dom, "//sh:Sender/sh:Identifier")[0].firstChild.data = args.receiver
    select(dom, "//sh:Receiver/sh:Identifier")[0].firstChild.data = args.sender
    select(dom, "//sh:DocumentIdentification/sh:InstanceIdentifier")[0].firstChild.data = args.resId
    select(dom, "//sh:DocumentIdentification/sh:CreationDateAndTime")[0].firstChild.data = args.ts
    select(dom, "//sh:Scope/sh:InstanceIdentifier")[0].firstChild.data = args.resId
    select(dom, "//sh:Scope/sh:CorrelationInformation/sh:RequestingDocumentCreationDateTime")[0].firstChild.data = args.ts
    select(dom, "//sh:Scope/sh:CorrelationInformation/sh:RequestingDocumentInstanceIdentifier")[0].firstChild.data = args.id
    select(dom, "//eanucc:message/entityIdentification/uniqueCreatorIdentification")[0].firstChild.data = args.resId
    select(dom, "//eanucc:message/entityIdentification/contentOwner/gln")[0].firstChild.data = args.receiver
  }
  
  this.createCinResponse = function($cin, cb) {
    var cinInfo = this.getMessageInfo($cin);
    console.log("gdsn.createCinResponse: cin msg info: ");
    console.log(cinInfo);

    // check that receiver is the home data pool:
    if (cinInfo.receiver !== opts.homeDataPoolGln) {
      cb({
        name: 'createCinResponse',
        message: 'message must be addressed to home data pool GLN ' + opts.homeDataPoolGln
      })
      return
    }
    
    var respTemplateFilename = opts.templatePath + "GDSNResponse_template.xml"
    var self = this;
    this.getXmlDomForFile(respTemplateFilename, function (err, $response) {
      cinInfo.resId = "cin_resp_" + new Date().getTime()
      self.populateResponseTemplate($response, cinInfo)

      var $eANUCCResponse = $response.createElement("gdsn:eANUCCResponse")
      $eANUCCResponse.setAttribute("responseStatus", "ACCEPTED")

      var $sender = $response.createElement("sender")
      $sender.appendChild($response.createTextNode(cinInfo.sender))
      $eANUCCResponse.appendChild($sender)

      var $receiver = $response.createElement("receiver")
      $receiver.appendChild($response.createTextNode(cinInfo.receiver))
      $eANUCCResponse.appendChild($receiver)

      var cinTrxNodes = select($cin, "//*[local-name()='transaction']/entityIdentification")

      var $message = $response.getElementsByTagName("eanucc:message")[0]

      var i, j, $responseNode, $documentReceived
      for (i = 0; i < cinTrxNodes.length; i++) {
        $responseNode = $eANUCCResponse.cloneNode(true)
        $documentReceived = $response.createElement("documentReceived")
        for (j = 0; j < cinTrxNodes[i].childNodes.length; j++) {
          if (cinTrxNodes[i].childNodes[j].nodeType === 1) {
            $documentReceived.appendChild(cinTrxNodes[i].childNodes[j].cloneNode(true))
          }
        }
        $responseNode.appendChild($documentReceived)
        $message.appendChild($responseNode)
      }

      var resXml = new xmldom.XMLSerializer().serializeToString($response)
      console.log("gdsn.createCinResponse: response xml length: " + resXml.length)

      cb(null, resXml)
    })
  }

  this.forwardCinFromOtherDP = function($cin, cb) {
    var cinInfo = this.getMessageInfo($cin)

    // check that receiver is the home data pool:
    if (cinInfo.receiver !== opts.homeDataPoolGln) {
      cb({
        name: 'forwardCinFromOtherDP',
        message: 'message must be addressed to home data pool GLN ' + opts.homeDataPoolGln
      })
      return
    }
    // set sender to home data pool
    select($cin, "//*[local-name()='Sender']/*[local-name()='Identifier']")[0].firstChild.data = opts.homeDataPoolGln

    // get data recipient (same for all transactions) and set new receiver gln
    var dataRecipient = select($cin, "//catalogueItem/dataRecipient")[0].firstChild.data
    console.log("gdsn.forwardCinFromOtherDP: dataRecipient GLN: " + dataRecipient)
    if (dataRecipient === opts.homeDataPoolGln) {
      cb({
        name: 'forwardCinFromOtherDP',
        message: 'dataRecipient must be a local party, not the data pool'
      })
      return
    }
    select($cin, "//*[local-name()='Receiver']/*[local-name()='Identifier']")[0].firstChild.data = dataRecipient

    // update InstanceIdentifier and message uniqueCreatorIdentification/gln
    var newId = 'cin_' + Date.now() + '_' + dataRecipient
    select($cin, "//*[local-name()='DocumentIdentification']/*[local-name()='InstanceIdentifier']")[0].firstChild.data = newId
    select($cin, "//*[local-name()='message']/entityIdentification/uniqueCreatorIdentification")[0].firstChild.data = newId
    select($cin, "//*[local-name()='message']/entityIdentification/contentOwner/gln")[0].firstChild.data = opts.homeDataPoolGln

    // generate new CIN xml
    var modXml = this.xmldom_serializer.serializeToString($cin)
    
    cb(null, modXml)
  }
}
