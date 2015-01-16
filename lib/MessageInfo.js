var cheerio     = require('cheerio')

module.exports = function MessageInfo(xml, config) {

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
  msg_info.msg_type = $('DocumentIdentification Type').text()
  console.log('message type: ' + msg_info.msg_type)

  msg_info.msg_id = $('DocumentIdentification InstanceIdentifier').text()
  console.log('message instance id: ' + msg_info.msg_id)

  msg_info.sender = $('StandardBusinessDocumentHeader Sender Identifier').text()
  msg_info.receiver = $('StandardBusinessDocumentHeader Receiver Identifier').text()
  msg_info.version = $('DocumentIdentification TypeVersion').text()

  if (!msg_info.version) console.log('***************** couldn\'t find version tag in msg ' + msg_info.msg_id)
  else console.log('***************** version tag in msg ' + msg_info.msg_id + ' - ' + msg_info.version)

  var created_date_time = $('DocumentIdentification CreationDateAndTime').text()
  msg_info.created_ts = (new Date(created_date_time)).getTime()

  // response/exception messages
  if (msg_info.msg_type == 'GDSNResponse') {

    msg_info.request_msg_id = $('RequestingDocumentInstanceIdentifier').text()
    console.log('request_msg_id: ' + msg_info.request_msg_id)
    // either it is an exception or a status reponse:
    var exception = $('gDSNException').text() // just capture all text for xsd:complexType
    if (exception) {
      msg_info.status = 'ERROR'
      msg_info.exception = exception
    }
    else {
      msg_info.status = 'ACCEPTED' // always ACCEPTED if not an exception
      //if (!msg_info.status) msg_info.status = $('eANUCCResponse').first().attr('responseStatus')

      // catalogueItemRegistrationResponse:
      msg_info.gtin     = $('catalogueItemReference gtin').first().text()
      msg_info.provider = $('catalogueItemReference dataSource').first().text()
      msg_info.tm       = $('catalogueItemReference countryISOCode').first().text()
      msg_info.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').first().text() || 'na'

      // partyRegistrationResponse:
      msg_info.provider = $('partyRegistrationResponse partyReference').first().text()
    }
  }

  else if (msg_info.msg_type == 'catalogueItemConfirmation') {

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

  else if (msg_info.msg_type == 'catalogueItemNotification') {
    
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

  else if (msg_info.msg_type == 'catalogueItemPublication') {
    msg_info.recipient = $('catalogueItemPublication publishToGLN').text()
    msg_info.initial_load = $('catalogueItemPublication extension initialLoad').text()
    // item info:
    msg_info.gtin     = $('catalogueItemReference gtin').text()
    msg_info.provider = $('catalogueItemReference dataSource').text()
    msg_info.tm       = $('catalogueItemReference countryISOCode').text()
    msg_info.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').text() || 'na'
  }

  else if (msg_info.msg_type == 'catalogueItemSubscription') {
    msg_info.recipient = $('catalogueItemSubscription dataRecipient').text()
    //optional fields:
    msg_info.deliver   = $('catalogueItemSubscription extension deliver').text()
    msg_info.recipient = $('catalogueItemSubscription dataRecipient').text()
    msg_info.provider  = $('catalogueItemSubscription dataSource').text()
    msg_info.gtin      = $('catalogueItemSubscription gTIN').text()
  }
  else if (msg_info.msg_type == 'basicPartyRegistration') {
    msg_info.provider  = $('informationProviderOfParty gln').text()
  }
  else if (msg_info.msg_type == 'registryPartyDataDump') {
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

  //console.log('final msg data: ' + JSON.stringify(msg_info))
  return msg_info
}

