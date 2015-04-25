// This version supports GDSN 2.8 and 3.1 XML

var cheerio          = require('cheerio')
var TradeItemInfo    = require('./TradeItemInfo.js')
var PartyInfo        = require('./PartyInfo.js')
var PublicationInfo  = require('./PublicationInfo.js')
var SubscriptionInfo = require('./SubscriptionInfo.js')
var ConfirmationInfo = require('./ConfirmationInfo.js')
var RfcinInfo        = require('./RfcinInfo.js')
var parse_response   = require('./msg_parse_response.js')

var MessageInfo = module.exports = function (msg_xml, config) {

  console.log('constructing new MessageInfo instance for xml length: ' + (msg_xml && msg_xml.length))

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
  })

  var $root = $(':root')
  var root = $root[0]
  var root_name = root.name
  var root_parts = root_name.split(':')
  var root_prefix = ''
  var root_local_name = ''

  if (root_parts && root_parts.length == 2) {
    root_prefix = root_parts && root_parts[0]
    root_local_name = root_parts && root_parts[1]
    console.log('msg ns root_prefix: ' + root_prefix)
  }

  var header = root.children[1]
  var $header = $(header)

  var header_prefix = ''
  if (root_local_name == 'StandardBusinessDocument') {
    header_prefix = root_prefix // for 2.8
  }
  else {
    var header_name = header.name
    var header_parts = header_name.split(':')
    header_prefix = header_parts && header_parts[0] // for 3.1
  }
  //console.log('header prefix: ' + header_prefix)

  msg.msg_type = $(header_prefix + '\\:DocumentIdentification > ' + header_prefix + '\\:Type', $header).text()
  console.log('message type: ' + msg.msg_type)

  msg.msg_id = $(header_prefix + '\\:InstanceIdentifier', $header).first().text()
  console.log('message instance id: ' + msg.msg_id)

  msg.sender   = $(header_prefix + '\\:Sender > ' + header_prefix + '\\:Identifier', $header).text()
  console.log('message sender: ' + msg.sender)

  msg.receiver = $(header_prefix + '\\:Receiver > ' + header_prefix + '\\:Identifier', $header).text()
  console.log('message receiver: ' + msg.receiver)

  msg.version  = $(header_prefix + '\\:TypeVersion', $header).text()
  console.log('message version: ' + msg.version)

  var created_date_time = $(header_prefix + '\\:CreationDateAndTime', $header).text()
  msg.created_ts = (new Date(created_date_time)).getTime()
  console.log('message create ts: ' + msg.created_ts)

  msg.request_msg_id = $(header_prefix + '\\:RequestingDocumentInstanceIdentifier', $header).text() // for responses only
  console.log('request_msg_id: ' + msg.request_msg_id)

  // handle various responses, including errors and specialized party or item registration response from GR
  if (parse_response($, msg, header_prefix)) return msg

  msg.status = $('documentCommandHeader').attr('type') || 'NA'

  // save a list of all transaction IDs for reference
  $('transactionIdentification > entityIdentification').each(function () {
    msg.trx.push($(this).text())
  })
  console.log('Adding tranaction IDs: ' + msg.trx.join(', '))

  // BPR submission from TP-DP or DP-GR
  if (msg.msg_type == 'basicPartyRegistration') {
    console.log('BPR...........................')
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
    console.log('RPDD...........................')
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

    msg.source_dp = $('sourceDataPool').first().text() || config.homeDataPoolGln 
    
    $('registryCatalogueItemIdentification').each(function () {
      msg.gtin     = $('catalogueItemReference > gtin', this.parent).text()
      msg.provider = $('catalogueItemReference > dataSource', this.parent).text()
      msg.tm       = $('catalogueItemReference > targetMarketCountryCode', this.parent).text()
      msg.tm_sub   = $('catalogueItemReference > targetMarketSubdivisionCode', this.parent).text() || 'na'

      msg.gtins.push(msg.gtin)
    })
    msg.gpc       = $('gpcCategoryCode').text()        || '99999999'
    msg.recipient = msg.receiver
    return msg
  }

  // RCI response (CIRR) from GR -- see generic response/exception below

  // CIS cis
  if (msg.msg_type == 'catalogueItemSubscription') {

    $('catalogueItemSubscriptionIdentification').each(function () {
        var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
        var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
        var sub    = new SubscriptionInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id)

        msg.data.push(sub)
        msg.gtins.push(sub.gtin)

        msg.recipient    = sub.recipient
        msg.recipient_dp = sub.recipient_dp
        msg.provider     = sub.provider
        msg.gtin         = sub.gtin
        msg.tm           = sub.tm
        msg.gpc          = sub.gpc
    })
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

    // THREE KINDS OF RFCIN:

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

    console.dir(msg)
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
        msg.gtin      =  pub.gtin
        msg.tm        =  pub.tm
        msg.tm_sub    =  pub.tm_sub
        msg.recipient =  pub.recipient
      }
    })
    return msg
  }

  // CIN cin
  if (msg.msg_type == 'catalogueItemNotification') {

    console.log('CIN...........................')
    console.dir(msg)

    msg.source_dp = $('sourceDataPool').first().text() // now xsd optional, but required for CIN

    msg.provider = $('informationProviderOfTradeItem > gln').first().text() // ds, publisher, provider, seller, etc
    console.log('CIN provider: ' + msg.provider)

    msg.recipient = $('dataRecipient').first().text()
    // default recipient is the provider itself (a private 'draft' item)
    if (!msg.recipient) msg.recipient = msg.provider

    // there are 4 subtypes of CIN, 2 _from_ home DP (to TP or other DP)
    if (msg.sender == config.homeDataPoolGln) { // from home DP

      if (msg.receiver == msg.recipient) {
        msg.note = '>>> subscribed item forwarded from home DP to local TP'
      }

      else {
        msg.note = '>>> subscribed item forwarded from home DP to other DP for remote TP'
      }
    }
    // ...and 3 more _to_ home DP, 2 from TP, or from other DP.
    // These should be repostable to DP

    else if (msg.receiver == config.homeDataPoolGln) { // to home DP

      if (msg.sender == msg.provider) { // from local TP
        if (msg.provider == msg.recipient) { // 3. from TP (private draft item)
          msg.note = '>>> private draft item from local TP'
        }
        else if (config.homeDataPoolGln == msg.recipient) { //4. TP item registration
          msg.note = '>>> item registration/update attempt from local TP'
        }
      }
      else { // from other dp
        msg.note = '>>> subscribed item received from other DP for local TP'
      }
    }

    $('catalogueItemNotificationIdentification').each(function () {
        console.log('===  found catalogue item document with identifier: ' + $(this).text())

      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      // get doc_id here, since we deal with individual trade item when iterating
      var doc_id = $('catalogueItemNotificationIdentification > entityIdentification', this).text()

      $('catalogueItem > tradeItem', this.parent).each(function () {
        var ti_xml = $(this).toString()
        console.log('found trade item xml with length: ' + (ti_xml && ti_xml.length) + ' for recipient ' + msg.recipient)
        var item = new TradeItemInfo(ti_xml, msg.msg_id, trx_id, cmd_id, doc_id)

        item.recipient = msg.recipient // subscriber, not receiver
        item.source_dp = msg.source_dp

        msg.data.push(item)
        msg.gtins.push(item.gtin)

        msg.gtin      = item.gtin
        msg.provider  = item.provider
        msg.tm        = item.tm
        msg.tm_sub    = item.tm_sub
        msg.gpc       = item.gpc

        msg.item_count = msg.gtins.length
        if (msg.item_count) msg.gtin = msg.gtins[0]
      })
    })

    return msg
  } // end CIN

  // CIC
  if (msg.msg_type == 'catalogueItemConfirmation') {

console.log('starting CIC parse logic: ' + msg)

    // multi doc CIC support, not working yet for more than one:
    $('catalogueItemConfirmationIdentification').each(function () {

      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var cic    = new ConfirmationInfo($(this.parent).toString(), msg.msg_id, trx_id, cmd_id)

      // if home data pool is not the recipient_dp, then it must be the source_dp of item
      if (cic.recipient_dp != config.homeDataPoolGln) cic.source_dp = config.homeDataPoolGln

      // 4 types cic:
      if (msg.sender == cic.recipient_dp) { // rdp -> sdp

        // 1. this RDP -> other SDP
        if (msg.sender == config.homeDataPoolGln) {
          msg.note = 'CIC from this RDP to other SDP, no additional CIC generation needed'
        }

        // 2. other RDP -> this SDP
        else  {
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

      if (!msg.provider) {
        msg.confirm_code = cic.confirm_code
        msg.confirm_desc = cic.confirm_desc
        msg.status       = cic.state 
        msg.provider     = cic.provider
        msg.gtin         = cic.gtin
        msg.tm           = cic.tm
        msg.tm_sub       = cic.tm_sub
        //
        msg.recipient    = cic.recipient    // must be same for all docs in message
        msg.recipient_dp = cic.recipient_dp // must be same for all docs in message
      }
      if (msg.gtins.length > 1) msg.status = 'MULTI'
    })
    return msg
  } // end CIC

  // new CIH HierarchyWithdrawal
  if (msg.msg_type == 'catalogueItemHierarchicalWithdrawal') {
    msg.source_dp = $('sourceDataPool').first().text()
    msg.status = 'TEST'
    console.log('TESTING new cih state: ' + msg.status)
    msg.recipient = '1100001011278'
    // item info:
    msg.provider = '123'
    msg.gtin     = '456'
    msg.tm       = '840'
    msg.tm_sub   = ''
    return msg
  } // end CIH

  console.log('WARNING msg type not recognized: ' + msg.msg_type)
  return msg
}

MessageInfo.prototype.toString = function () {
  try {
    return JSON.stringify(this)
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

/*
  msg_info.msg_type_list = [
                              'registryPartyDataDump'
                             ,'basicPartyRegistration'
                             ,'catalogueItemHierarchicalWithdrawal'
                             ,'registryCatalogueItem'        // aka RCI or CIR (catalogueItemRegistration)
                             ,'catalogueItemNotification'
                             ,'catalogueItemPublication'
                             ,'catalogueItemSubscription'
                             ,'catalogueItemConfirmation'
                             ,'requestForCatalogueItemNotification'
                             ,'gS1Response' // includes accepted, error, CIRR and BPRR
                           ]
*/

}
