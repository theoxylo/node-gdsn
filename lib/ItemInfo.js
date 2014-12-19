var cheerio     = require('cheerio')

var log = function (msg) { console.log('ItemInfo: ' + msg) }

var ItemInfo = function (xml) {

  log('Creating new instance of ItemInfo for xml of length ' + (xml && xml.length))

  if (!(this instanceof ItemInfo)) return new ItemInfo(xml)

  if (!xml || !xml.length) return this

  var item = this // for uniform use with callbacks

  item.raw_xml = xml
  var clean_xml = ItemInfo.config.gdsn.clean_xml(xml)

  var $ = cheerio.load(clean_xml, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  item.msg_id = $('DocumentIdentification InstanceIdentifier').text()

  var created_date_time = $('DocumentIdentification CreationDateAndTime').text()
  item.created_ts = (new Date(created_date_time)).getTime()

  var msg_type = $('DocumentIdentification Type').text()
  var version = $('DocumentIdentification TypeVersion').text()
  log('message type: ' + msg_type + ', version: ' + version)
  if (msg_type != 'catalogueItemNotification') return item
    
  item.provider = $('informationProviderOfTradeItem informationProvider gln').first().text()
  log('provider: ' + item.provider)

  item.recipient = $('dataRecipient').first().text()
  if (!item.recipient) {
    // default recipient is the provider itself (a private 'draft' item)
    item.recipient = item.provider
  }
  log('recipient: ' + item.recipient)

  try {
    item.source_dp = $('sourceDataPool').first().text()
    if (!item.source_dp) log('sourceDataPool element not set')
  }
  catch (err) { 
    log('sourceDataPool element not found, err: ' + err)
  }
  if (!item.source_dp) item.source_dp = ItemInfo.config.homeDataPoolGln
  //log('final source_dp: ' + item.source_dp)

  // there are 4 subtypes of CIN, 2 _from_ home DP...
  var sender = $('StandardBusinessDocumentHeader Sender Identifier').text()
  var receiver = $('StandardBusinessDocumentHeader Receiver Identifier').text()

  if (sender == ItemInfo.config.homeDataPoolGln) { // from home DP
    if (receiver == item.recipient) {
      log('>>> subscribed item forwarded from home DP to local TP')
    }
    else {
      log('>>> subscribed item forwarded from home DP to other DP for remote TP')
    }
  }
  // ...and 2 more _to_ home DP, these are repostable to DP
  else if (receiver == ItemInfo.config.homeDataPoolGln) { // to home DP
    if (sender == item.provider) { // from local TP
      if (item.provider == item.recipient) { // 3. from TP (private draft item)
        log('>>> private draft item from local TP')
      }
      else if (ItemInfo.config.homeDataPoolGln == item.recipient) {
        log('>>> item registration/update attempt from local TP')
      }
    }
    else { // from other dp
      log('>>> subscribed item received from other DP for local TP')
    }
  }

  item.xml = $.html('tradeItem') || ''
  log('item xml: ' + item.xml)

  item.gtin      = $('tradeItem tradeItemIdentification gtin').first().text()
  item.unit_type = $('tradeItem tradeItemUnitDescriptor').first().text()
  item.tm        = $('tradeItem tradeItemInformation targetMarketInformation targetMarketCountryCode countryISOCode').first().text()
  item.gpc       = $('tradeItem tradeItemInformation classificationCategoryCode classificationCategoryCode').first().text()
  item.brand     = $('tradeItem tradeItemInformation tradeItemDescriptionInformation brandName').first().text()
  item.tm_sub    = $('tradeItem tradeItemInformation targetMarketInformation targetMarketSubdivisionCode countrySubDivisionISOCode').first().text()
  if (!item.tm_sub) item.tm_sub = 'na'

  // child items
  item.child_count = $('quantityOfChildren').first().text()
  item.child_gtins = $('childTradeItem tradeItemIdentification gtin').map(function (idx, it) {
    var child_gtin = $(it).text()
    log('found child gtin: ' + child_gtin)
    return child_gtin
  })
  if (item.child_count != item.child_gtins.length) {
    log('WARNING: child count ' + item.child_count + ' does not match child gtin array length: ' + item.child_gtins && item.child_gtins.length)
  }

  //log('final item data: ' + JSON.stringify(item))
  return item
}

module.exports = function (config) {
  ItemInfo.config = config
  return ItemInfo
}

