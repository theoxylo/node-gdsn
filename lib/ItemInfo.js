var cheerio   = require('cheerio')

var log = function (msg) { console.log('ItemInfo: ' + msg) }

module.exports = function ItemInfo(xml) {

  if (!xml || !xml.length) return this

  var item = this // for uniform use with callbacks

  var $ = cheerio.load(xml, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  item.provider = $('informationProviderOfTradeItem informationProvider gln').first().text()
  log('provider: ' + item.provider)

  //item.xml = $.html('tradeItem') || ''
  //log('item xml: ' + item.xml)

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
