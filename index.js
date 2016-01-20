var fs            = require('fs')
var _             = require('underscore')
var cheerio       = require('cheerio')
var ItemStream    = require('./lib/ItemStream.js')
var PartyStream   = require('./lib/PartyStream.js')
var TradeItemInfo = require('./lib/TradeItemInfo.js')
var MessageInfo   = require('./lib/MessageInfo.js')
var PartyInfo     = require('./lib/PartyInfo.js')

var log    = console.log
var config = {clean_newline: true}

var Gdsn = module.exports = function (x_config) {

  if (!(this instanceof Gdsn)) return new Gdsn(x_config)

  this.config = config = x_config || config  
  this.log = log = config.log || log // config arg may have its own version of log
  if (!config.templatePath)    config.templatePath    = __dirname + '/templates'
  if (!config.homeDataPoolGln) config.homeDataPoolGln = '0000000000000'
  if (!config.outbox_dir)      config.outbox_dir      = config.out_dir || __dirname + '/outbox'

  if (!Gdsn.validateGln(config.homeDataPoolGln)) {
    log('Error: invalid home data pool GLN: ' + config.homeDataPoolGln)
    process.exit(1)
  }

  // pre-load xml message templates
  this.loadTemplatesSync(config.templatePath)

  config.gdsn = this

  this.itemStream = new ItemStream(this)
  this.partyStream = new PartyStream(this)

  Gdsn.prototype.cin_builder_28            = require('./lib/create_cin_28.js')(cheerio, this)
  Gdsn.prototype.cin_builder_31            = require('./lib/create_cin_31.js')(cheerio, this)
  Gdsn.prototype.forward_cin_to_subscriber = require('./lib/forward_cin_to_subscriber.js')(cheerio, this)
  Gdsn.prototype.convert_tradeItem_28_31   = require('./lib/tradeItem_upgrade_28_31.js')(cheerio, this)
  Gdsn.prototype.create_tp_item_rci_28     = require('./lib/rci_28.js')(cheerio, this)
}

Gdsn.prototype.create_cin = function create_cin_detect_version(items, receiver, command, reload, docStatus, sender) {
  var cin = ''
  try {
    if (items[0].tradeItem.gtin || config.cin_31_only) // 3.1 has short gtin xpath
      cin = this.cin_builder_31(items, receiver, command, reload, docStatus, sender) 
    else
      cin = this.cin_builder_28(items, receiver, command, reload, docStatus, sender)
  }
  catch (err) {
    console.log(err)
  }
  console.log('created new CIN XML with length ' + cin.length)
  return cin
}

Gdsn.prototype.get_msg_info = function (xml) {
  log('gdsn get_msg_info called with xml length ' + xml.length)
  return new MessageInfo(Gdsn.trim_xml(xml), config) 
}

Gdsn.prototype.getTradeItemInfo = function (xml, msg_info) {
  return new TradeItemInfo(Gdsn.trim_xml(xml), config) // cheerio
}

Gdsn.prototype.get_party_info = function (xml, msg_info) {
  return new PartyInfo(Gdsn.trim_xml(xml), msg_info)
}

Gdsn.prototype.getPartyInfo = function (xml, msg_info) {
  return this.get_party_info(xml, msg_info) // cheerio
}

// stream extract methods

Gdsn.prototype.getEachTradeItemFromStream = function (is, cb) {
  this.itemStream.getEachTradeItem(is, cb)
}

Gdsn.prototype.getEachPartyFromStream = function (is, cb) {
  this.partyStream.getEachParty(is, cb)
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
  //log('gtin check-digit: ' + checkDigit)
  return checkDigit == numbers[13]
}


//// new cheerio dom approach, like jquery ////
// compare: 
// cheerio: var type = $('DocumentIdentification Type').text()
// xpath:   var type = this.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="Type"]')
// however, the cheerio version must not have namespace prefixes! so we clean the xml first

Gdsn.prototype.log_msg_info = function (msg) {
  log('msg_id   : ' + msg.msg_id)
  log('version  : ' + msg.version)
  log('type     : ' + msg.msg_type)
  log('note     : ' + msg.note)
  log('status   : ' + msg.status)
  log('sender   : ' + msg.sender)
  log('receiver : ' + msg.receiver)
  log('provider : ' + msg.provider)
  log('recipient: ' + msg.recipient)
  log('xml size : ' + msg.xml && msg.xml.length)
  log('gtin     : ' + msg.gtin)
  log('gtins    : ' + msg.gtins && msg.gtins.join(' '))
  log('trx      : ' + msg.trx && msg.trx.join(','))
  log('source_dp: ' + msg.source_dp)
  log('recipient_dp: ' + msg.recipient_dp)
  log('data (pub,sub,item,cic,party) count: ' + msg.data && msg.data.length)
}

Gdsn.prototype.loadTemplatesSync = function (path) {
  this.templates = {}
  this.templates.response    = fs.readFileSync(path + '/gdsn3/GS1Response.xml')
  this.templates.bpr_to_gr   = fs.readFileSync(path + '/gdsn3/BPR.xml')
  this.templates.cis_to_gr   = fs.readFileSync(path + '/gdsn3/CIS.xml')
  this.templates.rfcin_to_gr = fs.readFileSync(path + '/gdsn3/RFCIN.xml')
  this.templates.rci_to_gr_3 = fs.readFileSync(path + '/gdsn3/RCI.xml')
  this.templates.cin_31      = fs.readFileSync(path + '/gdsn3/CIN.xml')
  this.templates.ti_31       = fs.readFileSync(path + '/gdsn3/tradeItem.xml')
  this.templates.cic_to_pub  = fs.readFileSync(path + '/gdsn3/CIC.xml')
  this.templates.cihw_to_rdp = fs.readFileSync(path + '/gdsn3/CIHW.xml')

  // legacy 2.8 support
  this.templates.cin_28      = fs.readFileSync(path + '/gdsn2/CIN.xml')
  this.templates.rci_to_gr_2 = fs.readFileSync(path + '/gdsn2/RCI.xml')

  log('All gdsn templates read without errors')
}

// note that the req_msg_info argument is for the message we are responding to!
// after we generate the response XML, it can have its own req_msg_info instance
// Note: trxOwner is the gln of the TP (DS or DR) initiating the gdsn conversation
// .e.g. for CIN from SDP to RDP, trxOwner would be DS/publisher and same for following CIC
Gdsn.prototype.populateResponseToSender = function (err_msg, req_msg_info, trxOwner) { // 3.1
  var $ = cheerio.load(this.templates.response, {  // 3.1
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })
  var new_msg_id = err_msg ? 'X_' : ''
  new_msg_id += 'RESP_' + req_msg_info.msg_id // only as unique as the original msg id to handle resubmits with history

  log('config.homeDataPoolGln ' + config.homeDataPoolGln)
  log('req_msg_info ' + req_msg_info)
  if (config.homeDataPoolGln != req_msg_info.receiver) {
    log('********** WARN: responding to non-DP message: ' + req_msg_info)
    return
  }

  $('sh\\:Sender   > sh\\:Identifier').text(req_msg_info.receiver)
  $('sh\\:Receiver > sh\\:Identifier').text(req_msg_info.sender)
  $('sh\\:DocumentIdentification > sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)

  //$('sh\\:DocumentIdentification > sh\\:InstanceIdentifier').text(new_msg_id)
  //$('sh\\:Scope > sh\\:InstanceIdentifier').text(new_msg_id)
  $('sh\\:InstanceIdentifier').text(new_msg_id) // 2 replacements

  $('sh\\:Scope > sh\\:CorrelationInformation > sh\\:RequestingDocumentCreationDateTime').text((new Date(req_msg_info.created_ts || 1)).toISOString())
  $('sh\\:Scope > sh\\:CorrelationInformation > sh\\:RequestingDocumentInstanceIdentifier').text(req_msg_info.msg_id)


  $('gS1Response > originatingMessageIdentifier > entityIdentification').text(req_msg_info.msg_id)
  $('gS1Response > originatingMessageIdentifier > contentOwner > gln').text(req_msg_info.sender)
  $('gS1Response > receiver').text(req_msg_info.receiver) // original receiver, sender of this reponse, should aways be dp
  $('gS1Response > sender')  .text(req_msg_info.sender)   // original sender, receiver of this response, should be local TP, GR, or other DP

  // remove trx success/error and start with message exception
  var $trx_resp = $('gS1Response > transactionResponse').remove()

  if (err_msg) {
    $('messageException > gS1Error > errorDateTime').text(new Date().toISOString())
    $('messageException > gS1Error > errorDescription').text(err_msg)
    $('transactionResponse, transactionException').remove() // remove unused transaction level response/exception template nodes
  }
  else {
    $('gS1Response > gS1Exception').remove()                        // remove unused exception template
    req_msg_info.trx.forEach(function (trx_id) {                        // to generate list of transactionResponse elements
      var $trx = $trx_resp.clone()
      $('transactionIdentifier > entityIdentification', $trx).text(trx_id)
      $('transactionIdentifier > contentOwner > gln', $trx).text(trxOwner || req_msg_info.provider || req_msg_info.source_dp || req_msg_info.sender)
      $('gS1Response').append($trx)
    })
  }
  return $.html()
}

// the original BPR must be sent by the trading party to their own data pool, 
// then a BPR to GR is generated. Only one party per message is supported.
Gdsn.prototype.populateBprToGr = function (tp_msg_info) { // 3.1

  log('populateBprToGr from party bpr with msg_id: ' + tp_msg_info)
  var $ = cheerio.load(this.templates.bpr_to_gr, { // 3.1
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // instance ID, note that GR requires a unique message ID each time
  // so something like 'BPR_to_GR_1425055673689_1100001011292_ADD'
  var new_msg_id = 'BPR_' + Date.now() + '_' + tp_msg_info.sender + '_' + tp_msg_info.status

  $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
  $('sh\\:Receiver > sh\\:Identifier').text(config.gdsn_gr_gln)
  $('sh\\:InstanceIdentifier').text(new_msg_id)
  $('sh\\:CreationDateAndTime, creationDateTime, lastUpdateDateTime, processCapabilityEffectiveStartDateTime')
   .text(new Date().toISOString()) // when this message is created by DP (right now)

  // all 3 entity ids will have the same owner, also used as data pool
  $('partyDataPool, transmittingDataPool, registeringParty').text(config.homeDataPoolGln) // the data pool
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_trx1')
  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1')
  $('basicPartyRegistrationIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1_doc1')

  if (tp_msg_info.status != 'ADD') {
    $('documentCommand > documentCommandHeader').attr('type', tp_msg_info.status)
  }

  var party = tp_msg_info.data && tp_msg_info.data[0]

  if (party) {
    $('informationProviderOfParty > gln').text(party.gln)
    $('partyInRole > partyName')        .text(party.name)
    $('partyInRole > partyRoleCode')    .text(party.role)

    $('partyAddress > city')            .text(party.city)
    $('partyAddress > countryCode')     .text(party.tm)
    $('partyAddress > name')            .text(party.name)
    $('partyAddress > postalCode')      .text(party.zip)
    $('partyAddress > state')           .text(party.state)
    $('partyAddress > streetAddressOne').text(party.address1)
    $('partyAddress > streetAddressTwo').text(party.address2)

    if (party.contact_name) {
      $('partyContact > personName').text(party.contact_name)

      if (party.contact_email) $('partyContact > communicationChannel > communicationChannelCode:contains(EMAIL)').next().text(party.contact_email)
      else $('communicationChannelCode:contains(EMAIL)').parent().remove()

      if (party.contact_telephone) $('partyContact > communicationChannel > communicationChannelCode:contains(TELEPHONE)').next().text(party.contact_telephone)
      else $('communicationChannelCode:contains(TELEPHONE)').parent().remove()
    }
    else $('partyContact > personName').remove()
  }

  $('contentOwner > gln').text(config.homeDataPoolGln)

  return $.html()
}

var cis_id_counter = 1000

Gdsn.prototype.populateCisToGr = function (tp_msg_info) {
  log('populateCisToGr')
  var $ = cheerio.load(this.templates.cis_to_gr, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // SINGLE doc support:
  var sub_info = tp_msg_info.data && tp_msg_info.data[0]
  if (!sub_info) return ''

  // new values for this message
  var new_msg_id = 'CIS_to_GR_' + Date.now() + '_' + sub_info.recipient + '_' + (cis_id_counter++)


  $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
  $('sh\\:Receiver > sh\\:Identifier').text(config.gdsn_gr_gln)
  $('sh\\:InstanceIdentifier').text(new_msg_id)

  $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)

  // original values from tp: trx/cmd/doc id and owner glns, created ts
  // assume naming convention based on original msg_id and only support single doc
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_trx1')

  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1')

  $('documentCommand > documentCommandHeader').attr('type', tp_msg_info.status) // set // ADD, DELETE

  $('creationDateTime').text(new Date(tp_msg_info.created_ts || Date.now()).toISOString()) // use create date from original CIS from tp
  $('catalogueItemSubscriptionIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1_doc1')
  $('dataRecipient').text(sub_info.recipient)

  //optional subscription criteria:
  if (sub_info.provider) $('dataSource').text(sub_info.provider)
  else $('dataSource').remove()

  if (sub_info.gpc) $('gpcCategoryCode').text(sub_info.gpc)
  else $('gpcCategoryCode').remove()

  if (sub_info.gtin) $('gtin').text(sub_info.gtin)
  else $('gtin').remove()

  if (sub_info.tm) $('targetMarket > targetMarketCountryCode').text(sub_info.tm)
  else $('targetMarket').remove()

  if (sub_info.recipient_dp) $('recipientDataPool').text(sub_info.recipient_dp)
  else $('recipientDataPool').remove()

  $('contentOwner > gln').text(tp_msg_info.recipient)
  $('eanucc\\:message > entityIdentification > contentOwner > gln').text(config.homeDataPoolGln) // sender

  return $.html()
}

Gdsn.prototype.populateRfcinToGr= function (tp_msg_info) {
  log('populateRfcinToGr')
  var $ = cheerio.load(this.templates.rfcin_to_gr, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // new values for this message
  var new_msg_id = 'RFCIN_to_GR_' + Date.now() + '_' + tp_msg_info.recipient


  $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
  $('sh\\:Receiver > sh\\:Identifier').text(config.gdsn_gr_gln)
  $('sh\\:InstanceIdentifier').text(new_msg_id)

  $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)

  // original values from tp: trx/cmd/doc id and owner glns, created ts
  // assume naming convention based on original msg_id and only support single doc
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_t1')

  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_t1_c1')

  $('documentCommand > documentCommandHeader').attr('type', 'ADD') // set // ADD, DELETE

  //var rfcin_repeat = $('request_for_catalogue_item_notification:requestForCatalogueItemNotification')

  // for each RFCIN document in TP source msg
  //tp_msg_info.data.forEach(function (rfcin) {

    var rfcin = tp_msg_info

      $('creationDateTime').text(new Date().toISOString())
      $('catalogueItemSubscriptionIdentification > entityIdentification').text(new_msg_id + '_t1_c1_d1')
      $('dataRecipient').text(rfcin.recipient)

      //optional subscription criteria:
      if (rfcin.provider) $('dataSource').text(rfcin.provider)
      else $('dataSource').remove()

      if (rfcin.gpc) $('gpcCategoryCode').text(rfcin.gpc)
      else $('gpcCategoryCode').remove()

      if (rfcin.gtin) $('gtin').text(rfcin.gtin)
      else $('gtin').remove()

      if (rfcin.tm) $('targetMarket > targetMarketCountryCode').text(rfcin.tm)
      else $('targetMarket').remove()

      if (rfcin.recipient_dp) $('recipientDataPool').text(rfcin.recipient_dp)
      else $('recipientDataPool').remove()

      $('isReload').text(Boolean(rfcin.reload == 'true' || rfcin.reload == 'TRUE').toString()) // string
  //})

  $('contentOwner > gln').text(tp_msg_info.recipient)
  $('eanucc\\:message > entityIdentification > contentOwner > gln').text(config.homeDataPoolGln) // sender

  return $.html()
}

Gdsn.prototype.create_rci_to_gr = function (item, cmd) {
  log('create_rci_to_gr')

  cmd = cmd || 'ADD'

  var $ = cheerio.load(this.templates.rci_to_gr_3, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // new values for this message
  $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
  $('sh\\:Receiver > sh\\:Identifier').text(config.gdsn_gr_gln)
  // GR requires unique msg id, so use ts
  var new_msg_id = 'RCI_' + Date.now() + '_' + item.provider + '_' + item.gtin + '_' + item.tm
  if (item.tm_sub && item.tm_sub != 'na') new_msg_id += '_' + item.tm_sub
  $('sh\\:InstanceIdentifier').text(new_msg_id)
  $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)


  // new message values for dp: trx/cmd/doc id and owner glns, created ts
  // assume naming convention based on new_msg_id and only support single doc
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_trx1')
  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1')
  $('documentCommand > documentCommandHeader').attr('type', cmd) // ADD, CORRECT

  // SINGLE doc support:
  $('creationDateTime').text(new Date(item.created_ts || 1).toISOString())
  $('registryCatalogueItemIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1_doc1')
  $('gpcCategoryCode').text(item.gpc)
  $('sourceDataPool').text(config.homeDataPoolGln)
  //<registryCatalogueItemStateCode...  // TODO? for cancelled, etc
  $('catalogueItemReference > dataSource').text(item.provider)
  $('catalogueItemReference > gtin').text(item.gtin)
  $('catalogueItemReference > targetMarketCountryCode').text(item.tm)
  if (item.tm_sub && item.tm_sub != 'na') {
    $('catalogueItemReference > targetMarketSubdivisionCode').text(item.tm_sub)
  }
  else {
    $('catalogueItemReference > targetMarketSubdivisionCode').remove()
  }

  if (item.cancelledDate) $('catalogueItemDates > cancelDateTime').text(item.cancelledDate)
  else $('catalogueItemDates > cancelDateTime').remove()

  if (item.discontinuedDate) $('catalogueItemDates > discontinuedDateTime').text(item.discontinuedDate)
  else $('catalogueItemDates > discontinuedDateTime').remove()

  $('catalogueItemDates > lastChangedDateTime').text(new Date().toISOString())
  $('catalogueItemDates > registrationDateTime').text(new Date().toISOString())

  $('contentOwner > gln').text(item.provider)
  $('eanucc\\:message > entityIdentification > contentOwner > gln').text(config.homeDataPoolGln) // sender

  return $.html()
}

// send CIC receive to source_dp SDP for subscribed item, this is AUTO, no TP directly involved
Gdsn.prototype.populateRdpCicRecForSdpCin = function (sdp_cin, state) {
  log('populateCicFromCin')
  var $ = cheerio.load(this.templates.cic_to_pub, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })
  if (!sdp_cin) return ''

  log('state:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: ' + state)
  if (state != 'REVIEW' && state != 'SYNCHRONISED' && state != 'REJECTED') state = 'RECEIVED' // 3.1: no more cic 'ACCEPTED'

  var rdp_cic = {

    // sender and recipient_dp will always be home dp of subscriber
      source_dp  : sdp_cin.sender
    , receiver   : sdp_cin.source_dp
    , recipient  : sdp_cin.recipient
    , provider   : sdp_cin.provider
    , gtin       : sdp_cin.gtin
    , tm         : sdp_cin.tm
    , tm_sub     : sdp_cin.tm_sub
    , status     : state
  }
  return this.populateCicToSourceDP(rdp_cic)
}

Gdsn.prototype.populateCicToSourceDP = function (tp_cic) {

  log('populateCic')
  var $ = cheerio.load(this.templates.cic_to_pub, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  if (!tp_cic) return ''

  // new values for this message
  var new_msg_id = 'CIC_' + Date.now() + '_' + tp_cic.recipient + '_' + tp_cic.gtin
  var now_iso = new Date().toISOString()
  var recipient_dp = config.homeDataPoolGln

  $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
  $('sh\\:Receiver > sh\\:Identifier').text(tp_cic.source_dp) // could be to self for local publisher
  $('sh\\:InstanceIdentifier').text(new_msg_id)

  $('sh\\:CreationDateAndTime').text(now_iso) // when this message is created by DP (right now)

  // original values from tp: trx/cmd/doc id and owner glns, created ts
  // assume naming convention based on original msg_id and only support single doc
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_trx1')

  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1')

  $('creationDateTime').text(now_iso)
  $('catalogueItemConfirmationIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1_doc1')

  var state = tp_cic.status
  if (state != 'REVIEW' && state != 'SYNCHRONISED' && state != 'REJECTED') state = 'RECEIVED' // 3.1: no more cic 'ACCEPTED'
  $('catalogueItemConfirmationState > catalogueItemConfirmationStateCode').text(state)
  
  $('catalogueItemConfirmationState > recipientGLN').text(tp_cic.recipient)
  $('catalogueItemConfirmationState > recipientDataPool').text(config.homeDataPoolGln)

  $('catalogueItemReference > dataSource').text(tp_cic.provider)
  $('catalogueItemReference > gtin').text(tp_cic.gtin)
  $('catalogueItemReference > targetMarketCountryCode').text(tp_cic.tm)
  if (tp_cic.tm_sub && tp_cic.tm_sub != 'na') {
    $('catalogueItemReference > targetMarketSubdivisionCode').text(tp_cic.tm_sub)
  }
  else {
    $('catalogueItemReference > targetMarketSubdivisionCode').remove()
  }

  var cicsd = $('catalogueItemConfirmationStatusDetail')
  if (tp_cic.confirm_code && tp_cic.confirm_desc) {
    $('confirmationStatusCatalogueItem > dataSource', cicsd).text(tp_cic.provider)
    $('confirmationStatusCatalogueItem > gtin'      , cicsd).text(tp_cic.gtin)
    $('confirmationStatusCatalogueItem > targetMarketCountryCode', cicsd).text(tp_cic.tm)
    if (tp_cic.tm_sub && tp_cic.tm_sub != 'na') {
      $('confirmationStatusCatalogueItem > targetMarketSubdivisionCode', cicsd).text(tp_cic.tm_sub)
    }
    else {
      $('confirmationStatusCatalogueItem > targetMarketSubdivisionCode', cicsd).remove()
    }

    $('catalogueItemConfirmationStatus > confirmationStatusCode'           , cicsd).text(tp_cic.confirm_code) 
    $('catalogueItemConfirmationStatus > confirmationStatusCodeDescription', cicsd).text(tp_cic.confirm_desc)
  }
  else { // RECEIVED, SYNCHRONISED // and REVIEW?
    cicsd.remove()
  }

  $('contentOwner > gln').text(tp_cic.recipient)
  $('eanucc\\:message > entityIdentification > contentOwner > gln').text(config.homeDataPoolGln) // sender

  return $.html()
}

Gdsn.prototype.populateCihwToOtherSDP = function (tp_cihw) {

  log('populateCihwToOtherSDP  ' + tp_cihw)

  var $ = cheerio.load(this.templates.cihw_to_rdp, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  if (!tp_cihw) return ''

  // new values for this message
  var new_msg_id = 'CIHW_' + Date.now() + '_' + tp_cihw.recipient + '_' + tp_cihw.gtin
  var now_iso = new Date().toISOString()

  $('sh\\:Sender > sh\\:Identifier').text(tp_cihw.source_dp)
  $('sh\\:Receiver > sh\\:Identifier').text(tp_cihw.recipient_dp) // could be to self for local publisher
  $('sh\\:InstanceIdentifier').text(new_msg_id)

  $('sh\\:CreationDateAndTime').text(now_iso) // when this message is created by DP (right now)

  // original values from tp: trx/cmd/doc id and owner glns, created ts
  // assume naming convention based on original msg_id and only support single doc per message
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_t1')
  $('contentOwner > gln').text(tp_cihw.provider) // sender

  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_t1_c1')

  try { var tp_created_iso = (new Date(tp_cihw.created_ts)).toISOString() }
  catch(e) { log('error getting orig created ts from tp msg document: ' + e) }
  $('creationDateTime').text(tp_created_iso || now_iso)

  $('catalogueItemHierarchicalWithdrawalIdentification > entityIdentification').text(new_msg_id + '_t1_c1_d1')

  $('catalogueItemReference > dataSource').text(tp_cihw.provider)
  $('catalogueItemReference > gtin').text(tp_cihw.gtin)
  $('catalogueItemReference > targetMarketCountryCode').text(tp_cihw.tm)
  if (tp_cihw.tm_sub && tp_cihw.tm_sub != 'na') {
    $('catalogueItemReference > targetMarketSubdivisionCode').text(tp_cihw.tm_sub)
  }
  else {
    $('catalogueItemReference > targetMarketSubdivisionCode').remove()
  }

  $('dataRecipient > gln').text(tp_cihw.recipient)
  $('sourceDataPool > gln').text(tp_cihw.source_dp)

  $('hierarchyDeletionReasonCode').text(tp_cihw.reason)

  return $.html()
}

// removes extra whitespace between tags, but adds a new line for easy diff later
Gdsn.prototype.trim_xml = Gdsn.trim_xml = function (xml) {
  // match xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  var match = xml.match(/<[^]*>/) 
  var result = match && match[0]
  if (!result || !result.length) return ''
  result = result.replace(/>\s*</g, '><') // remove extra whitespace between tags
  result = result.replace(/><([^\/])/g, '>\n<$1')  // add line return between tags but not as tag value
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
