var cheerio     = require('cheerio')

var MessageInfo = function (xml) {
  if (!(this instanceof MessageInfo)) return new MessageInfo(xml)

  console.log('Creating new instance of MessageInfo')

  if (xml && xml.length) this.populate(xml)
}

MessageInfo.prototype.populate = function (xml) {
  //console.log('Populating instance of MessageInfo with xml: ' + xml)
  if (!xml || !xml.length) return this

  var msg = this // for uniform use with callbacks

  msg.xml = MessageInfo.config.gdsn.trim_xml(xml)

  var clean_xml = MessageInfo.config.gdsn.clean_xml(msg.xml, 'skip_trim')
  //console.log('clean xml: ' + clean_xml)

  var $ = cheerio.load(clean_xml, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })
  msg.msg_type = $('DocumentIdentification Type').text()
  console.log('message type: ' + msg.msg_type)

  msg.msg_id = $('DocumentIdentification InstanceIdentifier').text()
  console.log('message instance id: ' + msg.msg_id)

  msg.sender = $('StandardBusinessDocumentHeader Sender Identifier').text()
  msg.receiver = $('StandardBusinessDocumentHeader Receiver Identifier').text()
  msg.version = $('DocumentIdentification TypeVersion').text()

  if (!msg.version) console.log('***************** couldn\'t find version tag in msg ' + msg.msg_id)
  else console.log('***************** version tag in msg ' + msg.msg_id + ' - ' + msg.version)

  var created_date_time = $('DocumentIdentification CreationDateAndTime').text()
  msg.created_ts = (new Date(created_date_time)).getTime()

  // response/exception messages
  if (msg.msg_type == 'GDSNResponse') {

    msg.request_msg_id = $('RequestingDocumentInstanceIdentifier').text()
    console.log('request_msg_id: ' + msg.request_msg_id)
    // either it is an exception or a status reponse:
    var exception = $('gDSNException').text() // just capture all text for xsd:complexType
    if (exception) {
      msg.status = 'ERROR'
      msg.exception = exception
    }
    else {
      msg.status = 'ACCEPTED' // always ACCEPTED if not an exception
      //if (!msg.status) msg.status = $('eANUCCResponse').first().attr('responseStatus')

      // catalogueItemRegistrationResponse:
      msg.gtin     = $('catalogueItemReference gtin').first().text()
      msg.provider = $('catalogueItemReference dataSource').first().text()
      msg.tm       = $('catalogueItemReference countryISOCode').first().text()
      msg.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').first().text() || 'na'

      // partyRegistrationResponse:
      msg.provider = $('partyRegistrationResponse partyReference').first().text()
    }
  }

  else if (msg.msg_type == 'catalogueItemConfirmation') {

    msg.status = $('catalogueItemConfirmationState').first().attr('state')
    console.log('cic state: ' + msg.status)
    if (msg.status == 'REVIEW') {
      // capture reason for review
      var review_msg = $('catalogueItemConfirmationStatusDetail catalogueItemConfirmationStatus').text() // just capture all text for xsd:complexType
      console.log('+++++++++++++++++++++++++++++++++++ REVIEW MSG: ' + review_msg)
      if (review_msg) {
        msg.exception = review_msg
      }
    }
    msg.recipient = $('catalogueItemConfirmationState recipientGLN').text()
    // item info:
    msg.gtin     = $('catalogueItemReference gtin').text()
    msg.provider = $('catalogueItemReference dataSource').text()
    msg.tm       = $('catalogueItemReference countryISOCode').text()
    msg.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').text() || 'na'
  } // end CIC

  else if (msg.msg_type == 'catalogueItemNotification') {
    
    msg.provider = $('informationProviderOfTradeItem informationProvider gln').first().text()
    console.log('CIN provider: ' + msg.provider)

    msg.recipient = $('dataRecipient').first().text()
    if (!msg.recipient) {
      // default recipient is the provider itself (a private 'draft' item)
      msg.recipient = msg.provider
    }
    console.log('CIN data recipient: ' + msg.recipient)

    try {
      msg.source_dp = $('sourceDataPool').first().text()
      if (!msg.source_dp) console.log('CIN sourceDataPool element not set')
    }
    catch (err) { 
      console.log('CIN sourceDataPool element not found, err: ' + err)
    }
    if (!msg.source_dp) msg.source_dp = MessageInfo.config.homeDataPoolGln
    //console.log('final source_dp: ' + msg.source_dp)

    // there are 4 subtypes of CIN, 2 _from_ homde DP...
    if (msg.sender == MessageInfo.config.homeDataPoolGln) { // from home DP
      if (msg.receiver == msg.recipient) {
        console.log('>>> subscribed item forwarded from home DP to local TP')
      }
      else {
        console.log('>>> subscribed item forwarded from home DP to other DP for remote TP')
      }
    }
    // ...and 2 more _to_ home DP, these are repostable to DP
    else if (msg.receiver == MessageInfo.config.homeDataPoolGln) { // to home DP
      if (msg.sender == msg.provider) { // from local TP
        if (msg.provider == msg.recipient) { // 3. from TP (private draft item)
          console.log('>>> private draft item from local TP')
        }
        else if (MessageInfo.config.homeDataPoolGln == msg.recipient) {
          console.log('>>> item registration/update attempt from local TP')
        }
      }
      else { // from other dp
        console.log('>>> subscribed item received from other DP for local TP')
      }
    }

    var gtins = []
    $('tradeItem').each(function () {
      var the_gtin = $('tradeItem tradeItemIdentification gtin', this).first().text() 
      //console.log('the gtin: ' + the_gtin)
      gtins.push(the_gtin)
    })
    msg.gtins = gtins || []
    msg.gtin  = gtins && gtins.length && gtins[0]
    msg.item_count = (gtins && gtins.length) || (msg.gtin && 1)
  } // end CIN

  else if (msg.msg_type == 'catalogueItemPublication') {
    msg.recipient = $('catalogueItemPublication publishToGLN').text()
    msg.initial_load = $('catalogueItemPublication extension initialLoad').text()
    // item info:
    msg.gtin     = $('catalogueItemReference gtin').text()
    msg.provider = $('catalogueItemReference dataSource').text()
    msg.tm       = $('catalogueItemReference countryISOCode').text()
    msg.tm_sub   = $('catalogueItemReference countrySubDivisionISOCode').text() || 'na'
  }

  else if (msg.msg_type == 'catalogueItemSubscription') {
    msg.recipient = $('catalogueItemSubscription dataRecipient').text()
    //optional fields:
    msg.deliver   = $('catalogueItemSubscription extension deliver').text()
    msg.recipient = $('catalogueItemSubscription dataRecipient').text()
    msg.provider  = $('catalogueItemSubscription dataSource').text()
    msg.gtin      = $('catalogueItemSubscription gTIN').text()
  }
  else if (msg.msg_type == 'basicPartyRegistration') {
    msg.provider  = $('informationProviderOfParty gln').text()
  }
  else if (msg.msg_type == 'registryPartyDataDump') {
  }

  // for most messages, use the command type as the status (e.g. ADD, CORRECT, DELETE)
  if (!msg.status) msg.status = $('documentCommandHeader').first().attr('type') || 'na'

  // item ref is used by CIRR, CIC, CIP
  /*
  var catalog_item_ref = $('catalogueItemReference')
  if (catalog_item_ref.length) {
    msg.gtin     = $('gtin', catalog_item_ref).first().text()
    msg.provider = $('dataSource', catalog_item_ref).first().text()
    msg.tm       = $('countryISOCode', catalog_item_ref).first().text()
    msg.tm_sub   = $('countrySubDivisionISOCode', catalog_item_ref).first().text() || 'na'
  }
  */

  //console.log('final msg data: ' + JSON.stringify(msg))
  return msg
}

module.exports = function (config) {
  MessageInfo.config = config
  return MessageInfo
}

