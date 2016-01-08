var log = console.log

module.exports = function (cheerio, gdsn) {
  
  return function (ti_28_xml) {

    log('>>>>>>>>>>>>>>>>>>>>>>>>> create 3.1 gdsn tradeItem from 2.8 xml with length ' + (ti_28_xml && ti_28_xml.length))

    if (!ti_28_xml || !ti_28_xml.length) return ''
    
    var now = new Date().toISOString()

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

    $31('brandName').text($28('brandName').text())

    var addId = $31('tradeItem > additionalTradeItemIdentification').remove()
    $28('tradeItem > tradeItemIdentification > additionalTradeItemIdentification').each(function () {
      var new_addId = addId.clone()
      new_addId.attr('additionalTradeItemIdentificationTypeCode', $28('additionalTradeItemIdentificationType', this).text())
      new_addId.text($28('additionalTradeItemIdentificationValue', this).text())
      $31('tradeItem > isTradeItemABaseUnit').before(new_addId)
    })

    $31('tradeItem > tradeItemUnitDescriptorCode').text($28('tradeItem > tradeItemUnitDescriptor').text())

    $31('gdsnTradeItemClassification > gpcCategoryCode').text($28('classificationCategoryCode > classificationCategoryCode'   ).first().text())
    $31('gdsnTradeItemClassification > gpcCategoryName').text($28('classificationCategoryCode > classificationCategoryName'   ).first().text() || 'na')
    $31('informationProviderOfTradeItem > gln'         ).text($28('informationProviderOfTradeItem > informationProvider > gln').first().text())
    //$31('informationProviderOfTradeItem > partyName'   ).text($28('informationProviderOfTradeItem > nameOfInformationProvider').first().text())

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

    trade_item_date_info($28, $31, now)

    return $31.html()

  } // end returned API function for module

  function trade_item_date_info ($28, $31, now) {

    var $tid = $28('tradeItemDateInformation') // optional in 2.8
    console.log('$tid:')
    console.dir($tid)

    var lcdt = $tid && $28('lastChangeDateTime', $tid).text() || now
    console.log('lastChangeDateTime: ' + lcdt)
    $31('tradeItemSynchronisationDates > lastChangeDateTime').text(lcdt) // required in 3.1

    var canceled_date = $28('canceledDate', $tid).first().text()
    if (canceled_date) {
      $31('tradeItemSynchronisationDates > cancelledDateTime').text(canceled_date + 'T01:01:01.009Z')
    }
    else {
      $31('tradeItemSynchronisationDates > cancelledDateTime').remove()
    }

    var cvdt = $28('communityVisibilityDateTime', $tid).first().text()
    if (cvdt) {
      $31('tradeItemSynchronisationDates > communityVisibilityDateTime').text(cvdt)
    }
    else {
      $31('tradeItemSynchronisationDates > communityVisibilityDateTime').remove()
    }

    var discontinued_date = $28('discontinuedDate', $tid).first().text()
    if (discontinued_date) {
      $31('tradeItemSynchronisationDates > discontinuedDateTime').text(discontinued_date + 'T01:01:01.009Z')
    }
    else {
      $31('tradeItemSynchronisationDates > discontinuedDateTime').remove()
    }

    var effective_date = $28('effectiveDate', $tid).first().text()
    if (effective_date) {
      $31('tradeItemSynchronisationDates > effectiveDateTime').text(effective_date + 'T01:01:01.009Z')
    }
    else {
      $31('tradeItemSynchronisationDates > effectiveDateTime').remove()
    }

    var publication_date = $28('publicationDate', $tid).first().text()
    if (publication_date) {
      $31('tradeItemSynchronisationDates > publicationDateTime').text(publication_date + 'T01:01:01.009Z')
    }
    else {
      $31('tradeItemSynchronisationDates > publicationDateTime').remove()
    }

    // deliveryPurchasingInformationModule
    var $dpi = $31('deliveryPurchasingInformation')
    var drop_dpi = true
    //agreedMaximumBuyingQuantity
    //agreedMinimumBuyingQuantity
    //canTradeItemBeBackOrdered
    //consumerFirstAvailabilityDateTime
    //firstDeliveryDateTime
    //firstShipDateTime
    var first_ship_date = $28('firstShipDate', $tid).text()
    if (first_ship_date) {
      drop_dpi = false
      $31('firstShipDateTime', $dpi).text(first_ship_date + 'T01:01:01.009Z')
    }
    else {
      $31('firstShipDateTime', $dpi).remove()
    }
    //endAvailabilityDateTime
    //endDateTimeOfExclusivity
    //endMaximumBuyingQuantityDateTime
    //endMinimumBuyingQuantityDateTime
    //firstOrderDateTime
    //goodsPickupLeadTime
    //isOneTimeBuy
    //isProductCustomizable
    //isTradeItemReorderable
    //isTradeItemShippedInMultipleConta
    //isTradeItemSizeBasedPricing
    //lastOrderDateTime
    //lastShipDateTime
    //orderingUnitOfMeasure
    if (drop_dpi) $dpi.parent().remove()
  }

}


