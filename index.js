var fs          = require('fs')
var cheerio     = require('cheerio')
var ItemStream  = require('./lib/ItemStream.js')
var PartyStream = require('./lib/PartyStream.js')
var ItemInfo    = require('./lib/ItemInfo.js')
var MessageInfo = require('./lib/MessageInfo.js')
var PartyInfo   = require('./lib/PartyInfo.js')
var log         = console.log

module.exports = Gdsn = function (config) {

  if (!(this instanceof Gdsn)) return new Gdsn(config)

  config = config || {clean_newline: true}
  log = config.log || log
  if (!config.templatePath)    config.templatePath    = __dirname + '/templates'
  if (!config.homeDataPoolGln) config.homeDataPoolGln = '0000000000000'
  if (!config.outbox_dir)      config.outbox_dir      = config.out_dir || __dirname + '/outbox'

  if (!this.validateGln(config.homeDataPoolGln)) {
    log('Error: invalid home data pool GLN: ' + config.homeDataPoolGln)
    process.exit(1)
  }

  this.config = config
  config.gdsn = this

  this.dom = require('./lib/xpath_dom.js')

  this.itemStream = new ItemStream(this)
  this.partyStream = new PartyStream(this)
}

// stream extract methods

Gdsn.prototype.getEachTradeItemFromStream = function (is, cb) {
  this.itemStream.getEachTradeItem(is, cb)
}

Gdsn.prototype.getEachPartyFromStream = function (is, cb) {
  this.partyStream.getEachParty(is, cb)
}

// legacy dom approach for extracting item and party info:

Gdsn.prototype.getTradeItemInfo = function (xml, msg_info) {
  return this.dom.getTradeItemInfo(xml, msg_info)
}

Gdsn.prototype.getPartyInfo = function (xml, msg_info) {
  return this.dom.getPartyInfo(xml, msg_info)
}

/////////////////////////


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


//// new cheerio dom approach, like jquery ////
// compare: 
// cheerio: var type = $('DocumentIdentification Type').text()
// xpath:   var type = this.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="Type"]')
// however, the cheerio version must not have namespace prefixes! so we clean the xml first

Gdsn.prototype.log_msg_info = function (msg_info) {
  log('msg_info msg_id   : ' + msg_info.msg_id)
  log('msg_info version  : ' + msg_info.version)
  log('msg_info type     : ' + msg_info.msg_type)
  log('msg_info note     : ' + msg_info.note)
  log('msg_info status   : ' + msg_info.status)
  log('msg_info sender   : ' + msg_info.sender)
  log('msg_info receiver : ' + msg_info.receiver)
  log('msg_info provider : ' + msg_info.provider)
  log('msg_info recipient: ' + msg_info.recipient)
  log('msg_info xml size : ' + (msg_info.xml && msg_info.xml.length))
  log('msg_info party    : ' + msg_info.party)
  log('msg_info parties  : ' + (msg_info.parties && msg_info.parties.join(' ')))
  log('msg_info gtin     : ' + msg_info.gtin)
  log('msg_info gtins    : ' + (msg_info.gtins && msg_info.gtins.join(' ')))
  log('msg_info doc_count: ' + msg_info.doc_count)
  log('msg_info doc_ids  : ' + (msg_info.doc_ids && msg_info.doc_ids .join(' ')))
}

/*
Gdsn.prototype.get_cin_action(msg_info) {

  if (msg_info.msg_type == 'catalogueItemNotification') {

    var source_dp = msg_info.source_dp
    var recipient = msg_info.recipient

    if (!source_dp) { 
      source_dp = '0000000000000'
      console.log('source_dp not found, using placeholder value ' + source_dp)
    }

    // there are 4 subtypes of CIN, 2 _from_ homde DP...
    if (msg_info.sender == this.config.homeDataPoolGln) { // from home DP
      if (msg_info.receiver == msg_info.recipient) {
        console.log('>>> subscribed item forwarded from home DP to local TP')
      }
      else {
        console.log('>>> subscribed item forwarded from home DP to other DP for remote TP')
      }
    }
    // ...and 2 more _to_ home DP, these are repostable to DP
    else if (msg_info.receiver == this.config.homeDataPoolGln) { // to home DP
      if (msg_info.sender == msg_info.provider) { // from local TP
        if (msg_info.provider == msg_info.recipient) { // 3. from TP (private draft item)
          console.log('>>> private draft item from local TP')
        }
        else if (this.config.homeDataPoolGln == msg_info.recipient) {
          console.log('>>> item registration/update attempt from local TP')
        }
      }
      else { // from other dp
        console.log('>>> subscribed item received from other DP for local TP')
      }
    }
  } // end CIN inspection
}
*/

// works with XML for complete message, could be many documents (item hierarchies)
Gdsn.prototype.msg_string_to_msg_info = function (xml, cb) {
  log('gdsn msg_string_to_msg_info called with xml length ' + xml.length)
  var self = this
  setImmediate(function () {
    try {
      var trimmed_xml = self.trim_xml(xml)
      var msg_info = new MessageInfo(trimmed_xml, self.config) // parse 2.8 or 3.1 message for essential properties
      /*
      if (msg_info.msg_type == 'StandardBusinessDocument') { // and fallback to 2.8 if detected
        var cleaned_xml = self.clean_xml(trimmed_xml)
        msg_info = new MessageInfo(cleaned_xml, self.config)
      }
      */
      /*
      var trimmed_xml = self.trim_xml(xml)
      var cleaned_xml = self.clean_xml(trimmed_xml)
      var msg_info = self.get_message_info(cleaned_xml)
      */
      msg_info.xml = trimmed_xml
      msg_info.xml_length = trimmed_xml.length
      self.log_msg_info(msg_info)
      cb(null, msg_info)
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.item_string_to_item_info = function (xml, msg_info, cb) {
  log('gdsn item_string_to_item_info called with raw xml length ' + xml.length)
  var self = this
  setImmediate(function () {
    try {
      var trimmed_xml   = self.trim_xml(xml)
      var item_info = new ItemInfo(trimmed_xml)
      item_info.xml = trimmed_xml

      log('new item_info msg_id: ' + item_info.msg_id)

      if (item_info) cb(null, item_info)
      else cb(Error('could not derive item_info from xml: ' + xml))
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.party_string_to_party_info = function (xml, msg_info) {
  //log('party_string_to_party_info called with xml length ' + xml.length)
  var trimmed_xml   = this.trim_xml(xml)
  var clean_xml     = this.clean_xml(trimmed_xml)
  var party_info    = new PartyInfo(clean_xml, this.config)
  party_info.xml    = trimmed_xml // replace saved clean xml with trimmed xml
  party_info.msg_id = msg_info.msg_id
  return party_info
}

Gdsn.prototype.populateResponseTemplate = function (config, msg_info, cb) {
  fs.readFile(config.templatePath + '/gdsn3/GS1Response.xml', function (err, xml) {
    if (err) return cb(err)
    try {
      var $ = require('cheerio').load(xml, { 
        _:0
        , normalizeWhitespace: true
        , xmlMode: true
      })
      $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)
      //$('sh\\:CreationDateAndTime').text(new Date(msg_info.created_ts).toISOString())
      $('sh\\:Sender sh\\:Identifier').text(config.homeDataPoolGln)
      $('sh\\:Receiver sh\\:Identifier').text(msg_info.sender)

      //$('sh\\:InstanceIdentifier').text('RESP_' + Date.now() + '_' + msg_info.msg_id)
      var msg_id = 'RESP_' + Date.now() + '_' + msg_info.msg_id
      $('sh\\:InstanceIdentifier').text(msg_id)

      $('sh\\:RequestingDocumentInstanceIdentifier').text(msg_info.msg_id)
      $('originatingMessageIdentifier entityIdentification').text(msg_info.msg_id)
      $('originatingMessageIdentifier contentOwner gln').text(msg_info.sender)
      $('gS1Response receiver').text(msg_info.sender)
      $('gS1Response sender').text(config.homeDataPoolGln)
      $('transactionIdentifier entityIdentification').text('TRX_' + Date.now())
      $('transactionIdentifier contentOwner gln').text(config.homeDataPoolGln)
      cb(null, $.html())
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.populateBprToGrTemplate = function (config, msg_info, cb) {
  cb(Error('not yet implemented'))
}

Gdsn.prototype.populateCicTemplate = function (config, msg_info, cb) {
  cb(Error('not yet implemented'))
}

Gdsn.prototype.populateCisToGrTemplate = function (config, msg_info, cb) {
  fs.readFile(config.templatePath + '/gdsn3/CIS.xml', function (err, xml) {
    log('populateCisToGrTemplate ')
    if (err) return cb(err)
    try {
      var $ = require('cheerio').load(xml, { 
        _:0
        , normalizeWhitespace: true
        , xmlMode: true
      })

      // new values for this message
      $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)
      $('sh\\:Sender sh\\:Identifier').text(config.homeDataPoolGln)
      $('sh\\:Receiver sh\\:Identifier').text(config.gdsn_gr_gln)

      $('sh\\:InstanceIdentifier').text('CIS_to_GR_' + Date.now() + '_' + msg_info.recipient)


      // original values from tp: trx/cmd/doc id and owner glns, created ts
      // assume naming convention based on original msg_id and only support single doc
      $('transactionIdentification contentOwner gln').text(msg_info.recipient)
      $('transactionIdentification entityIdentification').text(msg_info.msg_id + '_trx1')

      $('documentCommandIdentification  contentOwner gln').text(msg_info.recipient)
      $('documentCommandIdentification entityIdentification').text(msg_info.msg_id + '_trx1_cmd1')

      $('documentCommand documentCommandHeader').attr('type', msg_info.status) // set // ADD, DELETE

      // should be for each subscription document! up to 100 per CIS message
      //$('catalogueItemSubscriptionIdentification entityIdentification').text(msg_info.doc_ids[0])

      // SINGLE doc support:
      $('creationDateTime').text(new Date(msg_info.created_ts).toISOString())
      $('catalogueItemSubscriptionIdentification contentOwner gln').text(msg_info.recipient) // subscriber
      $('catalogueItemSubscriptionIdentification entityIdentification').text(msg_info.msg_id + '_trx1_cmd1_doc1')
      $('dataRecipient').text(msg_info.recipient)

      //optional subscription criteria:
      if (msg_info.provider) $('dataSource').text(msg_info.provider)
      else $('dataSource').remove()

      if (msg_info.gpc) $('gpcCategoryCode').text(msg_info.gpc)
      else $('gpcCategoryCode').remove()

      if (msg_info.gtin) $('gtin').text(msg_info.provider)
      else $('gtin').remove()

      $('targetMarket').remove() // subscription to TM is NOT supported :)

      cb(null, $.html())
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.populateRciToGrTemplate = function (config, msg_info, cb) {
  fs.readFile(config.templatePath + '/gdsn3/RCI.xml', function (err, xml) {
    log('populateRciToGrTemplate ')
    if (err) return cb(err)
    try {
      var $ = require('cheerio').load(xml, { 
        _:0
        , normalizeWhitespace: true
        , xmlMode: true
      })

      // new values for this message
      $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)
      $('sh\\:Sender sh\\:Identifier').text(config.homeDataPoolGln)
      $('sh\\:Receiver sh\\:Identifier').text(config.gdsn_gr_gln)

      var msg_id = 'RCI_to_GR_' + Date.now() + '_' + msg_info.provider
      $('sh\\:InstanceIdentifier').text(msg_id)


      // new message values for dp: trx/cmd/doc id and owner glns, created ts
      // assume naming convention based oon original msg_id and only support single doc
      $('transactionIdentification contentOwner gln').text(config.homeDataPoolGln)
      $('transactionIdentification entityIdentification').text(msg_id + '_trx1')

      $('documentCommandIdentification  contentOwner gln').text(config.homeDataPoolGln)
      $('documentCommandIdentification entityIdentification').text(msg_id + '_trx1_cmd1')

      $('documentCommand documentCommandHeader').attr('type', msg_info.status) // set // ADD, DELETE

      // SINGLE doc support:
      $('creationDateTime').text(new Date(msg_info.created_ts).toISOString())
      $('registryCatalogueItemIdentification contentOwner gln').text(config.homeDataPoolGln)
      $('registryCatalogueItemIdentification entityIdentification').text(msg_id + '_trx1_cmd1_doc1')

      $('gpcCatagoryCode').text(msg_info.gpc)
      $('sourceDataPool').text(config.homeDataPoolGln)

      $('catalogueItemReference dataSource').text(msg_info.provider)
      $('catalogueItemReference gtin').text(msg_info.gtin)
      $('catalogueItemReference targetMarketCountryCode').text(msg_info.tm)

      $('catalogueItemDates lastChangedDateTime').text(new Date().toISOString())
      $('catalogueItemDates registrationDateTime').text(new Date().toISOString())

      cb(null, $.html())
    }
    catch (err) {
      cb(err)
    }
  })
}

// removes extra whitespace between tags, but adds a new line for easy diff later
Gdsn.prototype.trim_xml = function (xml) {
  var match = xml.match(/<[^]*>/) // match bulk xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  if (!match || !match[0] || !match[0].length) {
    console.log('WARNING could not parse string as xml: ' + xml)
    return ''
  }
  var result = match[0]
  result = result.replace(/>\s*</g, '><') // remove extra whitespace between tags
  result = result.replace(/></g, '>\n<')  // add line return between tags
  return result
}

// removes all namespace information
Gdsn.prototype.clean_xml = function (xml, do_trim) {
  if (!xml || !xml.length) return ''
  xml = xml.replace(/<[^\/>][-_a-zA-Z0-9]*[^:>]:/g, '<')                   // remove open tag ns prefix <abc:tag>
  xml = xml.replace(/<\/[^>][-_a-zA-Z0-9]*[^:>]:/g, '<\/')                 // remove close tag ns prefix </abc:tag>
  xml = xml.replace(/\s*xmlns:[^=\s]*\s*=\s*['"][^'"]*['"]/g, '')          // remove xmlns:abc="123" ns attributes
  xml = xml.replace(/\s*[^:\s]*:schemaLocation\s*=\s*['"][^'"]*['"]/g, '') // remove abc:schemaLocation attributes
  return xml
}

Gdsn.prototype.get_trade_items_info = function (xml) {
  var msg_info = {
    tradeItems: []
    , gtins   : []
  }
  if (!xml || !xml.length) return msg_info

  var $ = cheerio.load(xml, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })
  var $root = $(':root')
  if (!$root) return msg_info

  msg_info.msg_id   = $('DocumentIdentification > InstanceIdentifier').text()
  msg_info.version  = $('DocumentIdentification > TypeVersion').text()
  msg_info.msg_type = $('DocumentIdentification > Type').text()
  msg_info.status   = $('documentCommandHeader').attr('type')
  msg_info.sender   = $('Sender > Identifier').text()
  msg_info.receiver = $('Receiver > Identifier').text()
  msg_info.provider = $('informationProviderOfTradeItem > gln').first().text()
  msg_info.recipient = $('dataRecipient').first().text()

  log('msg_info msg_id   : ' + msg_info.msg_id)
  log('msg_info version  : ' + msg_info.version)
  log('msg_info type     : ' + msg_info.msg_type)
  log('msg_info status   : ' + msg_info.status)
  log('msg_info sender   : ' + msg_info.sender)
  log('msg_info receiver : ' + msg_info.receiver)
  log('msg_info provider : ' + msg_info.provider)
  log('msg_info recipient: ' + msg_info.recipient)

  $('catalogueItem > tradeItem').each(function () {

    var $ti = $(this)
    console.log('transaction: ' + $ti.closest('transaction').text())

    var $ud = $('tradeItemUnitDescriptorCode', this)          // 3.1
    if (!$ud.length) $ud = $('tradeItemUnitDescriptor', this) // 2.8
    console.log('unit descriptor: ' + $ud.text())

    var $gtin = $('tradeItem > gtin', this).first()                              // 3.1
    if (!$gtin.length) $gtin = $('tradeItemIdentification > gtin', this).first() // 2.8
    var gtin = $gtin.text()
    console.log('gtin: ' + $gtin.text())

    var $gtin = $('gtin', this).each(function () {
      console.log('gtin element type: ' + this.parent.name)
    })

    if (gtin) msg_info.gtins.push(gtin)
  })

  log('msg_info xml size : ' + (msg_info.xml && msg_info.xml.length))
  log('msg_info party    : ' + msg_info.party)
  log('msg_info parties  : ' + (msg_info.parties && msg_info.parties.join(' ')))
  log('msg_info gtin     : ' + msg_info.gtin)
  log('msg_info gtins    : ' + (msg_info.gtins && msg_info.gtins.join(' ')))
  log('msg_info doc_count: ' + msg_info.doc_count)
  log('msg_info doc_ids  : ' + (msg_info.doc_ids && msg_info.doc_ids .join(' ')))

  return msg_info
}
