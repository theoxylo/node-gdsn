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

    var addId = $31('tradeItem > additionalTradeItemIdentification').remove()
    $28('tradeItem > tradeItemIdentification > additionalTradeItemIdentification').each(function () {
      var new_addId = addId.clone()
      new_addId.attr('additionalTradeItemIdentificationTypeCode', $28('additionalTradeItemIdentificationType', this).text())
      new_addId.text($28('additionalTradeItemIdentificationValue', this).text())
      $31('tradeItem > isTradeItemABaseUnit').before(new_addId)
    })

    $31('tradeItem > tradeItemUnitDescriptorCode').text($28('tradeItem > tradeItemUnitDescriptor').text())

    $31('tradeItem > informationProviderOfTradeItem > gln'         ).text($28('tradeItem > tradeItemInformation > informationProviderOfTradeItem > informationProvider > gln').first().text())
    $31('tradeItem > informationProviderOfTradeItem > partyName'   ).text($28('tradeItem > tradeItemInformation > informationProviderOfTradeItem > nameOfInformationProvider').first().text() || 'na')

    $28('tradeItem > tradeItemInformation > informationProviderOfTradeItem > informationProvider > additionalPartyIdentification').each(function () {
      var id   = $28('additionalPartyIdentificationValue', this).text()
      var type = $28('additionalPartyIdentificationType', this).text()
      $31('tradeItem > informationProviderOfTradeItem > gln').before($31('<additionalPartyIdentification/>').attr('additionalPartyIdentificationTypeCode', type).text(id))
    })

    $31('gdsnTradeItemClassification > gpcCategoryCode').text($28('classificationCategoryCode > classificationCategoryCode'   ).first().text())
    $31('gdsnTradeItemClassification > gpcCategoryName').text($28('classificationCategoryCode > classificationCategoryName'   ).first().text() || 'na')

    var class_attr = $31('gdsnTradeItemClassification > gDSNTradeItemClassificationAttribute').remove()
    $28('classificationCategoryCode > gDSNTradeItemClassificationAttribute').each(function () {
      var type  = $28('eANUCCClassificationAttributeTypeCode', this).text()
      var value = $28('eANUCCClassificationAttributeValueCode', this).text()
      var next = class_attr.clone()
      $31('gpcAttributeTypeCode', next).text(type)
      $31('gpcAttributeValueCode', next).text(value)
      $31('gdsnTradeItemClassification').append(next) 
    })

    var addl_class = $31('gdsnTradeItemClassification > additionalTradeItemClassification').remove()
    $28('classificationCategoryCode > additionalClassification').each(function () {
      var name = $28('additionalClassificationAgencyName', this).text()
      var code = $28('additionalClassificationCategoryCode', this).text()
      var next_class = addl_class.clone()
      $31('additionalTradeItemClassificationSystemCode', next_class).text(name)
      $31('additionalTradeItemClassificationCodeValue', next_class).text(code)
      $31('gdsnTradeItemClassification').append(next_class) 
    })

    $28('tradeItemDescriptionInformation').each(function () { // should be only 1, multiple source elements will be merged
    
      var $31_tidi = $31('tradeItemDescriptionInformation')

      $28('tradeItemDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $31('tradeItemDescription', $31_tidi).after($31('<tradeItemDescription/>').attr('languageCode', lang).text(text))
      })
      $31('tradeItemDescription', $31_tidi).first().remove()

      $28('descriptionShort > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $31('descriptionShort', $31_tidi).after($31('<descriptionShort/>').attr('languageCode', lang).text(text))
      })
      $31('descriptionShort', $31_tidi).first().remove()
      
      $28('functionalName > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $31('functionalName', $31_tidi).after($31('<functionalName/>').attr('languageCode', lang).text(text))
      })
      $31('functionalName', $31_tidi).first().remove()
      
      $28('invoiceName > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $31('invoiceName', $31_tidi).after($31('<invoiceName/>').attr('languageCode', lang).text(text))
      })
      $31('invoiceName', $31_tidi).first().remove()

      $31('labelDescription', $31_tidi).attr('languageCode', 'en').text('New label descripiton 500 field. Is there something from 2.8 we can map to here? TBD')

      $31('productRange').text($28('productRange').text() || 'default productRange 35')

      $28('additionalTradeItemDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $31('additionalTradeItemDescription', $31_tidi).after($31('<additionalTradeItemDescription/>').attr('languageCode', lang).text(text))
      })
      $31('additionalTradeItemDescription', $31_tidi).first().remove()

      // only one 3.1 brandNameInformation element allowed
      $31('brandNameInformation > brandName', $31_tidi).text($28('brandName').text() || 'na 70')

      $28('languageSpecificBrandName > description').each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $31('brandNameInformation > languageSpecificBrandName', $31_tidi).after($31('<languageSpecificBrandName />').attr('languageCode', lang).text(text))
      })
      $31('brandNameInformation > languageSpecificBrandName', $31_tidi).first().remove()

      $28('languageSpecificSubBrandName > description').each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $31('brandNameInformation > languageSpecificSubbrandName', $31_tidi).after($31('<languageSpecificSubbrandName />').attr('languageCode', lang).text(text))
      })
      $31('brandNameInformation > languageSpecificSubbrandName', $31_tidi).first().remove()

      var subbrand = $28('subBrand' ).text()
      if (subbrand) {
          $31('brandNameInformation > subBrand' , $31_tidi).text(subbrand)
      }
      else {
          $31('brandNameInformation > subBrand' , $31_tidi).remove()
      }

    }) // end  $28('tradeItemDescriptionInformation').each

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

    var tm     = $28('tradeItem > tradeItemInformation > targetMarketInformation> targetMarketCountryCode     > countryISOCode'           ).first().text()
    var tm_sub = $28('tradeItem > tradeItemInformation > targetMarketInformation> targetMarketSubdivisionCode > countrySubDivisionISOCode').first().text()

    $31('tradeItem > targetMarket > targetMarketCountryCode').text(tm)

    if (tm_sub)  $31('tradeItem > targetMarket > targetMarketSubdivisionCode').text(tm_sub)
    else         $31('tradeItem > targetMarket > targetMarketSubdivisionCode').remove()
    
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
    //console.log('$tid:')
    //console.dir($tid)

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


