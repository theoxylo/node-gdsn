// This version supports GDSN 3.1 XML, it will return null if 2.8 is detected

var cheerio     = require('cheerio')

module.exports = function MessageInfo3(xml, config) {

  if (!xml || !xml.length) return this

  config = config || {}

  var msg_info = this // for uniform use with callbacks

  // fields to populate (potentially, varies by message):
  msg_info.msg_id    = ''
  msg_info.version   = ''
  msg_info.msg_type  = ''
  msg_info.status    = ''
  msg_info.sender    = ''
  msg_info.receiver  = ''
  msg_info.provider  = ''
  msg_info.recipient = ''
  msg_info.parties   = []
  msg_info.gtin      = ''
  msg_info.tm        = ''
  msg_info.tm_sub    = ''
  msg_info.gtins     = []
  msg_info.source_dp = ''

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
  console.log('msg ns prefix: ' + prefix)

  try { // more elegant/brittle way to get 'msg_type' (incomplete)
    //var $doc_element = $(header_prefix + '\\:*')
    //var $doc_element = $(header_prefix + '\\:registryCatalogueItem')
    var $doc_element = $('registry_catalogue_item\\:registryCatalogueItem')
    console.log('doc type: ' + $doc_element[0].name.split(':')[1])
    //msg_info.doc_type = 
  }
  catch (e) {
    console.log('error getting doc type: ' + e)
  }

  msg_info.msg_type = root_parts && root_parts[1]
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
    msg_info.parties = []
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    var $party_reg = $(prefix + '\\:basicPartyRegistration')
    var gln = $('party informationProviderOfParty gln', $party_reg).first().text() 
    console.log('BPR party gln: ' + gln)
    msg_info.parties[0] = gln
    msg_info.provider = gln
    msg_info.recipient = msg_info.receiver
    return msg_info
  }

  // RPDD
  if (msg_info.msg_type == 'registryPartyDataDumpMessage') {
    msg_info.msg_type = 'registryPartyDataDump'
    msg_info.parties = []
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    var $party_data = $(prefix + '\\:registryPartyDataDump')
    $party_data.each(function () {
      var gln = $('party informationProviderOfParty gln', this).first().text() 
      console.log('RPDD party gln: ' + gln)
      msg_info.parties.push(gln)
    })
    msg_info.provider = msg_info.sender
    msg_info.recipient = msg_info.receiver
    return msg_info
  }

  // BPR response from GR (PRR)
  /*
  if (msg_info.msg_type == 'partyRegistrationResponseMessage') {
    msg_info.msg_type = 'partyRegistrationResponse'
    var $response = $(prefix + '\\:' + msg_info.msg_type)
    msg_info.status = $response.find('responseStatusCode').text()
    console.log('status code: ' + msg_info.status)
    return msg_info
  }
  */

  // RCI to GR
  if (msg_info.msg_type == 'registryCatalogueItemMessage') {
    msg_info.msg_type = 'registryCatalogueItem'
    msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'
    console.log('status code: ' + msg_info.status)
    return msg_info
  }

  // RCI response (CIRR) from GR
  /* 
  if (msg_info.msg_type == 'catalogueItemRegistrationResponseMessage') {
    msg_info.msg_type = 'catalogueItemRegistrationResponse'
    var $response = $(prefix + '\\:' + msg_info.msg_type)
    msg_info.status = 'CIRR_' + $response.find('responseStatus').text()
    console.log('status code: ' + msg_info.status)
    return msg_info
  }
  */

  // response/exception messages including PRR and CIRR
  if (   msg_info.msg_type == 'gS1ResponseMessage' 
      || msg_info.msg_type == 'catalogueItemRegistrationResponseMessage'
      || msg_info.msg_type == 'partyRegistrationResponseMessage'
    ) {

    msg_info.msg_type = 'GDSNResponse'

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
      try {
        msg_info.gtin     = $('catalogueItemReference gtin').first().text()
        msg_info.provider = $('catalogueItemReference dataSource').first().text()
        msg_info.tm       = $('catalogueItemReference targetMarketCountryCode').first().text()
        msg_info.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').first().text() || 'na'
      }
      catch (e) {}

      // basicPartyRegistrationResponse for party GLN:
      try {
        msg_info.provider = $('partyReference').first().text()
      }
      catch (e) {}
    }
  }

  // CIC
  else if (msg_info.msg_type == 'catalogueItemConfirmationMessage') {
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
  } // end CIC

  // CIN
  else if (msg_info.msg_type == 'catalogueItemNotificationMessage') {
    msg_info.msg_type = 'catalogueItemNotification'
    
    msg_info.provider = $('informationProviderOfTradeItem informationProvider gln').first().text()
    console.log('CIN provider: ' + msg_info.provider)

    msg_info.recipient = $('dataRecipient').first().text()
    if (!msg_info.recipient) {
      // default recipient is the provider itself (a private 'draft' item)
      msg_info.recipient = msg_info.provider
    }
    console.log('CIN data recipient: ' + msg_info.recipient)

    try {
      msg_info.source_dp = $('sourceDataPool').first().text()
      if (!msg_info.source_dp) console.log('CIN sourceDataPool element not set')
    }
    catch (err) { 
      console.log('CIN sourceDataPool element not found, err: ' + err)
    }
    if (!msg_info.source_dp) msg_info.source_dp = config.homeDataPoolGln
    console.log('final source_dp: ' + msg_info.source_dp)
/*
    // there are 4 subtypes of CIN, 2 _from_ homde DP...
    if (msg_info.sender == config.homeDataPoolGln) { // from home DP
      if (msg_info.receiver == msg_info.recipient) {
        console.log('>>> subscribed item forwarded from home DP to local TP')
      }
      else {
        console.log('>>> subscribed item forwarded from home DP to other DP for remote TP')
      }
    }
    // ...and 2 more _to_ home DP, these are repostable to DP
    else if (msg_info.receiver == config.homeDataPoolGln) { // to home DP
      if (msg_info.sender == msg_info.provider) { // from local TP
        if (msg_info.provider == msg_info.recipient) { // 3. from TP (private draft item)
          console.log('>>> private draft item from local TP')
        }
        else if (config.homeDataPoolGln == msg_info.recipient) {
          console.log('>>> item registration/update attempt from local TP')
        }
      }
      else { // from other dp
        console.log('>>> subscribed item received from other DP for local TP')
      }
    }
*/
    var gtins = []
    $('tradeItem').each(function () {
      var the_gtin = $('tradeItem tradeItemIdentification gtin', this).first().text() 
      //console.log('the gtin: ' + the_gtin)
      gtins.push(the_gtin)
    })
    msg_info.gtins = gtins || []
    msg_info.gtin  = gtins && gtins.length && gtins[0]
    msg_info.item_count = (gtins && gtins.length) || (msg_info.gtin && 1)
  } // end CIN

  // CIP
  else if (msg_info.msg_type == 'catalogueItemPublicationMessage') {
    msg_info.msg_type = 'catalogueItemPublication'
    msg_info.recipient = $('catalogueItemPublication publishToGLN').text()
    msg_info.initial_load = $('catalogueItemPublication extension initialLoad').text()
    // item info:
    msg_info.gtin     = $('catalogueItemReference gtin').text()
    msg_info.provider = $('catalogueItemReference dataSource').text()
    msg_info.tm       = $('catalogueItemReference countryISOCode').text()
    msg_info.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').text() || 'na'
  }

  // CIS
  else if (msg_info.msg_type == 'catalogueItemSubscriptionMessage') {
    msg_info.msg_type = 'catalogueItemSubscription'
    msg_info.recipient = $('catalogueItemSubscription dataRecipient').text()
    //optional fields:
    msg_info.deliver   = $('catalogueItemSubscription extension deliver').text()
    msg_info.recipient = $('catalogueItemSubscription dataRecipient').text()
    msg_info.provider  = $('catalogueItemSubscription dataSource').text()
    msg_info.gtin      = $('catalogueItemSubscription gTIN').text()
  }
  
  // for most messages, use the command type as the status (e.g. ADD, CORRECT, DELETE)
  if (!msg_info.status) msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'

  // item ref is used by CIRR, CIC, CIP
  /*
  var catalog_item_ref = $('catalogueItemReference')
  if (catalog_item_ref.length) {
    msg_info.gtin     = $('gtin', catalog_item_ref).first().text()
    msg_info.provider = $('dataSource', catalog_item_ref).first().text()
    msg_info.tm       = $('countryISOCode', catalog_item_ref).first().text()
    msg_info.tm_sub   = $('countrySubDivisionISOCode', catalog_item_ref).first().text() || 'na'
  }
  */

  //console.log('final msg data: ' + JSON.stringify(msg))

  return msg_info
}

function logOwn(label, obj) {
  if (label) console.log('Obj label: ' + label)
  for (var prop in obj) if (obj.hasOwnProperty(prop)) console.log('Obj prop "' + prop + '": ' + obj[prop])
}
