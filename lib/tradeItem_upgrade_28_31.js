var log = console.log

module.exports = function (cheerio, gdsn) {
  
  return function (ti_28_xml) {

    log('>>>>>>>>>>>>>>>>>>>>>>>>> create 3.1 gdsn tradeItem from 2.8 xml with length ' + (ti_28_xml && ti_28_xml.length))

    if (!ti_28_xml || !ti_28_xml.length) return ''
    
    var $28 = cheerio.load(ti_28_xml, {
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
    })

    var $31 = cheerio.load(gdsn.templates.ti_31, {
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
    })

    $31('tradeItem > gtin').text($28('tradeItem > tradeItemIdentification > gtin').text())
    $31('tradeItem > tradeItemUnitDescriptorCode').text($28('tradeItem > tradeItemUnitDescriptor').text())

    $31('gdsnTradeItemClassification > gpcCategoryCode').text($28('classificationCategoryCode > classificationCategoryCode'   ).first().text())
    $31('informationProviderOfTradeItem > gln'         ).text($28('informationProviderOfTradeItem > informationProvider > gln').first().text())
    $31('informationProviderOfTradeItem > partyName'   ).text($28('informationProviderOfTradeItem > nameOfInformationProvider').first().text())

    var child_count = 0
    var total_child_quantity = 0
    var child = $31('tradeItem > nextLowerLevelTradeItemInformation > childTradeItem').remove()
    $28('tradeItem > nextLowerLevelTradeItemInformation > childTradeItem').each(function () {
      child_count++
      var new_child = child.clone()
      $31('gtin', new_child).text($28('gtin', this).text())
      $31('quantityOfNextLowerLevelTradeItem', new_child).text($28('quantityofNextLowerLevelTradeItem', this).text())
      $31('tradeItem > nextLowerLevelTradeItemInformation').append(new_child)
    })
    if (!child_count) $31('tradeItem > nextLowerLevelTradeItemInformation').remove()
    else {
      $31('quantityOfChildren').text($28('quantityOfChildren').text())
      $31('totalQuantityOfNextLowerLevelTradeItem').text($28('totalQuantityOfNextLowerLevelTradeItem').text())
    }

    $31('tradeItem > targetMarket > targetMarketCountryCode').text($28('targetMarketCountryCode > countryISOCode').first().text())
    
    $28('tradingPartnerNeutralTradeItemInformation > tradeItemUnitIndicator').first().each(function () {
      $31('tradeItem > isTradeItemABaseUnit').text($28('isTradeItemABaseUnit', this).text())
      $31('tradeItem > isTradeItemAConsumerUnit').text($28('isTradeItemAConsumerUnit', this).text())
      $31('tradeItem > isTradeItemADespatchUnit').text($28('isTradeItemADespatchUnit', this).text())
      $31('tradeItem > isTradeItemAnInvoiceUnit').text($28('isTradeItemAnInvoiceUnit', this).text())
      $31('tradeItem > isTradeItemAnOrderableUnit').text($28('isTradeItemAnOrderableUnit', this).text())
    })

    $31('tradeItemSynchronisationDates > lastChangeDateTime').text($28('tradeItemDateInformation > lastChangeDateTime').first().text())
    $31('tradeItemSynchronisationDates > effectiveDateTime' ).text($28('tradeItemDateInformation > effectiveDate'     ).first().text() + 'T01:01:01')

    return $31.html()
  }
}


