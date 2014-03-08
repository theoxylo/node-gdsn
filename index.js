var select   = require('xpath.js')
var _        = require('underscore')
var xmldom   = require('xmldom')

var InfoStream    = require('./lib/InfoStream')
var ElementStream = require('./lib/ElementStream')

var _xmldom_parser = new xmldom.DOMParser()
var _xmldom_serializer = new xmldom.XMLSerializer()

module.exports = Gdsn

function Gdsn(opts) {

  if (!(this instanceof Gdsn)) return new Gdsn(opts)

  console.log('Creating new instance of Gdsn service')

  opts = opts || {}
  if (!opts.templatePath)    opts.templatePath = __dirname + '/templates'
  if (!opts.homeDataPoolGln) opts.homeDataPoolGln = '0000000000000'
  if (!opts.outbox_dir)      opts.outbox_dir = opts.out_dir || __dirname + '/outbox'

  console.log('GDSN options:')
  console.log(opts)

  if (!this.validateGln(opts.homeDataPoolGln)) {
    console.log('Error: invalid home data pool GLN: ' + opts.homeDataPoolGln)
    process.exit(1)
  }

  this.opts = opts
}

Gdsn.prototype.processCinFromOtherDp = function (cinInboundFile, cb) {

  var ts = new Date().getTime()
  var responseOutFile = this.opts.outbox_dir + '/out_cin_response_to_other_dp_'   + ts + '.xml'
  var forwardOutFile  = this.opts.outbox_dir + '/out_cin_forward_to_local_party_' + ts + '.xml'

  var self = this

  self.getXmlDomForFile(cinInboundFile, function(err, $cin) {
    if (err) throw err

    self.createCinResponse($cin, function(err, responseXml) {
      if (err) throw err

      self.writeFile(responseOutFile, responseXml, function(err) {
        if (err) throw err

        self.forwardCinFromOtherDP($cin, function(err, cinOut) {
          if (err) throw err

          self.writeFile(forwardOutFile, cinOut, function(err) {
            if (err) throw err
            if (cb) cb(null, 'cb: wrote files ' + responseOutFile + ' and ' + forwardOutFile)
          })
        })

      })
    })

  })
}

Gdsn.prototype.createCinResponse = function ($cin, cb) {
  var self = this
  process.nextTick(function () {
    try {
      var cinInfo = self.getMessageInfoForDom($cin)
      console.log('Gdsn().createCinResponse: cin msg info: ')
      console.log(cinInfo)

      if (cinInfo.type !== 'catalogueItemNotification') {
        self.handleErr(new Error('createCinResponse: message must be of type "catalogueItemNotification" and not: ' + cinInfo.type), cb)
        return
      }

      // check that receiver is the home data pool:
      if (cinInfo.receiver !== self.opts.homeDataPoolGln) {
        self.handleErr(new Error('createCinResponse: message must be addressed to home data pool GLN ' + self.opts.homeDataPoolGln), cb)
        return
      }

      var respTemplateFilename = self.opts.templatePath + '/GDSNResponse_template.xml'

      self.getXmlDomForFile(respTemplateFilename, function (err, $response) {
        if (self.handleErr(err, cb)) return

        cinInfo.resId = 'cin_resp_' + Date.now()
        self.populateResponseTemplate($response, cinInfo)

        var $eANUCCResponse = $response.createElement('gdsn:eANUCCResponse')
        $eANUCCResponse.setAttribute('responseStatus', 'ACCEPTED')

        var $sender = $response.createElement('sender')
        $sender.appendChild($response.createTextNode(cinInfo.sender))
        $eANUCCResponse.appendChild($sender)

        var $receiver = $response.createElement('receiver')
        $receiver.appendChild($response.createTextNode(cinInfo.receiver))
        $eANUCCResponse.appendChild($receiver)

        var cinTrxNodes = select($cin, '//*[local-name()="transaction"]/entityIdentification')

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

        self.getXmlStringForDom($response, cb)
      })
    }
    catch (err) {
      self.handleErr(err, cb)
    }
  })
}

Gdsn.prototype.populateResponseTemplate = function (dom, args) {
  // since it is our template, we know the literal namespace prefixes
  select(dom, '//sh:Sender/sh:Identifier')[0].firstChild.data = args.receiver
  select(dom, '//sh:Receiver/sh:Identifier')[0].firstChild.data = args.sender
  select(dom, '//sh:DocumentIdentification/sh:InstanceIdentifier')[0].firstChild.data = args.resId
  select(dom, '//sh:DocumentIdentification/sh:CreationDateAndTime')[0].firstChild.data = args.created_date_time
  select(dom, '//sh:Scope/sh:InstanceIdentifier')[0].firstChild.data = args.resId
  select(dom, '//sh:Scope/sh:CorrelationInformation/sh:RequestingDocumentCreationDateTime')[0].firstChild.data = args.created_date_time
  select(dom, '//sh:Scope/sh:CorrelationInformation/sh:RequestingDocumentInstanceIdentifier')[0].firstChild.data = args.msg_id
  select(dom, '//eanucc:message/entityIdentification/uniqueCreatorIdentification')[0].firstChild.data = args.resId
  select(dom, '//eanucc:message/entityIdentification/contentOwner/gln')[0].firstChild.data = args.receiver
}

Gdsn.prototype.forwardCinFromOtherDP = function ($cin, cb) {
  var self = this
  process.nextTick(function () {
    try {
      var cinInfo = self.getMessageInfoForDom($cin)

      // check that receiver is the home data pool:
      if (cinInfo.receiver !== self.opts.homeDataPoolGln) {
        self.handleErr(new Error('forwardCinFromOtherDP: message must be addressed to home data pool GLN ' + self.opts.homeDataPoolGln), cb)
        return
      }
      // set sender to home data pool
      select($cin, '//*[local-name()="Sender"]/*[local-name()="Identifier"]')[0].firstChild.data = self.opts.homeDataPoolGln

      // get data recipient (same for all transactions) and set new receiver gln
      var dataRecipient = select($cin, '//catalogueItem/dataRecipient')[0].firstChild.data
      console.log('Gdsn().forwardCinFromOtherDP: dataRecipient GLN: ' + dataRecipient)

      if (dataRecipient === self.opts.homeDataPoolGln) {
        self.handleErr(new Error('forwardCinFromOtherDP: dataRecipient must be a local party, not the data pool'), cb)
        return
      }

      select($cin, '//*[local-name()="Receiver"]/*[local-name()="Identifier"]')[0].firstChild.data = dataRecipient

      // update InstanceIdentifier and message uniqueCreatorIdentification/gln
      var newId = 'cin_' + Date.now() + '_' + dataRecipient
      select($cin, '//*[local-name()="DocumentIdentification"]/*[local-name()="InstanceIdentifier"]')[0].firstChild.data = newId
      select($cin, '//*[local-name()="message"]/entityIdentification/uniqueCreatorIdentification')[0].firstChild.data = newId
      select($cin, '//*[local-name()="message"]/entityIdentification/contentOwner/gln')[0].firstChild.data = self.opts.homeDataPoolGln

      // generate new CIN xml

      console.log('forwardCinFromOtherDP: newId: ' + newId)

      self.getXmlStringForDom($cin, cb)
    }
    catch (err) {
      self.handleErr(err, cb)
    }
  })
}

Gdsn.prototype.getXmlDomForString = function (xml, cb) {
  var self = this
  process.nextTick(function () {
    try {
      var $dom = _xmldom_parser.parseFromString(xml, 'text/xml')
      cb(null, $dom)
    }
    catch (err) {
      self.handleErr(err, cb)
    }
  })
}

Gdsn.prototype.getXmlDomForFile = function (filename, cb) {
  var self = this
  fs.readFile(filename, 'utf8', function (err, content) {
    if (self.handleErr(err, cb)) return
    console.log('Gdsn.getXmlDomForFile : read ' + filename + ' (' + Buffer.byteLength(content) + ' bytes)')
    self.getXmlDomForString(content, cb)
  })
}

Gdsn.prototype.writeFile = function (filename, content, cb) {
  var self = this
  fs.writeFile(filename, content, function (err) {
    if (self.handleErr(err, cb)) return
    console.log('Gdsn.writeFile: ' + filename + ' (' + Buffer.byteLength(content) + ' bytes)')
  })
}

Gdsn.prototype.handleErr = function (err, cb) {
  if (err) {
    process.nextTick(function () {
      cb(err)
    })
    return true
  }
  return false
}

Gdsn.prototype.getXmlStringForDom = function ($dom, cb) {
  var self = this
  process.nextTick(function () {
    try {
      var xml = _xmldom_serializer.serializeToString($dom)
      cb(null, xml)
    }
    catch (err) {
      self.handleErr(err, cb)
    }
  })
}

Gdsn.prototype.getTradeItemsFromFile = function (filename, cb) {
  console.log('Reading stream ' + filename)
  var is = fs.createReadStream(filename, {encoding: 'utf8'})
  this.getTradeItemsFromStream(is, cb)
}

Gdsn.prototype.getTradeItemsFromStream = function (is, cb) {
  var tradeItems = []
  this.getEachTradeItemFromStream(is, function (err, item) {
    if (err) return cb(err)
    if (!item) return cb(null, tradeItems)
    tradeItems.push(item)
  })
}

Gdsn.prototype.getEachTradeItemFromStream = function (is, cb) {

  var self = this

  var elements = new ElementStream('tradeItem')

  var msgInfo = new InfoStream(this.getMessageInfoFromString)

  msgInfo.on('info', function (err, msg_info) {
    if (err) return cb(err)
    console.log('%%% found msg info: ' + JSON.stringify(msg_info))

    // once we have the msg_info, we can start our node stream
    elements.on('element', function (xml) {
      console.log('tradeItem element xml length: ' + xml.length)
      var item_info = self.getTradeItemInfo(xml, msg_info)
      console.log('gtin: ' + item_info.gtin)
      cb(null, item_info)
    })
    elements.on('end', function () {
      cb(null, null) // all done
    })
    elements.on('error', function (err) {
      cb(err)
    })
  })

  is.pipe(msgInfo).pipe(elements).resume()
}

Gdsn.prototype.getMessageInfoForDom = function ($msg) {
  var info = {}
  info.sender     = select($msg, '//*[local-name()="Sender"]/*[local-name()="Identifier"]')[0].firstChild.data
  info.receiver   = select($msg, '//*[local-name()="Receiver"]/*[local-name()="Identifier"]')[0].firstChild.data
  info.msg_id     = select($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="InstanceIdentifier"]')[0].firstChild.data
  info.type       = select($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="Type"]')[0].firstChild.data
  info.created_date_time = select($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="CreationDateAndTime"]')[0].firstChild.data
  info.created_ts = (new Date(info.created_date_time)).getTime()

  var providerNodeList = select($msg, '//*[local-name()="informationProvider"]/*[local-name()="gln"]')
  if (providerNodeList && providerNodeList[0]) {
    info.provider = providerNodeList[0].firstChild.data
  }
  var recipientNodeList = select($msg, '//*[local-name()="dataRecipient"]')
  if (recipientNodeList && recipientNodeList[0]) {
    info.recipient = recipientNodeList[0].firstChild.data
  }
  return info
}

Gdsn.prototype.getTradeItemsForDom = function ($msg) {

  var msg_info = this.getMessageInfoForDom($msg)

  var $tradeItems = select($msg, '//*[local-name()="tradeItem"]')

  var tradeItems = []
  for (var idx = 0; idx < $tradeItems.length; idx++) {
    var $tradeItem = $tradeItems[idx]
    var xml = _xmldom_serializer.serializeToString($tradeItem)
    var info = this.getTradeItemInfo(xml, msg_info)
    tradeItems.push(info)
  }
  return tradeItems
}

Gdsn.prototype.getMessageInfoFromString = function (xml, info) {
  if (!info.msg_id) {
    var match = xml.match(/InstanceIdentifier>([^<\/]*)<\//)
    info.msg_id = match && match.length == 2 && match[1]
    if (info.msg_id) console.log('msg id: ' + info.msg_id)
  }
  if (!info.created_ts) {
    var match = xml.match(/CreationDateAndTime>([.0-9T:-]*)</)
    if (match && match[1]) {
      info.created_date_time = match[1]
      console.log('create date time: ' + info.created_date_time)
      info.created_ts = (new Date(info.created_date_time)).getTime()
      if (info.created_ts) console.log('create timestamp: ' + info.created_ts)
    }
  }
  if (!info.recipient) {
    var match = xml.match(/dataRecipient>(\d{13})</)
    info.recipient = match && match.length == 2 && match[1]
    if (info.recipient) console.log('data recipient: ' + info.recipient)
  }
  return (info.msg_id && info.created_ts && info.recipient)
}

Gdsn.prototype.getTradeItemInfo = function (raw_xml, msg_info) {

  //console.log('getTradeItemInfo called with created_ts ' + created_ts + ', recipient ' + recipient + ', msg_id ' + msg_id)

  var info = {}
  info.raw_xml    = raw_xml
  info.created_ts = msg_info.created_ts
  info.recipient  = msg_info.recipient
  info.msg_id     = msg_info.msg_id

  var clean_xml = this.clean_xml(raw_xml)
  info.xml = clean_xml

  var $newDoc   = _xmldom_parser.parseFromString(clean_xml, 'text/xml')
  $newDoc.normalize()

  info.gtin      = this.getNodeData($newDoc, '/tradeItem/tradeItemIdentification/gtin')
  info.provider  = this.getNodeData($newDoc, '/tradeItem/tradeItemInformation/informationProviderOfTradeItem/informationProvider/gln')
  info.tm        = this.getNodeData($newDoc, '/tradeItem/tradeItemInformation/targetMarketInformation/targetMarketCountryCode/countryISOCode')
  info.unit_type = this.getNodeData($newDoc, '/tradeItem/tradeItemUnitDescriptor')
  info.gpc       = this.getNodeData($newDoc, '/tradeItem/tradeItemInformation/classificationCategoryCode/classificationCategoryCode')
  info.brand     = this.getNodeData($newDoc, '/tradeItem/tradeItemInformation/tradeItemDescriptionInformation/brandName')
  info.tm_sub    = this.getNodeData($newDoc, '/tradeItem/tradeItemInformation/targetMarketInformation/targetMarketSubdivisionCode/countrySubDivisionISOCode')
  info.child_count = this.getNodeData($newDoc, '/tradeItem/nextLowerLevelTradeItemInformation/quantityOfChildren')
  info.child_gtins = this.getNodeData($newDoc, '/tradeItem/nextLowerLevelTradeItemInformation/childTradeItem/tradeItemIdentification/gtin', true)

  if (info.child_count != info.child_gtins.length) {
    console.log('WARNING: child count ' + info.child_count + ' does not match child gtins found: ' + info.child_gtins.join(', '))
  }

  return info
}

Gdsn.prototype.getNodeData = function ($doc, xpath, asArray) {
  var nodes = select($doc, xpath)
  var values = _.map(nodes, function (node) {
    if (!node) return
    return node.firstChild && node.firstChild.data
  })
  if (asArray) return values || []
  return (values && values[0]) || ''
}

Gdsn.prototype.clean_xml = function (raw_xml) {
  var match = raw_xml.match(/<[^]*>/) // match bulk xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  if (!match || !match[0]) return ''
  var clean_xml = match[0]
  clean_xml = clean_xml.replace(/>\s+</g, '><') // remove extra whitespace between tags
  clean_xml = clean_xml.replace(/<[-_a-z0-9]+[^:]:/g, '<')    // remove open tag ns prefix <abc:tag>
  clean_xml = clean_xml.replace(/<\/[-_a-z0-9]+[^:]:/g, '</') // remove close tag ns prefix </abc:tag>
  clean_xml = clean_xml.replace(/\s*xmlns:[^=\s]*\s*=\s*['"][^'"]*['"]/g, '') // remove xmlns:abc="123" ns attributes
  clean_xml = clean_xml.replace(/\s*[^:\s]*:schemaLocation\s*=\s*['"][^'"]*['"]/g, '') // remove abc:schemaLocation attributes
  return clean_xml
}

Gdsn.prototype.validateGln = function (gln) {
  if (!gln || gln.length != 13) return false

  var digits = gln.split('')
  var numbers = new Array(13)
  for (var idx = 0; idx < 13; idx++) {
    numbers[idx] = Number(digits[idx])
  }

  var sum1 = numbers[0] + numbers[2] + numbers[4] + numbers[6] + numbers[8] + numbers[10]
  var sum2 = numbers[1] + numbers[3] + numbers[5] + numbers[7] + numbers[9] + numbers[11]

  var checkDigit = ((sum2 * 3) + sum1) % 10

  if (checkDigit) {
      checkDigit = 10 - checkDigit
  }
  return checkDigit == numbers[12]
}

Gdsn.prototype.validateGtin = function (gtin) {
  if (!gtin || gtin.length != 14) return false

  var digits = gtin.split('')
  var numbers = new Array(14)
  for (var idx = 0; idx < 14; idx++) {
    numbers[idx] = Number(digits[idx])
  }

  var sum1 = numbers[0] + numbers[2] + numbers[4] + numbers[6] + numbers[8] + numbers[10] + numbers[12]
  var sum2 = numbers[1] + numbers[3] + numbers[5] + numbers[7] + numbers[9] + numbers[11]

  var checkDigit = ((sum1 * 3) + sum2) % 10

  if (checkDigit) {
      checkDigit = 10 - checkDigit
  }
  return checkDigit == numbers[13]
}

//////////////////////////////////// not yet used for anything: /////////////////////////

Gdsn.prototype.messageTypes = [
    {
        name: 'cin_from_local_tp',
        direction: 'inbound',
        description: 'can contain only one publication (item hierarchy)',
        doctype: 'catalogueItemNotification',
        created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
        sender: 'gln of local DSTP',
        receiver: 'gln of home data pool',
        dataRecipient: 'gln of home data pool',
        infoProvider: 'gln of DSTP (local party)',
        sourceDataPool: 'not present',
        root_gtins: 'array of gtins for each hierarchy root trade item',
        gtins: 'array of gtins for all trade items'
    },
    {
        name: 'cin_from_other_dp',
        direction: 'inbound',
        description: 'can contain many publications (item hierarchies) from a single DSTP, sent via partner SDP',
        doctype: 'catalogueItemNotification',
        created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
        sender: 'gln of other data pool',
        receiver: 'gln of home data pool',
        dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
        infoProvider: 'gln of DSTP (remote publishing party), assume only 1 per message',
        sourceDataPool: 'gln of other data pool',
        root_gtins: 'array of gtins for each hierarchy root trade item',
        gtins: 'array of gtins for all trade items'
    },
    {
        name: 'cin_to_local_tp_for_remote_ds',
        direction: 'outbound',
        description: 'can contain many publications (item hierarchies) from a single DSTP',
        doctype: 'catalogueItemNotification',
        created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
        sender: 'gln of home data pool',
        receiver: 'gln of local party',
        dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
        infoProvider: 'gln of DSTP (remote publishing party), assume only 1 per message',
        sourceDataPool: 'gln of other data pool',
        root_gtins: 'array of gtins for each hierarchy root trade item',
        gtins: 'array of gtins for all trade items'
    },
    {
        name: 'cin_to_local_tp_for_local_ds',
        direction: 'outbound',
        description: 'can contain only one publication (item hierarchy) from a local DSTP',
        doctype: 'catalogueItemNotification',
        created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
        sender: 'gln of home data pool',
        receiver: 'gln of local party',
        dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
        infoProvider: 'gln of DSTP (local publishing party), assume only 1 per message',
        sourceDataPool: 'gln of home data pool',
        root_gtins: 'array of gtins for each hierarchy root trade item',
        gtins: 'array of gtins for all trade items'
    }
]
