// This version supports GDSN 3.1 XML, it will return null if 2.8 is detected

var cheerio     = require('cheerio')

module.exports = function MessageInfo3(xml, config) {

  config = config || {}

  var msg_info = this // the new msg_info instance we are creating, also for uniform use with callbacks

  // fields to populate (potentially, varies by message):
  msg_info.msg_id        = ''
  msg_info.version       = ''

  msg_info.msg_type      = ''

  msg_info.status        = '' // CIN: ADD, CHANGE_BY_REFRESH, CORRECT, DELETE; - Responses: ACCEPTED, ERROR; - CIC: RECEIVED, REJECTED, REVIEW, SYNCHRONIZED
  msg_info.sender        = ''
  msg_info.source_dp     = ''
  msg_info.receiver      = ''
  msg_info.recipient     = ''

  // for single doc support unrolled:

  msg_info.provider      = '' // CIN, RCI, PUB, BPR, RPDD(GR)
  msg_info.tm            = ''
  msg_info.tm_sub        = ''

  msg_info.request_msg_id= '' // for responses

  msg_info.gtin          = ''
  msg_info.gtins         = [] // for CIN, RCI, CIC

  msg_info.party         = ''
  msg_info.parties       = [] // for BPR, RPDD

  msg_info.trx_count     = 0
  msg_info.trx_ids       = []

  msg_info.cmd_count     = 0
  msg_info.cmd_ids       = []

  msg_info.doc_count     = 0
  msg_info.doc_ids       = []

  msg_info.docs          = [] // doc struct implied by msg_type per convention

  msg_info.note          = ''
  msg_info.msg_type_list = ['registryPartyDataDump'
                           ,'basicPartyRegistration'
                           ,'catalogueItemNotification'
                           ,'catalogueItemHierarchicalWithdrawal'
                           ,'registryCatalogueItem'        // aka RCI or CIR (catalogueItemRegistration)
                           ,'catalogueItemPublication'
                           ,'catalogueItemSubscription'
                           ,'catalogueItemConfirmation'
                           ,'requestForCatalogueItemNotification'
                           ,'gS1ResponseMessage' // includes doc types catalogueItemRegistrationResponse and partyRegistrationResponse
                           ,'gS1Exception']

  if (!xml || !xml.length) return this // return blank msg_info

  var $ = cheerio.load(xml, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  var $root = $(':root')
  //logOwn('$root', $root)

  var root = $root[0]
  //logOwn('first element of $root', root)
  var root_name = root.name
  var root_parts = root_name.split(':')

  var prefix = root_parts && root_parts[0]
  var root_local_name = root_parts && root_parts[1]
  console.log('msg ns prefix: ' + prefix)

  msg_info.msg_type = root_local_name
  console.log('message document type: ' + msg_info.msg_type)
  if (msg_info.msg_type == 'StandardBusinessDocument') return this // all done if older 2.8 schema

  var header = root.children[1]
  var header_name = header.name
  var header_parts = header_name.split(':')
  var header_prefix = header_parts && header_parts[0]
  console.log('header ns prefix: ' + header_prefix)

  msg_info.msg_id = $(header_prefix + '\\:DocumentIdentification ' + header_prefix + '\\:InstanceIdentifier').text()
  console.log('message instance id: ' + msg_info.msg_id)

  msg_info.sender   = $(header_prefix + '\\:Sender ' + header_prefix + '\\:Identifier').text()
  msg_info.receiver = $(header_prefix + '\\:Receiver ' + header_prefix + '\\:Identifier').text()
  msg_info.version  = $(header_prefix + '\\:TypeVersion').text()

  var created_date_time = $(header_prefix + '\\:CreationDateAndTime').text()
  msg_info.created_ts = (new Date(created_date_time)).getTime()

  // BPR submission
  if (msg_info.msg_type == 'basicPartyRegistrationMessage') {
    msg_info.msg_type = 'basicPartyRegistration'
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    $(prefix + '\\:basicPartyRegistration').each(function () {
      var gln = $('party informationProviderOfParty gln', this).first().text() 
      console.log('BPR party gln: ' + gln)
      msg_info.parties.push(gln)
    })
    msg_info.party = msg_info.parties[0]
    msg_info.provider = msg_info.sender
    msg_info.recipient = msg_info.receiver
    return msg_info
  }

  // RPDD
  if (msg_info.msg_type == 'registryPartyDataDumpMessage') {
    msg_info.msg_type = 'registryPartyDataDump'
    msg_info.parties = []
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    $(prefix + '\\:registryPartyDataDump').each(function () {
      var gln = $('party informationProviderOfParty gln', this).first().text() 
      console.log('RPDD party gln: ' + gln)
      msg_info.parties.push(gln)
    })
    msg_info.party = msg_info.parties[0]
    msg_info.provider = msg_info.sender // gr
    msg_info.recipient = msg_info.receiver
    return msg_info
  }

  // BPR response from GR (PRR) -- see generic resposne/exception below

  // RCI to GR
  if (msg_info.msg_type == 'registryCatalogueItemMessage') {
    msg_info.msg_type = 'registryCatalogueItem'
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    $(prefix + '\\:registryCatalogueItem').each(function () {
      var gtin = $('catalogueItemReference gtin', this).text() 
      console.log('RCI gtin: ' + gtin)
      msg_info.gtins.push(gtin)
      msg_info.provider = $('catalogueItemReference dataSource', this).text() 
      msg_info.tm = $('catalogueItemReference targetMarketCountryCode', this).text() 
    })
    msg_info.gtin = msg_info.gtins[0]
    msg_info.recipient = msg_info.receiver
    return msg_info
  }

  // RCI response (CIRR) from GR -- see generic resposne/exception below

  // CIS
  if (msg_info.msg_type == 'catalogueItemSubscriptionMessage') {
    msg_info.msg_type = 'catalogueItemSubscription'
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    $(prefix + '\\:catalogueItemSubscription').each(function () {
      msg_info.recipient = $('dataRecipient', this).text()
      console.log('CIS subscriber gln: ' + msg_info.recipient)
      //optional fields:
      msg_info.provider  = $('dataSource', this).text()
      msg_info.gtin      = $('gtin', this).text()
      msg_info.gpc       = $('gpcCategoryCode', this).text()
    })
    return msg_info
  }
  
  // CIP
  if (msg_info.msg_type == 'catalogueItemPublicationMessage') {
    msg_info.msg_type = 'catalogueItemPublication'
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    $(prefix + '\\:catalogueItemPublication').each(function () {
      msg_info.recipient = $('publishToGLN', this).text()
      console.log('CIP publish-to gln: ' + msg_info.recipient)
      msg_info.initial_load = false
      // item info:
      msg_info.gtin     = $('catalogueItemReference gtin', this).text()
      msg_info.provider = $('catalogueItemReference dataSource', this).text()
      msg_info.tm       = $('catalogueItemReference countryISOCode', this).text()
      msg_info.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode', this).text() || 'na'
    })
    return msg_info
  }

  // CIN
  if (msg_info.msg_type == 'catalogueItemNotificationMessage') {
    msg_info.msg_type = 'catalogueItemNotification'
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    msg_info.provider = $('informationProviderOfTradeItem gln').first().text()
    console.log('CIN provider: ' + msg_info.provider)

    msg_info.recipient = $('dataRecipient').first().text()
    if (!msg_info.recipient) {
      // default recipient is the provider itself (a private 'draft' item)
      msg_info.recipient = msg_info.provider
    }
    console.log('CIN data recipient: ' + msg_info.recipient)

    try {
      msg_info.source_dp = $('sourceDataPool').first().text()
      if (!msg_info.source_dp) console.log('CIN sourceDataPool not set')
    }
    catch (err) { 
      console.log('CIN sourceDataPool element not found, err: ' + err)
    }
    if (!msg_info.source_dp) msg_info.source_dp = config.homeDataPoolGln
    console.log('final source_dp: ' + msg_info.source_dp)

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

    var gtins = []
    $('tradeItem').each(function () {
      var the_gtin = $('tradeItem gtin', this).first().text()  // need "tradeItem" to skip others
      console.log('the gtin: ' + the_gtin)
      gtins.push(the_gtin)
    })
    
    msg_info.gtins = gtins || []
    msg_info.gtin  = gtins && gtins.length && gtins[0]
    msg_info.item_count = (gtins && gtins.length) || (msg_info.gtin && 1)

    return msg_info
  } // end CIN

  // response/exception messages including PRR and CIRR
  if (   msg_info.msg_type == 'gS1ResponseMessage' 
      || msg_info.msg_type == 'catalogueItemRegistrationResponseMessage'
      || msg_info.msg_type == 'partyRegistrationResponseMessage'
    ) {

    msg_info.request_msg_id = $(header_prefix + '\\:RequestingDocumentInstanceIdentifier').text()
    console.log('request_msg_id: ' + msg_info.request_msg_id)

    // either it is an exception or a status reponse:
    var exception = $('gS1Exception').text() // just capture all text for xsd:complexType
    if (exception) {
      msg_info.status = 'ERROR'
      msg_info.exception = exception
    }
    else {
      msg_info.status = 'ACCEPTED' // always ACCEPTED if not an exception
      //if (!msg_info.status) msg_info.status = $('transactionResponse responseStatus')
      //if (!msg_info.status) msg_info.status = $('transactionResponse responseStatusCode')

      // catalogueItemRegistrationResponse:
      if (msg_info.msg_type == 'catalogueItemRegistrationResponseMessage') {
        try {
          msg_info.gtin     = $('catalogueItemReference gtin').first().text()
          msg_info.provider = $('catalogueItemReference dataSource').first().text()
          msg_info.tm       = $('catalogueItemReference targetMarketCountryCode').first().text()
          msg_info.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').first().text() || 'na'
        }
        catch (e) {}
      }

      // basicPartyRegistrationResponse for party GLN:
      if (msg_info.msg_type == 'partyRegistrationResponseMessage') {
        try {
          msg_info.provider = $('partyReference').first().text()
        }
        catch (e) {}
      }
    }
    msg_info.msg_type = 'GDSNResponse'
    return msg_info
  }

  // CIC
  if (msg_info.msg_type == 'catalogueItemConfirmationMessage') {
    msg_info.msg_type = 'catalogueItemConfirmation'
    msg_info.status = $('catalogueItemConfirmationState').first().attr('state')
    console.log('cic state: ' + msg_info.status)
    if (msg_info.status == 'REVIEW') {
      // capture reason for review
      var review_msg = $('catalogueItemConfirmationStatusDetail catalogueItemConfirmationStatus').text() // just capture all text for xsd:complexType
      console.log('+++++++++++++++++++++++++++++++++++ REVIEW MSG: ' + review_msg)
      if (review_msg) {
        msg_info.exception = review_msg
      }
    }
    msg_info.recipient = $('catalogueItemConfirmationState recipientGLN').text()
    // item info:
    msg_info.gtin     = $('catalogueItemReference gtin').text()
    msg_info.provider = $('catalogueItemReference dataSource').text()
    msg_info.tm       = $('catalogueItemReference countryISOCode').text()
    msg_info.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').text() || 'na'
    return msg_info
  } // end CIC

  console.log('WARNING msg type not recognized: ' + msg_info.msg_type)
  return msg_info
}

function logOwn(label, obj) {
  if (label) console.log('Obj label: ' + label)
  for (var prop in obj) if (obj.hasOwnProperty(prop)) console.log('Obj prop "' + prop + '": ' + obj[prop])
}
