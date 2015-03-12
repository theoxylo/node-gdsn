var cheerio   = require('cheerio')

var log = function (msg) { console.log('ItemInfo: ' + msg) }

// this constructor should be passed each single tradeItem xml element, not the cin document
var ItemInfo = module.exports = function (ti_xml, msg_id, trx_id, cmd_id, doc_id) {

  if (!ti_xml || !ti_xml.length) return this

  var item = this // for uniform use with callbacks

  item.xml = ti_xml

  var $ = cheerio.load(item.xml, {
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  item.msg_id = msg_id
  item.trx_id = trx_id
  item.cmd_id = cmd_id
  item.doc_id = doc_id
  
  item.provider  = $('informationProviderOfTradeItem > gln')      .text() // 3.1
                || $('informationProviderOfTradeItem > informationProvider > gln').text() // 2.8
  
  item.gtin      = $('tradeItem > gtin')                          .text() // 3.1
                || $('tradeItem > tradeItemIdentification > gtin').text() // 2.8
  
  item.tm        = $('targetMarket > targetMarketCountryCode')    .text() // 3.1
                || $('tradeItemInformation > targetMarketInformation > targetMarketCountryCode > countryISOCode').text() // 2.8
  
  item.tm_sub    = $('targetMarket > targetMarketSubdivisionCode').text() // 3.1
                || $('tradeItemInformation > targetMarketInformation > targetMarketSubdivisionCode > countrySubDivisionISOCode').text() // 2.8
                || 'na' // default
                
  item.unit_type = $('tradeItemUnitDescriptorCode')               .text() // 3.1
                || $('tradeItemUnitDescriptor')                   .text() // 2.8
  
  item.gpc       = $('gpcCategoryCode')                           .text() // 3.1
                || $('tradeItemInformation > classificationCategoryCode > classificationCategoryCode').text() // 2.8
  
  item.brand     = $('brandName')                                 .text() // 3.1 - this is now part of optional ti description module
                || $('tradeItemInformation tradeItemDescriptionInformation brandName').text() // 2.8

  item.child_count = $('quantityOfChildren').text()

  item.child_gtins = []
  $('childTradeItem > gtin').each(function () { // 3.1
    item.child_gtins.push($(this).text())
  })
  $('childTradeItem > tradeItemIdentification > gtin').each(function () { // 2.8
    item.child_gtins.push($(this).text())
  })
  // map not working in cheerio? 
  //item.child_gtins = $('childTradeItem > gtin').map(function (idx, el) { return $(el).text() })

  return item
}

