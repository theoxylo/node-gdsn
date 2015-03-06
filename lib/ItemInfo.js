var cheerio   = require('cheerio')

var log = function (msg) { console.log('ItemInfo: ' + msg) }

var ItemInfo = module.exports = function (xml, msg_id, trx_id, cmd_id) {

  if (!xml || !xml.length) return this

  var item = this // for uniform use with callbacks

  var $ = cheerio.load(xml, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // 3.1
  item.msg_id = msg_id
  item.trx_id = trx_id
  item.cmd_id = cmd_id
  item.doc_id    = $('entityIdentification').text()

  item.provider  = $('informationProviderOfTradeItem > gln')      .text()
  item.gtin      = $('tradeItem > gtin')                          .text()
  item.tm        = $('targetMarket > targetMarketCountryCode')    .text()
  item.tm_sub    = $('targetMarket > targetMarketSubdivisionCode').text() || 'na'
  item.unit_type = $('tradeItemUnitDescriptorCode')               .text()
  item.gpc       = $('gpcCategoryCode')                           .text()
  item.brand     = $('brandName')                                 .text() // this is now part of optional ti description module

  // child items
  item.child_count = $('quantityOfChildren').text()

  item.child_gtins = []
  $('childTradeItem > gtin').each(function () {
    item.child_gtins.push($(this).text())
  })

  if (item.child_count != item.child_gtins.length) {
    log('WARNING: child count ' + item.child_count + ' does not match child gtin array length: ' + item.child_gtins && item.child_gtins.length)
  }

  // 2.8
  /*
  item.provider = $('informationProviderOfTradeItem > informationProvider > gln').text()
  log('item provider: ' + item.provider)

  item.gtin      = $('tradeItem > tradeItemIdentification > gtin').text() // need "tradeItem" to skip related gtins
  item.unit_type = $('tradeItemUnitDescriptor').text()
  item.tm        = $('tradeItemInformation targetMarketInformation targetMarketCountryCode countryISOCode').text()
  item.gpc       = $('tradeItemInformation classificationCategoryCode classificationCategoryCode').text()
  item.brand     = $('tradeItemInformation tradeItemDescriptionInformation brandName').text()
  item.tm_sub    = $('tradeItemInformation targetMarketInformation targetMarketSubdivisionCode countrySubDivisionISOCode').text()
  if (!item.tm_sub) item.tm_sub = 'na'
  // child items
  item.child_count = $('quantityOfChildren').text()
  item.child_gtins = $('childTradeItem tradeItemIdentification gtin').map(function (idx, it) {
    var child_gtin = $(it).text()
    log('found child gtin: ' + child_gtin)
    return child_gtin
  })
  if (item.child_count != item.child_gtins.length) {
    log('WARNING: child count ' + item.child_count + ' does not match child gtin array length: ' + item.child_gtins && item.child_gtins.length)
  }
  */

  return item
}
