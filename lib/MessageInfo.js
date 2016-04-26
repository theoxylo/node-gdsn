// This version supports GDSN 2.8 and 3.1 XML

var cheerio          = require('cheerio')
var TradeItemInfo    = require('./TradeItemInfo.js')
var PartyInfo        = require('./PartyInfo.js')
var PublicationInfo  = require('./PublicationInfo.js')
var SubscriptionInfo = require('./SubscriptionInfo.js')
var ConfirmationInfo = require('./ConfirmationInfo.js')
var RfcinInfo        = require('./RfcinInfo.js')
var WithdrawalInfo   = require('./WithdrawalInfo.js')
var parse_response   = require('./msg_parse_response.js')

var log = console.log

var msg_id_counter = 1000

var MessageInfo = module.exports = function (msg_xml, config) {

  log('constructing new MessageInfo instance for xml length: ' + (msg_xml && msg_xml.length))

  if (!msg_xml || !msg_xml.length) return this // return blank msg

  config = config || {homeDataPoolGln: '999900009999111'}

  var msg = this // rename this for uniform use with callbacks

  msg.clear()

  msg.modified_ts = Date.now() // timestamp this message_info instance, see creation_ts for xml value
  
  msg.xml = msg_xml
  msg.xml_length = msg_xml.length

  // start parsing xml
  var $ = cheerio.load(msg_xml, {
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
    , decodeEntities: false
  })

  var $root = $(':root')
  var root = $root && $root[0]
  var root_name = root.name || 'rootx'
  var root_parts = root_name.split(':')

  //log('START >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> msg ns root_prefix:root_local_name ' + root_prefix + ':' + root_local_name)

  //var root_parts = $(':root')[0].(name || '').split(':')

  var root_prefix = ''
  var root_local_name = 'unknown'
  if (root_parts && root_parts.length == 1) {
    var root_local_name = root_parts[0] // 
  }
  if (root_parts && root_parts.length == 2) {
    root_prefix     = root_parts[0]
    root_local_name = root_parts[1]
  }
  log('msg ns root_prefix:root_local_name ' + root_prefix + ':' + root_local_name)


  var header = root.children[1]
  var $header = $(header)
  var header_prefix = ''
  if (root_local_name == 'StandardBusinessDocument') {
    header_prefix = root_prefix // for 2.8
  }
  else {
    var header_name = (header && header.name) || ''
    var header_parts = header_name.split(':')
    header_prefix = (header_parts && header_parts[0]) || '' // for 3.1 or custom
  }

  if (header_prefix) header_prefix += '\\:'

  msg.msg_type = $(header_prefix + 'DocumentIdentification > ' + header_prefix + 'Type', $header).text()

  log('message type: ' + msg.msg_type)

  msg.msg_id = $(header_prefix + 'InstanceIdentifier', $header).first().text()
  log('message instance id: ' + msg.msg_id)

  msg.sender   = $(header_prefix + 'Sender > ' + header_prefix + 'Identifier', $header).text()
  log('message sender: ' + msg.sender)

  msg.receiver = $(header_prefix + 'Receiver > ' + header_prefix + 'Identifier', $header).text()
  log('message receiver: ' + msg.receiver)

  msg.version  = $(header_prefix + 'TypeVersion', $header).text()
  log('message version: ' + msg.version)

  var created_date_time = $(header_prefix + 'CreationDateAndTime', $header).text()
  msg.created_ts = (new Date(created_date_time)).getTime()
  log('message create ts: ' + msg.created_ts)

  msg.request_msg_id = $(header_prefix + 'RequestingDocumentInstanceIdentifier', $header).text() // for responses only
  log('request_msg_id: ' + msg.request_msg_id)

  msg.source_dp = $('sourceDataPool').first().text() // now xsd optional, but required for CIN
  // handle various responses, including errors and specialized party or item registration response from GR
  if (parse_response($, msg)) return msg

  msg.status = $('documentCommandHeader').attr('type') || 'NA'

  // save a list of all transaction IDs for reference
  $('transactionIdentification > entityIdentification').each(function () {
    msg.trx.push($(this).text())
  })
  log('Adding tranaction IDs: ' + msg.trx.join(', '))

  // CUSTOM MESSAGE TYPES, e.g. simple tradeItems list of tradeItem elements
  if (!msg.msg_type) {
    log('msg_id: ' + msg.msg_id)
    log('root local name: ' + root_local_name)

    if (root_local_name == 'tradeItems') { // custom MDS flat list of tradeItem XML with no Type element
      log('Found tradeItems list from MDS...')
      msg.msg_type  = 'tradeItems'
      msg.version   = '2.8'
      if (msg.status == 'NA') msg.status = "ADD"

      msg.receiver_orig = msg.receiver // save orig <Receiver> id
      msg.receiver = msg.recipient = msg.source_dp = config.homeDataPoolGln // ignore <Receiver> for now

      msg.created_ts = Date.now()
      msg.modified_ts = msg.created_ts


      if (!msg.msg_id) msg.msg_id = $('InstanceIdentifier').first().text() // try without namespace
      if (!msg.msg_id) msg.msg_id = msg.msg_type + '_' + Date.now() + '_' + (++msg_id_counter)

      if (!msg.receiver) msg.receiver = $('ReceiverIdentifier').first().text()
      if (!msg.receiver) msg.receiver = msg.recipient

      if (!msg.sender)   msg.sender   = $('SenderIdentifier').first().text()

      $('tradeItem').each(function () {

        var ti_xml = $(this).toString()
        log('found MDS trade item xml with length: ' + (ti_xml && ti_xml.length) + ' for recipient ' + msg.recipient)

        var item = new TradeItemInfo(ti_xml, msg.msg_id, 'trx_' + msg_id_counter, 'cmd_' + msg_id_counter, 'doc_' + msg_id_counter)

        msg.version    = item.version

        item.recipient = msg.recipient // subscriber, not receiver
        item.source_dp = msg.source_dp

        msg.data.push(item)
        msg.gtins.push(item.gtin)

        if (!msg.sender)   msg.sender   = item.provider
        if (!msg.provider) msg.provider = item.provider
            
        msg.tm        = item.tm
        msg.tm_sub    = item.tm_sub
        msg.gpc       = item.gpc      // assumes all items in msg are for same hierarchy (provider, tm/sub, gpc)

        //msg.item_count = msg.gtins.length
        if (msg.gtins.length) msg.gtin = msg.gtins[0] // keep first gtin at msg level

        // collect 1 mixed set of dates from various items if present
        msg.cancelledDate    = item.cancelledDate    || msg.cancelledDate
        msg.discontinuedDate = item.discontinuedDate || msg.discontinuedDate
        msg.lastChangeDate   = item.lastChangeDate   || msg.lastChangeDate
        msg.effectiveDate    = item.effectiveDate    || msg.effectiveDate
      })
    }

    return msg
  }

  // BPR submission from TP-DP or DP-GR
  if (msg.msg_type == 'basicPartyRegistration') {
    log('BPR...........................')
    $('basicPartyRegistrationIdentification').each(function () {
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var party = new PartyInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id)
      msg.data.push(party)
    })
    return msg
  }

  // RPDD from GR
  if (msg.msg_type == 'registryPartyDataDump') {
    $('registryPartyDataDumpIdentification').each(function () {
    log('RPDD...........................')
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var party = new PartyInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id)
      msg.data.push(party)
    })
    return msg
  }

  // BPR response from GR (PRR) -- see generic response/exception below

  // RCI to GR, rci
  if (msg.msg_type == 'registryCatalogueItem') {

    $('registryCatalogueItemIdentification').each(function () {
      msg.provider = $('catalogueItemReference > dataSource',                  this.parent).text()
      msg.tm       = $('catalogueItemReference > targetMarketCountryCode',     this.parent).text()
      msg.tm_sub   = $('catalogueItemReference > targetMarketSubdivisionCode', this.parent).text() || 'na'
      msg.gpc      = $('gpcCategoryCode',                                      this.parent).text() || '99999999'
      msg.gtin     = $('catalogueItemReference > gtin',                        this.parent).text()
      msg.gtins.push(msg.gtin)
    })
    msg.recipient = msg.receiver
    msg.source_dp = msg.sender
    if (msg.gtins.length) msg.gtin = msg.gtins[0] // make sure first item is msg gtin
    return msg
  }

  // RCI response (CIRR) from GR -- see generic parse_response above

  // CIS cis
  if (msg.msg_type == 'catalogueItemSubscription') {

    $('catalogueItemSubscriptionIdentification').each(function () {
        var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
        var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
        var sub    = new SubscriptionInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id)

        msg.data.push(sub)
        if (sub.gtin) msg.gtins.push(sub.gtin)

        msg.recipient    = sub.recipient
        msg.recipient_dp = sub.recipient_dp
        msg.provider     = sub.provider
        msg.tm           = sub.tm
        msg.gpc          = sub.gpc
    })
    if (msg.gtins.length) msg.gtin = msg.gtins[0] // keep first gtin at msg level
    return msg
  }

  // RFCIN rfcin
  if (msg.msg_type == 'requestForCatalogueItemNotification') {

    $('catalogueItemSubscriptionIdentification').each(function () { // not a typo, extends rfcin extends cis
        var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
        var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
        var rfcin  = new RfcinInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id) 

        if (!rfcin.recipient) return // required for each doc, may be multiple per message

        msg.recipient = rfcin.recipient

        if (rfcin.recipient_dp) msg.recipient_dp = rfcin.recipient_dp // xsd optional
        if (rfcin.provider)     msg.provider     = rfcin.provider     // dataSource gln
        if (rfcin.tm)           msg.tm           = rfcin.tm
        if (rfcin.gpc)          msg.gpc          = rfcin.gpc
        if (rfcin.reload)       msg.reload       = rfcin.reload // 'false' to reset synch list rejected status

        msg.data.push(rfcin)
        if (rfcin.gtin) msg.gtins.push(rfcin.gtin)
    })

    if (msg.gtins.length) msg.gtin = msg.gtins[0]

    // 4 kinds of RFCIN:
    if (msg.receiver == config.homeDataPoolGln) {
      if (msg.sender == msg.recipient) { 
        msg.note = '>>> RFCIN from local TP subscriber to home DP, needs forward to GR'
      }
      else {
        msg.note = '>>> RFCIN from from GR to SDP: ' + msg.msg_id + ', sender: ' + msg.sender
        msg.source_dp = config.homeDataPoolGln
      }
    }
    else if (msg.sender == config.homeDataPoolGln) {
      msg.note = '>>> RFCIN from RDP to GR: ' + msg.msg_id + ', sender: ' + msg.sender
    }
    else {
      msg.note = '>>> unrecognized RFCIN variant for msg: ' + msg.msg_id + ', sender: ' + msg.sender
    }

    //console.dir(msg)
    return msg
  }

  // CIP, cip from local parties only
  if (msg.msg_type == 'catalogueItemPublication') {

    $('catalogueItemPublicationIdentification').each(function () {
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var pub    = new PublicationInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id)

      if (msg.status == 'DELETE') pub['delete'] = true

      msg.data.push(pub)
      msg.gtins.push(pub.gtin)

      if (!msg.provider) { // only reflects first cip doc in message
        msg.provider  =  pub.provider
        msg.tm        =  pub.tm
        msg.tm_sub    =  pub.tm_sub
        msg.recipient =  pub.recipient
      }
    })
    if (msg.gtins.length) msg.gtin = msg.gtins[0] // keep first gtin at msg level
    return msg
  }

  if (msg.msg_type == 'catalogueItemNotification') { // CIN cin

    msg.source_dp = $('sourceDataPool').first().text() || config.homeDataPoolGln // now xsd optional, but required for CIN

    msg.recipient = $('dataRecipient').first().text()
    if (!msg.recipient) msg.recipient = config.homeDataPoolGln // old impl: msg.provider // default recipient is the provider itself (a private 'draft' item)

    var split_msgs = []

    $('catalogueItemNotificationIdentification').each(function () { // for each entity id (document), an item hierarchy CIN
      log('===  found catalogue item document with identifier: ' + $(this).text())

      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var doc_id = $('catalogueItemNotificationIdentification > entityIdentification', this).text() // get doc_id here, since we deal with individual trade item when iterating

      split_msgs.push(this.parent) // save each catalogueItemNotification document

      $('catalogueItem > tradeItem', this.parent).each(function () {

        var ti_xml = $(this).toString()
        log('found trade item xml with length: ' + (ti_xml && ti_xml.length) + ' for recipient ' + msg.recipient)

        var item = new TradeItemInfo(ti_xml, msg.msg_id, trx_id, cmd_id, doc_id)

        item.recipient = msg.recipient // subscriber, not receiver
        item.source_dp = msg.source_dp

        msg.data.push(item)
        msg.gtins.push(item.gtin)

        msg.provider  = item.provider
        msg.tm        = item.tm
        msg.tm_sub    = item.tm_sub
        msg.gpc       = item.gpc

        // dates
        msg.cancelledDate    = item.cancelledDate
        msg.discontinuedDate = item.discontinuedDate
        msg.lastChangeDate   = item.lastChangeDate
        msg.effectiveDate    = item.effectiveDate

        //msg.item_count = msg.gtins.length
        if (msg.gtins.length) msg.gtin = msg.gtins[0] // keep first gtin at msg level
      })
    })

    log('found separate CIN count: ' + split_msgs.length)

    if (msg.receiver == config.homeDataPoolGln) {
      if (msg.sender == msg.provider) { 
        msg.note = '>>> CIN from local publisher to home DP'
      }
      else {
        msg.note = '>>> CIN from from other DP for local subscriber'
      }
    }
    else if (msg.sender == config.homeDataPoolGln) {
      if (msg.receiver == msg.recipient) { 
        msg.note = '>>> CIN from home DP to local subscriber'
      }
      else {
        msg.note = '>>> CIN from home DP to other DP'
      }
    }
    else {
      msg.note = '>>> unrecognized CIN variant for msg: ' + msg.msg_id + ', sender: ' + msg.sender + ', receiver: ' + msg.receiver
    }

    return msg
  } // end CIN

  // CIC
  if (msg.msg_type == 'catalogueItemConfirmation') {

    log('starting CIC parse logic: ' + msg)

    // multi doc CIC support, not working yet for more than one:
    $('catalogueItemConfirmationIdentification').each(function () {

      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var cic    = new ConfirmationInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id)

      // if home data pool is not the recipient_dp, then it must be the source_dp of item
      if (cic.recipient_dp != config.homeDataPoolGln) cic.source_dp = config.homeDataPoolGln

      // 4 types cic:
      if (msg.sender == cic.recipient_dp) { // rdp -> sdp
        if (msg.sender == config.homeDataPoolGln) { // 1. this RDP -> other SDP
          msg.note = 'CIC from this RDP to other SDP, no additional CIC generation needed'
        }
        else  { // 2. other RDP -> this SDP
          msg.note = 'CIC from other RDP to this SDP, foward to local DS (4. below): ' + cic.provider
        }
      }
      else {
        // 3. local DR  -> this RDP
        if (msg.sender == cic.recipient) { // dr -> rdp
          msg.note = 'CIC from local subscriber to this RDP, forward to other SDP (1. above) or local DS (4. below)'
        }

        // 4. this SDP -> local DS
        else if (msg.receiver == cic.provider) { // sdp -> ds
          msg.note = 'CIC from this SDP to local DS, no additonal CIC generation needed'
        }
        else {
          msg.note = 'WARNING: unrecognized CIC variant: ' + msg
        }
      }


      msg.data.push(cic)
      msg.gtins.push(cic.gtin)

      if (!msg.provider) { // note that the msg object only has details for the first confirmation!
        msg.status       = cic.state 
        msg.provider     = cic.provider
        msg.gtin         = cic.gtin
        msg.tm           = cic.tm
        msg.tm_sub       = cic.tm_sub
        msg.recipient    = cic.recipient    // must be same for all docs in message
        msg.recipient_dp = cic.recipient_dp // must be same for all docs in message
        msg.confirm_code = cic.confirm_code
        msg.confirm_desc = cic.confirm_desc
        msg.confirm_long = cic.confirm_long
        msg.confirm_cac  = cic.confirm_cac 
        msg.confirm_eci  = cic.confirm_eci

        msg.note = cic.confirm_code || ''
        msg.note += ' | '
        msg.note += cic.confirm_desc || ''
        msg.note += ' | '
        msg.note += cic.confirm_long || ''
        msg.note += ' | '
        msg.note += cic.confirm_cac  || ''
        msg.note += ' | '
        msg.note += cic.confirm_eci
      }
      if (msg.gtins.length > 1) msg.status = 'MULTI'
    })
    return msg
  } // end CIC

  // new CIH CIHW cihw cih HierarchyWithdrawal, 3.1 only
  if (msg.msg_type == 'catalogueItemHierarchicalWithdrawal') {

    msg.status = 'DELETE' // only status supported for now

    $('catalogueItemHierarchicalWithdrawalIdentification').each(function () {

      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var cihw = new WithdrawalInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id) 
      msg.data.push(cihw)

      msg.source_dp    = cihw.source_dp
      msg.provider     = cihw.provider
      msg.tm           = cihw.tm
      msg.tm_sub       = cihw.tm_sub
      msg.recipient    = cihw.recipient
      msg.reason       = cihw.reason

      msg.gtins.push(cihw.gtin)
    })

    if (msg.gtins && msg.gtins.length) msg.gtin = msg.gtins[0]

    // 3 CIHW variants:
    msg.note = msg.note || ''
    if (msg.sender == msg.source_dp) { // from SDP to RDP
      // 1.
      if (msg.sender == config.homeDataPoolGln) msg.note += ' CIHW from local SDP to other RDP'
      // 2.
      else msg.note += ' CIHW from other SDP to local RDP'
    }
    else if (msg.sender == msg.provider) { // from DS to SDP (local TP)
      // 3.
      msg.note += ' CIHW from local DS to SDP'
    }
    else {
      msg.note += ' WARNING: CIHW variant not recognized: ' + msg.msg_id
    }

    return msg
  } // end CIHW cihw

  log('WARNING: msg type and content not recognized: ' + msg.msg_type)
  return msg
}

MessageInfo.prototype.toString = function () {
  try {
    var xml = this.xml
    this.xml = ''
    var json = JSON.stringify(this)
    this.xml = xml
    return json
  }
  catch (e) {
    return e.toString()
  }
}

MessageInfo.prototype.clear = function () {
  // fields to populate (potentially, varies by message):
  this.msg_id        = ''
  this.version       = ''

  this.msg_type      = ''

  this.status        = '' // CIN: ADD, CHANGE_BY_REFRESH, CORRECT, DELETE; - Responses: ACCEPTED, ERROR; - CIC: RECEIVED, REJECTED, REVIEW, SYNCHRONISED
  this.sender        = ''
  this.source_dp     = ''

  this.receiver      = ''
  this.recipient     = ''

  this.provider      = '' // CIN, RCI, PUB, BPR, RPDD(GR)
  this.tm            = ''
  this.tm_sub        = ''

  this.request_msg_id= '' // for responses

  this.gtin          = ''
  this.gtins         = [] // for RCI, CIC, CIP, maybe CIS

  this.trx           = [] // list of transaction id for any non-response message
  this.data          = [] // for CIN items, BPR and RPDD parties, CIS, CIP, CIC units
}
