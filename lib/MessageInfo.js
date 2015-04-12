// This version supports GDSN 2.8 and 3.1 XML

var cheerio          = require('cheerio')
var TradeItemInfo    = require('./TradeItemInfo.js')
var PartyInfo        = require('./PartyInfo.js')
var PublicationInfo  = require('./PublicationInfo.js')
var SubscriptionInfo = require('./SubscriptionInfo.js')

var MessageInfo = module.exports = function (msg_xml, config) {

  console.log('constructing new MessageInfo instance for xml length: ' + (msg_xml && msg_xml.length))

  if (!msg_xml || !msg_xml.length) return this // return blank msg_info

  config = config || {homeDataPoolGln: '999900009999111'}

  var msg_info = this // rename this for uniform use with callbacks

  msg_info.clear()

  msg_info.modified_ts = Date.now() // timestamp this message_info instance, see creation_ts for xml value
  
  msg_info.xml = msg_xml
  msg_info.xml_length = msg_xml.length

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

  msg_info.msg_type = $(header_prefix + '\\:DocumentIdentification > ' + header_prefix + '\\:Type', $header).text()
  console.log('message type: ' + msg_info.msg_type)

  msg_info.msg_id = $(header_prefix + '\\:InstanceIdentifier', $header).first().text()
  console.log('message instance id: ' + msg_info.msg_id)

  msg_info.sender   = $(header_prefix + '\\:Sender > ' + header_prefix + '\\:Identifier', $header).text()
  console.log('message sender: ' + msg_info.sender)

  msg_info.receiver = $(header_prefix + '\\:Receiver > ' + header_prefix + '\\:Identifier', $header).text()
  console.log('message receiver: ' + msg_info.receiver)

  msg_info.version  = $(header_prefix + '\\:TypeVersion', $header).text()
  console.log('message version: ' + msg_info.version)

  var created_date_time = $(header_prefix + '\\:CreationDateAndTime', $header).text()
  msg_info.created_ts = (new Date(created_date_time)).getTime()
  console.log('message create ts: ' + msg_info.created_ts)

  msg_info.source_dp = $('sourceDataPool').first().text() || config.homeDataPoolGln // try for all messages types and versions, both 2.8 and 3.1

  // RESPONSE message (includes PRR, CIRR, ACCEPTED, gs1Exception)
  // response/exception messages including PRR and CIRR
  // response/exception messages including PRR and CIRR
  if (msg_info.msg_type == 'gS1Response'                       // 3.1, includes gS1Exception
   || msg_info.msg_type == 'GDSNResponse'                      // 2.8, includes gDSNException
   || msg_info.msg_type == 'partyRegistrationResponse'         // 2.8 and 3.1, PRR response to BPR
   || msg_info.msg_type == 'catalogueItemRegistrationResponse' // 2.8 and 3.1, CIRR response to RCI
  ) {

    msg_info.request_msg_id = $(header_prefix + '\\:RequestingDocumentInstanceIdentifier', $header).text()
    console.log('request_msg_id: ' + msg_info.request_msg_id)

    // either it is an exception or a status reponse:
    // just capture all text for now
    var exception = $('gS1Exception').text() // 3.1
      || $('gDSNException').text()           // 2.8

    if (exception) {
      msg_info.status = 'ERROR'
      msg_info.exception = exception
    }
    else {
      msg_info.status = 'ACCEPTED' // always ACCEPTED if not an exception
      //if (!msg_info.status) msg_info.status = $('transactionResponse responseStatus')
      //if (!msg_info.status) msg_info.status = $('transactionResponse responseStatusCode')

      // catalogueItemRegistrationResponse, assuming single item at a time from GR
      if (msg_info.msg_type == 'catalogueItemRegistrationResponse') {
        try {
          msg_info.gtin     = $('catalogueItemReference > gtin').text()
          msg_info.provider = $('catalogueItemReference > dataSource').text()
          msg_info.tm       = $('catalogueItemReference > targetMarketCountryCode').text()
          msg_info.tm_sub   = $('catalogueItemReference > targetMarketSubdivisionCode').text() || 'na'
        }
        catch (e) {}
      }

      // basicPartyRegistrationResponse for party GLN, assuming single party at a time from GR
      if (msg_info.msg_type == 'partyRegistrationResponse') {
        try {
          msg_info.provider = $('partyReference').text() // the party gln
        }
        catch (e) {}
      }
    }
    msg_info.msg_type = 'GDSNResponse' // use older name for gS1Response, PRR, CIRR
    return msg_info
  }

  msg_info.status = $('documentCommandHeader').attr('type') || 'NA'

  // save a list of all transaction IDs for reference
  $('transactionIdentification > entityIdentification').each(function () {
    msg_info.trx.push($(this).text())
  })
  console.log('Adding tranaction IDs: ' + msg_info.trx.join(', '))

  // BPR submission from TP-DP or DP-GR
  if (msg_info.msg_type == 'basicPartyRegistration') {
    console.log('BPR...........................')
    $('basicPartyRegistrationIdentification').each(function () {
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var party = new PartyInfo($(this.parent).toString(), msg_info.msg_id, trx_id, cmd_id)
      msg_info.party.push(party)
    })
    return msg_info
  }

  // RPDD from GR
  if (msg_info.msg_type == 'registryPartyDataDump') {
    $('registryPartyDataDumpIdentification').each(function () {
    console.log('RPDD...........................')
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var party = new PartyInfo($(this.parent).toString(), msg_info.msg_id, trx_id, cmd_id)
      msg_info.party.push(party)
    })
    return msg_info
  }

  // BPR response from GR (PRR) -- see generic response/exception below

  // RCI to GR, rci
  if (msg_info.msg_type == 'registryCatalogueItem') {
    $('registryCatalogueItemIdentification').each(function () {
      msg_info.gtin     = $('catalogueItemReference > gtin', this.parent).text()
      msg_info.provider = $('catalogueItemReference > dataSource', this.parent).text()
      msg_info.tm       = $('catalogueItemReference > targetMarketCountryCode', this.parent).text()
      msg_info.tm_sub   = $('catalogueItemReference > targetMarketSubdivisionCode', this.parent).text() || 'na'

      msg_info.gtins.push(msg_info.gtin)
    })
    msg_info.gpc       = $('gpcCategoryCode').text()        || '99999999'
    msg_info.recipient = msg_info.receiver
    return msg_info
  }

  // RCI response (CIRR) from GR -- see generic response/exception below

  // CIS
  if (msg_info.msg_type == 'catalogueItemSubscription') {
    $('catalogueItemSubscriptionIdentification')
    .first() // only support one subscription per message for now
    .each(function () {
        var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
        var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
        var sub    = new SubscriptionInfo($(this.parent).toString(), msg_info.msg_id, trx_id, cmd_id)
        msg_info.sub.push(sub)
        msg_info.gtins.push(sub.gtin)

        msg_info.recipient    = sub.recipient
        msg_info.recipient_dp = sub.recipient_dp
        msg_info.provider     = sub.provider
        msg_info.gtin         = sub.gtin
        msg_info.tm           = sub.tm
        msg_info.gpc          = sub.gpc
    })
    return msg_info
  }

  // CIP, cip from local parties only
  if (msg_info.msg_type == 'catalogueItemPublication') {
    $('catalogueItemPublicationIdentification').each(function () {
      // we may need these additional ids to report errors
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()

      var pub    = new PublicationInfo($(this.parent).toString(), msg_info.msg_id, trx_id, cmd_id)
      if (msg_info.status == 'DELETE') pub['delete'] = true

      msg_info.pub.push(pub)
      msg_info.gtins.push(pub.gtin)

      msg_info.provider  =  pub.provider
      msg_info.gtin      =  pub.gtin
      msg_info.tm        =  pub.tm
      msg_info.tm_sub    =  pub.tm_sub
      msg_info.recipient =  pub.recipient
    })
    return msg_info
  }

  // CIN
  if (msg_info.msg_type == 'catalogueItemNotification') {

    console.log('CIN...........................')

    // provider should always be the same accross entire message
    msg_info.provider = $('informationProviderOfTradeItem > gln').first().text()
    console.log('CIN provider: ' + msg_info.provider)

    msg_info.recipient = $('dataRecipient').first().text()
    // default recipient is the provider itself (a private 'draft' item)
    if (!msg_info.recipient) msg_info.recipient = msg_info.provider

    // there are 4 subtypes of CIN, 2 _from_ home DP (to TP or other DP)
    if (msg_info.sender == config.homeDataPoolGln) { // from home DP
      if (msg_info.receiver == msg_info.recipient) {
        msg_info.note = '>>> subscribed item forwarded from home DP to local TP'
      }
      else {
        msg_info.note = '>>> subscribed item forwarded from home DP to other DP for remote TP'
      }
    }
    // ...and 3 more _to_ home DP, 2 from TP, or from other DP.
    // These should be repostable to DP
    else if (msg_info.receiver == config.homeDataPoolGln) { // to home DP
      if (msg_info.sender == msg_info.provider) { // from local TP
        if (msg_info.provider == msg_info.recipient) { // 3. from TP (private draft item)
          msg_info.note = '>>> private draft item from local TP'
        }
        else if (config.homeDataPoolGln == msg_info.recipient) {
          msg_info.note = '>>> item registration/update attempt from local TP'
        }
      }
      else { // from other dp
        msg_info.note = '>>> subscribed item received from other DP for local TP'
      }
    }

    $('catalogueItemNotificationIdentification').each(function () {
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var doc_id = $('catalogueItemNotificationIdentification > entityIdentification', this).text()

      $('catalogueItem > tradeItem', this.parent).each(function () {
        var ti_xml = $(this).toString()
        console.log('found trade item xml with length: ' + (ti_xml && ti_xml.length))
        var new_item = new TradeItemInfo(ti_xml, msg_info.msg_id, trx_id, cmd_id, doc_id)

        msg_info.item.push(new_item)

        msg_info.gtin      = new_item.gtin
        msg_info.provider = new_item.provider
        msg_info.tm        = new_item.tm
        msg_info.tm_sub    = new_item.tm_sub
        msg_info.gpc       = new_item.gpc

        msg_info.gtins.push(new_item.gtin)
      })
    })

    msg_info.gtin  = msg_info.gtins.length && msg_info.gtins[0]
    msg_info.item_count = msg_info.gtins.length

    return msg_info
  } // end CIN

  // CIC
  if (msg_info.msg_type == 'catalogueItemConfirmation') {

    // multi doc CIC support:
    $('catalogueItemConfirmationIdentification').each(function () {
      var trx_id = $('transactionIdentification > entityIdentification', this.parent.parent.parent).text()
      var cmd_id = $('documentCommandIdentification > entityIdentification', this.parent.parent).text()
      var doc_id = $('catalogueItemConfirmationIdentification > entityIdentification', this).text()

      msg_info.status = $('catalogueItemConfirmationState'    , this.parent).attr('state') // 2.8
                     || $('catalogueItemConfirmationStateCode', this.parent).text()        // 3.1

      if (msg_info.status == 'REVIEW') {
        // capture reason for review
        var review_msg = $('catalogueItemConfirmationStatus', this.parent).text() // includes status code and description, optional additional description and optional correctiveAction
        if (review_msg) {
          console.log('CIC REVIEW msg: ' + review_msg)
          msg_info.exception = review_msg
        }
      }
      msg_info.recipient    = $('catalogueItemConfirmationState > recipientGLN', this.parent).text()
      msg_info.recipient_dp = $('catalogueItemConfirmationState > recipientDataPool', this.parent).text()

      // item info:
      msg_info.gtin     = $('catalogueItemReference > gtin', this.parent).text()
      msg_info.provider = $('catalogueItemReference > dataSource', this.parent).text()
      msg_info.tm       = $('catalogueItemReference > targetMarketCountryCode', this.parent).text()
      msg_info.tm_sub   = $('catalogueItemReference > targetMarketSubdivisionCode', this.parent).text() || 'na'

      //if (msg_info.sender == msg_info.recipient) { // from local TP sub for other DP pub
      //if (msg_info.sender != msg_info.recipient) { // from other DP for local TP pub
    })

    msg_info.gtin  = msg_info.gtins.length && msg_info.gtins[0]
    msg_info.item_count = msg_info.gtins.length
    return msg_info
  } // end CIC

  // new CIH HierarchyWithdrawal
  if (msg_info.msg_type == 'catalogueItemHierarchicalWithdrawal') {
    msg_info.status = 'TEST'
    console.log('TESTING new cih state: ' + msg_info.status)
    msg_info.recipient = '1100001011278'
    // item info:
    msg_info.provider = '123'
    msg_info.gtin     = '456'
    msg_info.tm       = '840'
    msg_info.tm_sub   = ''
    return msg_info
  } // end CIH

  console.log('WARNING msg type not recognized: ' + msg_info.msg_type)
  return msg_info
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
  clear_msg_data(this)
}

var clear_msg_data = function (msg_info) {

  // fields to populate (potentially, varies by message):
  msg_info.msg_id        = ''
  msg_info.version       = ''

  msg_info.msg_type      = ''

  msg_info.status        = '' // CIN: ADD, CHANGE_BY_REFRESH, CORRECT, DELETE; - Responses: ACCEPTED, ERROR; - CIC: RECEIVED, REJECTED, REVIEW, SYNCHRONISED
  msg_info.sender        = ''
  msg_info.source_dp     = ''

  msg_info.receiver      = ''
  msg_info.recipient     = ''

  msg_info.provider      = '' // CIN, RCI, PUB, BPR, RPDD(GR)
  //msg_info.tm            = ''
  //msg_info.tm_sub        = ''

  msg_info.request_msg_id= '' // for responses

  msg_info.gtin          = ''
  msg_info.gtins         = [] // for RCI, CIC, CIP, maybe CIS

  msg_info.trx           = [] // list of transaction id for any non-response message
  msg_info.item          = [] // for CIN
  msg_info.party         = [] // for BPR, RPDD
  msg_info.pub           = [] // for CIP
  msg_info.sub           = [] // for CIS, RFCIN

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
