var cheerio   = require('cheerio')

var log = function (msg) { console.log('TradeItemInfo: ' + msg) }

// this constructor should be passed each single tradeItem xml element, not the cin document
var TradeItemInfo = module.exports = function (ti_xml, msg_id, trx_id, cmd_id, doc_id) {

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

  item.provider = $('tradeItem>                     informationProviderOfTradeItem>                    gln').text() // 3.1
               || $('tradeItem>tradeItemInformation>informationProviderOfTradeItem>informationProvider>gln').text() // 2.8

  item.recipient = item.provider // default recipient is the provider, making this a "draft item", recipient can be changed to DP or subscriber later

  item.gtin      = $('tradeItem>                        gtin').text() // 3.1
  if (item.gtin) item.version = '3.1'
  else {
    item.gtin = $('tradeItem>tradeItemIdentification>gtin').text() // 2.8
    if (item.gtin) item.version = '2.8'
  }

  item.tm        = $('tradeItem>                     targetMarket>           targetMarketCountryCode'               ).text() // 3.1
                || $('tradeItem>tradeItemInformation>targetMarketInformation>targetMarketCountryCode>countryISOCode').text() // 2.8
                || '840' // stupid simple default

  item.tm_sub    = $('tradeItem>           targetMarket>           targetMarketSubdivisionCode'                          ).text() // 3.1
                || $('tradeItemInformation>targetMarketInformation>targetMarketSubdivisionCode>countrySubDivisionISOCode').text() // 2.8
                || 'na' // default

  item.unit_type = $('tradeItem>tradeItemUnitDescriptorCode').text() // 3.1
                || $('tradeItem>tradeItemUnitDescriptor'    ).text() // 2.8

  item.gpc       = $('tradeItem>gdsnTradeItemClassification>gpcCategoryCode'                               ).text() // 3.1
                || $('tradeItem>tradeItemInformation>classificationCategoryCode>classificationCategoryCode').text() // 2.8

  item.brand     = $('brandNameInformation>brandName')           .text() // 3.1 - this is now part of optional ti description module
                || $('tradeItemDescriptionInformation>brandName').text() // 2.8
                || 'na' // default

  item.child_count = $('quantityOfChildren').text()

  item.cancelledDate    = $('tradeItemSynchronisationDates>cancelledDateTime')   .text()
  item.discontinuedDate = $('tradeItemSynchronisationDates>discontinuedDateTime').text()
  item.lastChangeDate   = $('tradeItemSynchronisationDates>lastChangeDateTime')  .text()
  item.effectiveDate    = $('tradeItemSynchronisationDates>effectiveDateTime')   .text()

  // mds attributes:
  item.vendorId             = $('tradeItem>extension>mdsOmsExtension>vendorId').text()              // custom MDS extension
  item.buyerId              = $('tradeItem>extension>mdsOmsExtension>buyerId').text()               // custom MDS extension
  item.itemOwnerProductCode = $('tradeItem>extension>mdsOmsExtension>itemOwnerProductCode').text()  // custom MDS extension
  item.portalChar           = $('tradeItem>extension>mdsOmsExtension>portalChar').text()            // custom MDS extension
  if (item.gtin) {
    item.gdsn = true
  }
  else {
    item.gdsn     = false
    item.gtin     = item.itemOwnerProductCode
    item.provider = item.provider || item.vendorId
  }


  item.child_gtins = []
  $('childTradeItem>gtin').each(function () { // 3.1
    item.child_gtins.push($(this).text())
  })
  $('childTradeItem>tradeItemIdentification>gtin').each(function () { // 2.8
    item.child_gtins.push($(this).text())
  })

  return item
}

