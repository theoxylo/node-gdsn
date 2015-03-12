var fs          = require('fs')
var cheerio     = require('cheerio')
var ItemStream  = require('./lib/ItemStream.js')
var PartyStream = require('./lib/PartyStream.js')
var ItemInfo    = require('./lib/ItemInfo.js')
var MessageInfo = require('./lib/MessageInfo.js')
var PartyInfo   = require('./lib/PartyInfo.js')
var xpath_dom   = require('./lib/xpath_dom.js')
var log         = console.log

var Gdsn = module.exports = function (config) {

  if (!(this instanceof Gdsn)) return new Gdsn(config)

  config = config || {clean_newline: true}
  log = config.log || log
  if (!config.templatePath)    config.templatePath    = __dirname + '/templates'
  if (!config.homeDataPoolGln) config.homeDataPoolGln = '0000000000000'
  if (!config.outbox_dir)      config.outbox_dir      = config.out_dir || __dirname + '/outbox'

  if (!Gdsn.validateGln(config.homeDataPoolGln)) {
    log('Error: invalid home data pool GLN: ' + config.homeDataPoolGln)
    process.exit(1)
  }

  // pre-load xml message templates
  this.loadTemplatesSync(config.templatePath)

  this.config = config
  config.gdsn = this

  this.dom = xpath_dom

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

///////////////////////// utilities:

Gdsn.validateGln = Gdsn.prototype.validateGln = function (gln) {
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

Gdsn.validateGtin = Gdsn.prototype.validateGtin = function (gtin) {
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
  console.log('gtin check-digit: ' + checkDigit)
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
  log('msg_info xml size : ' + msg_info.xml.length)
  log('msg_info party cnt: ' + msg_info.party.length)
  log('msg_info item cnt : ' + msg_info.item.length)
  log('msg_info pub count: ' + msg_info.pub.length)
  log('msg_info sub count: ' + msg_info.sub.length)
  log('msg_info gtin     : ' + msg_info.gtin)
  log('msg_info gtins    : ' + msg_info.gtins.join(' '))
  log('msg_info doc_count: ' + msg_info.doc_count)
  log('msg_info trx      : ' + msg_info.trx.join(','))
}

Gdsn.prototype.get_msg_info = function (xml) {
  log('gdsn msg_string_to_msg_info called with xml length ' + xml.length)
  var trimmed_xml = Gdsn.trim_xml(xml)
  return new MessageInfo(trimmed_xml, this.config) // parse 2.8 or 3.1 message for essential properties, really it's synchronous!
}

Gdsn.prototype.raw_party_string_to_party_info = function (xml, msg_info) {
  //log('raw_party_string_to_party_info called with xml length ' + xml.length)
  var trimmed_xml   = Gdsn.trim_xml(xml)
  var clean_xml     = Gdsn.clean_xml(trimmed_xml)
  var party_info    = new PartyInfo(clean_xml, msg_info)
  party_info.xml    = trimmed_xml // replace saved clean xml with trimmed xml
  party_info.msg_id = msg_info.msg_id
  return party_info
}

Gdsn.prototype.loadTemplatesSync = function (path) {
  this.templates = {}
  this.templates.response  = fs.readFileSync(path + '/gdsn3/GS1Response.xml')
  this.templates.bpr_to_gr = fs.readFileSync(path + '/gdsn3/BPR_to_GR.xml')
  this.templates.cis_to_gr = fs.readFileSync(path + '/gdsn3/CIS.xml')
  this.templates.rci_to_gr = fs.readFileSync(path + '/gdsn3/RCI.xml')
  console.log('All gdsn templates read without errors')
}

Gdsn.prototype.populateResponseToSender = function (config, msg_info) {
  var $ = cheerio.load(this.templates.response, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })
  var resp_id = 'RESP_' + Date.now() + '_' + msg_info.msg_id

  $('sh\\:Sender > sh\\:Identifier').text(msg_info.receiver)
  $('sh\\:Receiver > sh\\:Identifier').text(msg_info.sender)
  $('sh\\:DocumentIdentification > sh\\:InstanceIdentifier').text(resp_id)
  $('sh\\:DocumentIdentification > sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)

  $('sh\\:Scope > sh\\:InstanceIdentifier').text(resp_id)
  $('sh\\:Scope > sh\\:CorrelationInformation > sh\\:RequestingDocumentInstanceIdentifier').text(msg_info.msg_id)


  $('gS1Response > originatingMessageIdentifier > entityIdentification').text(msg_info.msg_id)
  $('gS1Response > receiver').text(msg_info.sender)
  $('gS1Response > sender').text(msg_info.receiver)

  // remove trx response and start with exception message
  var $trx_resp = $('gS1Response > transactionResponse').remove()

  // populate exception response if needed
  if (msg_info.status == 'ERROR') {
    $('gS1Response > gS1Exception > messageException > gS1Error > errorDateTime').text(new Date().toISOString())
    $('gS1Response > gS1Exception > messageException > gS1Error > errorDescription').text(msg_info.exception)
  }
  else if (msg_info.trx && msg_info.trx.length) {
    // generate a list of transactionResponse elements
    msg_info.trx.forEach(function (trx_id) {
      var $trx = $trx_resp.clone()
      $('transactionIdentifier > entityIdentification', $trx).text(trx_id)
      $('gS1Response').append($trx)
    })
    $('gS1Response > gS1Exception').remove() // remove unused exception template
  }

  return $.html()
}


// the original BPR must be sent by the party to their own data pool, 
// then a BPR to GR is created from clean template using key values
Gdsn.prototype.populateBprToGr = function (config, msg_info) {
  log('populateBprToGr from party bpr with msg_id: ' + msg_info.msg_id)
  var $ = cheerio.load(this.templates.bpr_to_gr, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })
  // instance ID something like 'BPR_to_GR_1425055673689_ADD_1100001011292'
  var msg_id = 'BPR_to_GR_' + Date.now() + '_' + msg_info.status + '_' + msg_info.sender 

  $('sh\\:Sender sh\\:Identifier').text(msg_info.receiver)
  $('sh\\:Receiver sh\\:Identifier').text(config.gdsn_gr_gln)
  $('sh\\:InstanceIdentifier').text(msg_id)
  $('sh\\:CreationDateAndTime, creationDateTime, lastUpdateDateTime, processCapabilityEffectiveStartDateTime')
   .text(new Date().toISOString()) // when this message is created by DP (right now)

  // all 3 entity ids will have the same owner, also used as data pool
  $('partyDataPool, transmittingDataPool, registeringParty').text(msg_info.receiver) // the data pool
  $('transactionIdentification > entityIdentification').text(msg_id + '_trx1')
  $('documentCommandIdentification > entityIdentification').text(msg_id + '_trx1_cmd1')
  $('basicPartyRegistrationIdentification > entityIdentification').text(msg_id + '_trx1_cmd1_doc1')

  if (msg_info.status != 'ADD') {
    $('documentCommand > documentCommandHeader').attr('type', msg_info.status)
  }

  var party = msg_info.party
  if (party) {
    $('partyInRole > partyName')        .text(party.name)
    $('partyInRole > partyRoleCode')    .text(party.role)

    $('partyAddress > city')            .text(party.city)
    $('partyAddress > countryCode')     .text(party.tm)
    $('partyAddress > name')            .text(party.name)
    $('partyAddress > postalCode')      .text(party.zip)
    $('partyAddress > state')           .text(party.state)
    $('partyAddress > streetAddressOne').text(party.address1)
    $('partyAddress > streetAddressTwo').text(party.address2)
  }

  $('partyContact, partyCapability').remove() // TODO

  return $.html()
}

Gdsn.prototype.populateCisToGr= function (config, msg_info) {
    log('populateCisToGr')
    var $ = cheerio.load(this.templates.cis_to_gr, { 
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
    $('transactionIdentification > entityIdentification').text(msg_info.msg_id + '_trx1')

    $('documentCommandIdentification > entityIdentification').text(msg_info.msg_id + '_trx1_cmd1')

    $('documentCommand > documentCommandHeader').attr('type', msg_info.status) // set // ADD, DELETE

    // SINGLE doc support:
    $('creationDateTime').text(new Date(msg_info.created_ts).toISOString())
    $('catalogueItemSubscriptionIdentification > entityIdentification').text(msg_info.msg_id + '_trx1_cmd1_doc1')
    $('dataRecipient').text(msg_info.recipient)

    //optional subscription criteria:
    if (msg_info.provider) $('dataSource').text(msg_info.provider)
    else $('dataSource').remove()

    if (msg_info.gpc) $('gpcCategoryCode').text(msg_info.gpc)
    else $('gpcCategoryCode').remove()

    if (msg_info.gtin) $('gtin').text(msg_info.provider)
    else $('gtin').remove()

    $('targetMarket').remove() // subscription to TM is NOT supported :)

    return $.html()
}

Gdsn.prototype.populateRciToGr = function (config, msg_info) {
  log('populateRciToGr')
  var $ = cheerio.load(this.templates.rci_to_gr, { 
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
  $('transactionIdentification > entityIdentification').text(msg_id + '_trx1')

  $('documentCommandIdentification > entityIdentification').text(msg_id + '_trx1_cmd1')

  $('documentCommand > documentCommandHeader').attr('type', msg_info.status) // set // ADD, DELETE

  // SINGLE doc support:
  $('creationDateTime').text(new Date(msg_info.created_ts).toISOString())
  $('registryCatalogueItemIdentification > entityIdentification').text(msg_id + '_trx1_cmd1_doc1')

  $('gpcCatagoryCode').text(msg_info.gpc)
  $('sourceDataPool').text(config.homeDataPoolGln)

  $('catalogueItemReference > dataSource').text(msg_info.provider)
  $('catalogueItemReference > gtin').text(msg_info.gtin)
  $('catalogueItemReference > targetMarketCountryCode').text(msg_info.tm)

  $('catalogueItemDates > lastChangedDateTime').text(new Date().toISOString())
  $('catalogueItemDates > registrationDateTime').text(new Date().toISOString())

  return $.html()
}

Gdsn.prototype.populateCicToTp = function (config, msg_info, cb) {
  cb(Error('not yet implemented'))
}

// removes extra whitespace between tags, but adds a new line for easy diff later
Gdsn.prototype.trim_xml = Gdsn.trim_xml = function (xml) {
  // match xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  var match = xml.match(/<[^]*>/) 
  var result = match && match[0]
  if (!result || !result.length) return ''
  result = result.replace(/>\s*</g, '><') // remove extra whitespace between tags
  result = result.replace(/></g, '>\n<')  // add line return between tags
  return result
}

// removes all namespace information
Gdsn.prototype.clean_xml = Gdsn.clean_xml = function (xml) {
  if (!xml || !xml.length) return ''
  xml = xml.replace(/<[^\/>][-_a-zA-Z0-9]*[^:>]:/g, '<')                   // remove open tag ns prefix <abc:tag>
  xml = xml.replace(/<\/[^>][-_a-zA-Z0-9]*[^:>]:/g, '<\/')                 // remove close tag ns prefix </abc:tag>
  xml = xml.replace(/\s*xmlns:[^=\s]*\s*=\s*['"][^'"]*['"]/g, '')          // remove xmlns:abc="123" ns attributes
  xml = xml.replace(/\s*[^:\s]*:schemaLocation\s*=\s*['"][^'"]*['"]/g, '') // remove abc:schemaLocation attributes
  return xml
}
