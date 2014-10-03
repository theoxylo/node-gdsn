var select      = require('xpath').select
var xmldom      = require('xmldom')
var ItemStream  = require('./ItemStream')
var PartyStream = require('./PartyStream')

var _xmldom_parser = new xmldom.DOMParser({
  locator: {},
  errorHandler: function (level, msg) {console.log(level, "gdsn dom parse error: " + msg)}
})

var _xmldom_serializer = new xmldom.XMLSerializer()

var log = function (msg) {
  console.log(msg)
}

module.exports = function addDomSupport(gdsn) {
  
  gdsn.items = new ItemStream(gdsn)
  gdsn.parties = new PartyStream(gdsn)

  gdsn.dom = {}

  gdsn.dom.processCinFromOtherDp = function (cinInFile, cb) {

    log('processCinFromOtherDP for file ' + cinInFile)

    var ts = Date.now()
    var responseOutFile = gdsn.config.outbox_dir + '/out_cin_response_to_other_dp_'   + ts + '.xml'
    var forwardOutFile  = gdsn.config.outbox_dir + '/out_cin_forward_to_local_party_' + ts + '.xml'

    gdsn.dom.getXmlDomForFile(cinInFile, function(err, cin) {
      if (err) return cb(err)

      var responseComplete = false
      var forwardComplete = false

      gdsn.dom.createCinResponse(cin, function(err, responseXml) {
        if (err) return cb(err)
        gdsn.writeFile(responseOutFile, responseXml, function(err, size) {
          if (err) return cb(err)
          responseComplete = true
          if (forwardComplete) return cb(null, 'cin process finished ' + size)
        })
      })

      gdsn.dom.forwardCinFromOtherDP(cin, function(err, cinOut) {
        if (err) return cb(err)
        gdsn.writeFile(forwardOutFile, cinOut, function(err, size) {
          if (err) return cb(err)
          forwardComplete = true
          if (responseComplete) return cb(null, 'cin process finished ' + size)
        })
      })

    })
  }

  gdsn.dom.createCinResponse = function (cin, cb) {
    setImmediate(function () {
      try {
        var cin_msg_info = gdsn.dom.getMessageInfoForDom(cin)
        log('Gdsn().createCinResponse: cin msg info: ')
        log(cin_msg_info)

        if (cin_msg_info.type !== 'catalogueItemNotification') {
          return cb(new Error('createCinResponse: message must be of type "catalogueItemNotification" and not: ' + cin_msg_info.type))
        }

        // check that receiver is the home data pool:
        if (cin_msg_info.receiver !== gdsn.config.homeDataPoolGln) {
          return cb(new Error('createCinResponse: message must be addressed to home data pool GLN ' + gdsn.config.homeDataPoolGln))
        }

        var respTemplateFilename = gdsn.config.templatePath + '/GDSNResponse_template.xml'

        gdsn.dom.getXmlDomForFile(respTemplateFilename, function (err, $response) {
          if (err) return cb(err)

          cin_msg_info.resId = 'cin_resp_' + Date.now()
          gdsn.dom.populateResponseTemplate($response, cin_msg_info)

          var $eANUCCResponse = $response.createElement('gdsn:eANUCCResponse')
          $eANUCCResponse.setAttribute('responseStatus', 'ACCEPTED')

          var $sender = $response.createElement('sender')
          $sender.appendChild($response.createTextNode(cin_msg_info.sender))
          $eANUCCResponse.appendChild($sender)

          var $receiver = $response.createElement('receiver')
          $receiver.appendChild($response.createTextNode(cin_msg_info.receiver))
          $eANUCCResponse.appendChild($receiver)

          var cinTrxNodes = select('//*[local-name()="transaction"]/entityIdentification', cin)

          var $message = $response.getElementsByTagName('eanucc:message')[0]

          var $responseNode, $documentReceived
          for (var i = 0; i < cinTrxNodes.length; i++) {
            $responseNode = $eANUCCResponse.cloneNode(true)
            $documentReceived = $response.createElement('documentReceived')
            for (var j = 0; j < cinTrxNodes[i].childNodes.length; j++) {
              if (cinTrxNodes[i].childNodes[j].nodeType === 1) {
                $documentReceived.appendChild(cinTrxNodes[i].childNodes[j].cloneNode(true))
              }
            }
            $responseNode.appendChild($documentReceived)
            $message.appendChild($responseNode)
          }

          gdsn.dom.getXmlStringForDom($response, cb)
        })
      }
      catch (err) {
        return cb(err)
      }
    })
  }

  gdsn.dom.populateResponseTemplate = function (dom, args) {
    var iso_date_time_created = new Date(args.created_ts).toISOString()

    gdsn.dom.setNodeData(dom, '//*[local-name()="Sender"]/*[local-name()="Identifier"]', args.receiver)
    gdsn.dom.setNodeData(dom, '//*[local-name()="Receiver"]/*[local-name()="Identifier"]', args.sender)
    gdsn.dom.setNodeData(dom, '//*[local-name()="DocumentIdentification"]/*[local-name()="InstanceIdentifier"]', args.resId)
    gdsn.dom.setNodeData(dom, '//*[local-name()="DocumentIdentification"]/*[local-name()="CreationDateAndTime"]', iso_date_time_created)
    gdsn.dom.setNodeData(dom, '//*[local-name()="Scope"]/*[local-name()="InstanceIdentifier"]', args.resId)
    gdsn.dom.setNodeData(dom, '//*[local-name()="Scope"]/*[local-name()="CorrelationInformation"]/*[local-name()="RequestingDocumentCreationDateTime"]', iso_date_time_created)
    gdsn.dom.setNodeData(dom, '//*[local-name()="Scope"]/*[local-name()="CorrelationInformation"]/*[local-name()="RequestingDocumentInstanceIdentifier"]', args.msg_id)
    gdsn.dom.setNodeData(dom, '//*[local-name()="message"]/entityIdentification/uniqueCreatorIdentification', args.resId)
    gdsn.dom.setNodeData(dom, '//*[local-name()="message"]/entityIdentification/contentOwner/gln', args.receiver)
  }

  gdsn.dom.forwardCinFromOtherDP = function (cin, cb) {
    setImmediate(function () {
      try {
        var cin_msg_info = gdsn.dom.getMessageInfoForDom(cin)

        // check that receiver is the home data pool:
        if (cin_msg_info.receiver !== gdsn.config.homeDataPoolGln) {
          return cb(new Error('forwardCinFromOtherDP: message must be addressed to home data pool GLN ' + gdsn.config.homeDataPoolGln))
        }
        // set sender to home data pool
        gdsn.dom.setNodeData(cin, '//*[local-name()="Sender"]/*[local-name()="Identifier"]', gdsn.config.homeDataPoolGln)

        // get data recipient (same for all transactions) and set new receiver gln
        var dataRecipient = gdsn.dom.getNodeData(cin, '//catalogueItem/dataRecipient')
        log('Gdsn().forwardCinFromOtherDP: dataRecipient GLN: ' + dataRecipient)

        if (dataRecipient === gdsn.config.homeDataPoolGln) {
          return cb(new Error('forwardCinFromOtherDP: dataRecipient must be a local party, not the data pool'))
        }

        gdsn.dom.setNodeData(cin, '//*[local-name()="Receiver"]/*[local-name()="Identifier"]', dataRecipient)

        // update InstanceIdentifier and message uniqueCreatorIdentification/gln
        var newId = 'cin_' + Date.now() + '_' + dataRecipient
        gdsn.dom.setNodeData(cin, '//*[local-name()="DocumentIdentification"]/*[local-name()="InstanceIdentifier"]', newId)
        gdsn.dom.setNodeData(cin, '//*[local-name()="message"]/entityIdentification/uniqueCreatorIdentification', newId)
        gdsn.dom.setNodeData(cin, '//*[local-name()="message"]/entityIdentification/contentOwner/gln', gdsn.config.homeDataPoolGln)

        // generate new CIN xml

        log('forwardCinFromOtherDP: newId: ' + newId)

        gdsn.dom.getXmlStringForDom(cin, cb)
      }
      catch (err) {
        return cb(err)
      }
    })
  }

  gdsn.dom.getXmlDomForString = function (xml, cb) {
    setImmediate(function () {
      try {
        var $dom = _xmldom_parser.parseFromString(xml, 'text/xml')
        return cb(null, $dom)
      }
      catch (err) {
        return cb(err)
      }
    })
  }

  gdsn.dom.getXmlDomForFile = function (filename, cb) {
    gdsn.readFile(filename, function (err, content) {
      if (err) return cb(err)
      log('Gdsn.getXmlDomForFile : read ' + filename + ' (' + Buffer.byteLength(content) + ' bytes)')
      gdsn.dom.getXmlDomForString(content, cb)
    })
  }

  gdsn.dom.getXmlStringForDom = function ($dom, cb) {
    setImmediate(function () {
      try {
        var xml = _xmldom_serializer.serializeToString($dom)
        return cb(null, xml)
      }
      catch (err) {
        return cb(err)
      }
    })
  }

  gdsn.dom.getMessageInfoForDom = function ($msg) {
    var info = {}
    info.sender     = gdsn.dom.getNodeData($msg, '//*[local-name()="Sender"]/*[local-name()="Identifier"]')
    info.receiver   = gdsn.dom.getNodeData($msg, '//*[local-name()="Receiver"]/*[local-name()="Identifier"]')
    info.msg_id     = gdsn.dom.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="InstanceIdentifier"]')
    info.type       = gdsn.dom.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="Type"]')
    var created_date_time = gdsn.dom.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="CreationDateAndTime"]')
    info.created_ts = (new Date(created_date_time)).getTime()

    if (info.type == 'catalogueItemNotification') {
      info.provider = gdsn.dom.getNodeData($msg, '//*[local-name()="informationProvider"]/*[local-name()="gln"]')
      info.recipient = gdsn.dom.getNodeData($msg, '//*[local-name()="dataRecipient"]')
      info.source_dp = gdsn.dom.getNodeData($msg, '//*[local-name()="sourceDataPool"]')
      info.urls = gdsn.dom.getNodeData($msg, '//*[local-name()="uniformResourceIdentifier"]', true)
    }
    return info
  }

  gdsn.dom.getTradeItemsForDom = function (msg) {

    var msg_info = gdsn.dom.getMessageInfoForDom(msg)

    var $tradeItems = select('//*[local-name()="tradeItem"]', msg)

    var tradeItems = []

    for (var idx = 0; idx < $tradeItems.length; idx++) {
      var $tradeItem = $tradeItems[idx]
      var xml = _xmldom_serializer.serializeToString($tradeItem)
      var info = gdsn.dom.getTradeItemInfo(xml, msg_info)
      tradeItems.push(info)
    }
    return tradeItems
  }

  gdsn.dom.getCustomTradeItemInfo = function (xml, mappings) {

    var result = {}

    var $doc = _xmldom_parser.parseFromString(xml, 'text/xml')
    $doc.normalize()

    var mapping
    for (mapping in mappings) {
      //log('found mapping name: ' + mapping)
      if (mappings.hasOwnProperty(mapping)) {
        var xp = mappings[mapping]
        if (xp) result[mapping] = gdsn.dom.getNodeData($doc, xp)
      }
    }
    return result
  }

  gdsn.dom.getTradeItemInfo = function (raw_xml, msg_info) {

    var info = {}
    info.raw_xml    = raw_xml
    info.created_ts = msg_info.created_ts
    info.recipient  = msg_info.recipient
    info.msg_id     = msg_info.msg_id
    info.source_dp  = msg_info.source_dp

    var clean_xml = gdsn.clean_xml(raw_xml)
    info.xml = clean_xml

    var $newDoc   = _xmldom_parser.parseFromString(clean_xml, 'text/xml')
    $newDoc.normalize()

    info.gtin      = gdsn.dom.getNodeData($newDoc, '/tradeItem/tradeItemIdentification/gtin')
    info.provider  = gdsn.dom.getNodeData($newDoc, '/tradeItem/tradeItemInformation/informationProviderOfTradeItem/informationProvider/gln')
    info.tm        = gdsn.dom.getNodeData($newDoc, '/tradeItem/tradeItemInformation/targetMarketInformation/targetMarketCountryCode/countryISOCode')
    info.unit_type = gdsn.dom.getNodeData($newDoc, '/tradeItem/tradeItemUnitDescriptor')
    info.gpc       = gdsn.dom.getNodeData($newDoc, '/tradeItem/tradeItemInformation/classificationCategoryCode/classificationCategoryCode')
    info.brand     = gdsn.dom.getNodeData($newDoc, '/tradeItem/tradeItemInformation/tradeItemDescriptionInformation/brandName')
    info.tm_sub    = gdsn.dom.getNodeData($newDoc, '/tradeItem/tradeItemInformation/targetMarketInformation/targetMarketSubdivisionCode/countrySubDivisionISOCode')
    if (!info.tm_sub) info.tm_sub = 'na'

    // child items
    info.child_count = gdsn.dom.getNodeData($newDoc, '/tradeItem/nextLowerLevelTradeItemInformation/quantityOfChildren')
    info.child_gtins = gdsn.dom.getNodeData($newDoc, '/tradeItem/nextLowerLevelTradeItemInformation/childTradeItem/tradeItemIdentification/gtin', true)
    if (info.child_count != info.child_gtins.length) {
      log('WARNING: child count ' + info.child_count + ' does not match child gtins found: ' + info.child_gtins.join(', '))
    }

    return info
  }

  gdsn.dom.getPartyInfo = function (raw_xml, msg_info) {

    var info = {}
    info.raw_xml    = raw_xml
    info.msg_id     = msg_info.msg_id

    var clean_xml = gdsn.clean_xml(raw_xml)
    info.xml = clean_xml

    var $doc   = _xmldom_parser.parseFromString(clean_xml, 'text/xml')
    $doc.normalize()

    info.gln           = gdsn.dom.getNodeData($doc, '/registryPartyDataDumpDetail/registryParty/informationProviderOfParty/gln')
    info.name          = gdsn.dom.getNodeData($doc, '/registryPartyDataDumpDetail/registryParty/registryPartyInformation/partyRoleInformation/partyOrDepartmentName')
    info.country       = gdsn.dom.getNodeData($doc, '/registryPartyDataDumpDetail/registryParty/registryPartyInformation/registryPartyNameAndAddress/countryCode/countryISOCode')
    info.data_pool_gln = gdsn.dom.getNodeData($doc, '/registryPartyDataDumpDetail/registryPartyDates/registeringParty')
    var created_date_time = gdsn.dom.getNodeData($doc, '/registryPartyDataDumpDetail/registryPartyDates/registrationDateTime')
    info.created_ts    = (new Date(created_date_time)).getTime()

    return info
  }

  gdsn.dom.getNodeData = function ($doc, path, asArray) {
    var nodes = select(path, $doc)
    var values = nodes.map(function (node) {
      if (!node) return
      var value = node.firstChild && node.firstChild.data
      return value || node.value // for attributes
    })
    if (asArray) return values || []
    return (values && values[0]) || ''
  }

  gdsn.dom.setNodeData = function ($doc, path, value) {
    var nodes = select(path, $doc)
    if (nodes && nodes[0]) {
      nodes[0].firstChild.data = value
    }
  }

}

