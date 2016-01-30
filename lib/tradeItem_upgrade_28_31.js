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
      $31('tradeItem > gtin').after(new_addId)
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

    $28('tradeItemDescriptionInformation').each(function () { // should be only one
    
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

      var productRange = $28('productRange').text()
      if (productRange) $31('productRange').text(productRange)
      else $31('productRange').remove()

      $28('additionalTradeItemDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $31('additionalTradeItemDescription', $31_tidi).after($31('<additionalTradeItemDescription/>').attr('languageCode', lang).text(text))
      })
      $31('additionalTradeItemDescription', $31_tidi).first().remove()

      $28('tradeItemFormDescription', this).each(function () {
        $31('tradeItemFormDescription', $31_tidi).after($31('<tradeItemFormDescription/>').text($28(this).text()))
      })
      $31('tradeItemFormDescription', $31_tidi).first().remove()
      
      var tigicr = $28('tradeItemGroupIdentificationCode').text()
      if (tigicr) $31('tradeItemGroupIdentificationCodeReference').text(tigicr)
      else $31('tradeItemGroupIdentificationCodeReference').remove()

      $28('variant > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $31('variantDescription', $31_tidi).after($31('<variantDescription/>').attr('languageCode', lang).text(text))
      })
      $31('variantDescription', $31_tidi).first().remove()
      
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

    $28('tradingPartnerNeutralTradeItemInformation > tradeItemMarking').first().each(function () {
      var $dpi = $31('deliveryPurchasingInformation')

      var nsr = $28('isNonSoldTradeItemReturnable', this).text()
      if (nsr)  $31('orderableReturnableInformation > isNonSoldTradeItemReturnable', $dpi).text(nsr)
      else       $31('orderableReturnableInformation').remove()
    })

    $28('tradingPartnerNeutralTradeItemInformation > tradeItemOrderInformation').first().each(function () {
      var $dpi = $31('deliveryPurchasingInformation')

      var mnbq = $28('agreedMinimumBuyingQuantity', this).text()
      if (mnbq)  $31('agreedMinimumBuyingQuantity', $dpi).text(mnbq)
      else       $31('agreedMinimumBuyingQuantity').remove()

      var mxbq = $28('agreedMaximumBuyingQuantity', this).text()
      if (mxbq)  $31('agreedMaximumBuyingQuantity', $dpi).text(mxbq)
      else       $31('agreedMaximumBuyingQuantity').remove()

      var oqmx = $28('orderQuantityMaximum', this).text()
      if (oqmx)  $31('orderQuantityMaximum', $dpi).text(oqmx)
      else       $31('orderQuantityMaximum').remove()

      var oqmn = $28('orderQuantityMinimum', this).text()
      if (oqmn)  $31('orderQuantityMinimum', $dpi).text(oqmn)
      else       $31('orderQuantityMinimum').remove()

      var oqmu = $28('orderQuantityMultiple', this).text()
      if (oqmu)  $31('orderQuantityMultiple', $dpi).text(oqmu)
      else       $31('orderQuantityMultiple').remove()
    })

    trade_item_date_info($28, $31, now)

    create_variants($28, $31) // this is where all extensions added so far will be copied

    return $31.html()

  } // end returned API function for module

  function trade_item_date_info ($28, $31, now) {

    var $tid = $28('tradeItemDateInformation') // optional in 2.8

    var lcdt = $tid && $28('lastChangeDateTime', $tid).text() || now
    log('lastChangeDateTime: ' + lcdt)
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

    // deliveryPurchasingInformationModule dates
    var $dpi = $31('deliveryPurchasingInformation')

    var cad = $28('consumerAvailabilityDateTime', $tid).text()
    if (cad)  $31('consumerFirstAvailabilityDateTime', $dpi).text(cad)
    else      $31('consumerFirstAvailabilityDateTime', $dpi).remove()

    var fsd = $28('firstShipDate', $tid).text()
    if (fsd)  $31('firstShipDateTime', $dpi).text(fsd + 'T01:01:01.009Z')
    else      $31('firstShipDateTime', $dpi).remove()

    var lsd = $28('lastShipDate', $tid).text()
    if (lsd)  $31('lastShipDateTime', $dpi).text(lsd + 'T01:01:01.009Z')
    else      $31('lastShipDateTime', $dpi).remove()

    var sad = $28('startAvailabilityDateTime', $tid).text()
    if (sad)  $31('startAvailabilityDateTime', $dpi).text(sad)
    else      $31('startAvailabilityDateTime', $dpi).remove()

    var ead = $28('endAvailabilityDateTime', $tid).text()
    if (ead)  $31('endAvailabilityDateTime', $dpi).text(ead)
    else      $31('endAvailabilityDateTime', $dpi).remove()

    var edt = $28('endDateTimeOfExclusivity', $tid).text()
    if (edt)  $31('endDateTimeOfExclusivity', $dpi).text(edt)
    else      $31('endDateTimeOfExclusivity', $dpi).remove()

    var edmxbq = $28('endDateMaximumBuyingQuantity', $tid).text()
    if (edmxbq)  $31('endMaximumBuyingQuantityDateTime', $dpi).text(edmxbq)
    else         $31('endMaximumBuyingQuantityDateTime', $dpi).remove()

    var edmnbq = $28('endDateMinimumBuyingQuantity', $tid).text()
    if (edmnbq)  $31('endMinimumBuyingQuantityDateTime', $dpi).text(edmnbq)
    else         $31('endMinimumBuyingQuantityDateTime', $dpi).remove()

    var sdmxbq = $28('startDateMaximumBuyingQuantity', $tid).text()
    if (sdmxbq)  $31('startDateMaximumBuyingQuantity', $dpi).text(sdmxbq)
    else         $31('startDateMaximumBuyingQuantity', $dpi).remove()

    var sdmnbq = $28('startDateMinimumBuyingQuantity', $tid).text()
    if (sdmnbq)  $31('startDateMinimumBuyingQuantity', $dpi).text(sdmnbq)
    else         $31('startDateMinimumBuyingQuantity', $dpi).remove()

    var fod = $28('firstOrderDate', $tid).text()
    if (fod)  $31('firstOrderDateTime', $dpi).text(fod + 'T01:01:01.009Z')
    else      $31('firstOrderDateTime', $dpi).remove()

    var lod = $28('lastOrderDate', $tid).text()
    if (lod)  $31('lastOrderDateTime', $dpi).text(lod + 'T01:01:01.009Z')
    else      $31('lastOrderDateTime', $dpi).remove()

  }

  function create_variants ($28, $31) {
    log('create_variants')

    var test = $31('tradeItem > tradeItemInformation').first()
    log('create_variants tii test: ' + test)
    
    $28('foodAndBeverageInformation').each(function () {
      log('found fb info element')

      var $tii = null 

      $28('productionVariantDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        if (lang && text) {
          if (!$tii) $tii = $31('<tradeItemInformation/>')
          log('found variant: ' + text)
          $tii.append($31('<productionVariantDescription/>').attr('languageCode', lang).text(text))
        }
      })

      var pved = $28('productionVariantEffectiveDate', this).text()
      if (pved && $tii) $tii.append($31('<productionVariantEffectiveDateTime/>').text(pved + 'T01:01:01.009Z'))

      if ($tii) $31('tradeItemSynchronisationDates').before($tii.append('<extension/>'))
      else $tii = $31('tradeItem > tradeItemInformation').first()

      log('$tii: ' + $tii)

      populate_variant_allergen_info($28, $31, $tii, this)

      populate_variant_diet_info($28, $31, $tii, this)

      populate_variant_ingredient_info($28, $31, $tii, this)

    }) // end each foodAndBeverageInformation
  }

  function populate_variant_allergen_info($28, $31, $tii, variant) {
    var $extension = $31('extension', $tii)
    $extension.append(gdsn.templates.ext_aim)

    var $allergens = $31('allergenRelatedInformation', $extension)
    log('$allergens: ' + $allergens)

    var empty_module = true

    $28('foodAndBeverageAllergyRelatedInformation', variant).first().each(function () { // only one of these
      var spec_agency = ''
      var spec_name   = ''
      $28('foodAndBeverageAllergen', this).each(function () {
        spec_agency = spec_agency || $28('allergenSpecificationAgency', this).text()
        spec_name   = spec_name   || $28('allergenSpecificationName'  , this).text()
        var type = $28('allergenTypeCode', this).text()
        var cont = $28('levelOfContainment', this).text()
        if (type && cont) {
          $31('allergen', $allergens).after($31('<allergen><allergenTypeCode>' + type + '</allergenTypeCode><levelOfContainmentCode>' + cont + '</levelOfContainmentCode></allergen>'))
          empty_module = false
        }
      })
      $31('allergen', $allergens).first().remove()

      if (spec_agency) $31('allergenSpecificationAgency', $allergens).text(spec_agency)
      else             $31('allergenSpecificationAgency', $allergens).remove()

      if (spec_name)   $31('allergenSpecificationName'  , $allergens).text(spec_name)
      else             $31('allergenSpecificationName'  , $allergens).remove()

      $28('allergenStatement > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('longText', this).text()
        if (lang && text) {
          $31('allergenStatement', $allergens).after($31('<allergenStatement/>').attr('languageCode', lang).text(text))
          empty_module = false
        }
      })
      $31('allergenStatement', $allergens).first().remove()
    })
    if (empty_module) $31('allergen_information\\:allergenInformationModule', $extension).remove()
  } // end populate variant allergens

  function populate_variant_diet_info($28, $31, $tii, variant) {

    var $extension = $31('extension', $tii)
    $extension.append(gdsn.templates.ext_diet)

    var empty_module = true // add at least one occurrence?

    var $diet_info = $31('dietInformation', $extension)
    log('$diet_info: ' + $diet_info)
    $28('foodAndBeverageDietRelatedInformation', variant).each(function () { // can be many of these

        var $new_diet = $diet_info.clone()
        var add_new = false

        var agency = $28('dietCertificationAgency', this).text()
        if (agency) {
          $31('dietTypeInformation > dietCertification > certificationAgency', $new_diet).text(agency)
          add_new = true
        }
        else {
          $31('dietTypeInformation > dietCertification > certificationAgency', $new_diet).remove()
        }
        var value  = $28('dietCertificationNumber', this).text()
        if (value) {
          $31('dietTypeInformation > dietCertification > certification > certificationValue', $new_diet).text(value)
          add_new = true
        }
        else {
          $31('dietTypeInformation > dietCertification > certification', $new_diet).remove()
        }
        if (!agency && !value) $31('dietTypeInformation > dietCertification', $new_diet).remove()

        $28('dietTypeDescription > description', this).each(function () {
          var lang = $28('language > languageISOCode', this).text()
          var text = $28('text', this).text()
          if (lang && text) {
            add_new = true
            $31('dietTypeDescription', $new_diet).after($31('<dietTypeDescription/>').attr('languageCode', lang).text(text))
          }
        })
        $31('dietTypeDescription', $new_diet).first().remove()

        var type = $28('foodAndBeverageDietTypeInformation > dietTypeCode', this).text()
        if (type) {
          $31('dietTypeInformation > dietTypeCode', $new_diet).text(type)
          add_new = true
        }
        else $31('dietTypeInformation > dietTypeCode', $new_diet).remove()

        var subtype = $28('foodAndBeverageDietTypeInformation > dietTypeSubcode', this).text()
        if (subtype) {
          $31('dietTypeInformation > dietTypeSubcode', $new_diet).text(subtype)
          add_new = true
        }
        else $31('dietTypeInformation > dietTypeSubcode', $new_diet).remove()

        if (!add_new) return // didn't find any data

        empty_module = false

        $diet_info.after($new_diet)
    })

    if (empty_module) $31('diet_information\\:dietInformationModule', $extension).remove()
    else $diet_info.first().remove()

  } // end populate variant diet info

  function populate_variant_ingredient_info($28, $31, $tii, variant) {

    var $extension = $31('extension', $tii)
    //$extension.append(gdsn.templates.ext_fbim)
    //var $mod = $31(gdsn.templates.ext_fbim) // only create, append later
    var $mod = $31('<food_and_beverage_ingredient:foodAndBeverageIngredientModule xmlns:food_and_beverage_ingredient="urn:gs1:gdsn:food_and_beverage_ingredient:xsd:3" xsi:schemaLocation="urn:gs1:gdsn:food_and_beverage_ingredient:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/FoodAndBeverageIngredientModule.xsd"/>')
    var mod_has_data = false

    $28('foodAndBeverageIngredientInformation > foodAndBeverageIngredient', variant).each(function () {
      mod_has_data = true

      var $ing = $31('<foodAndBeverageIngredient/>') // create from scratch
      $mod.append($ing)

      var seq = $28('ingredientSequence', this).text()
      if (seq) $ing.append($31('<ingredientSequence/>').text(seq))

      var per = $28('contentPercentage', this).text()
      if (per) $ing.append($31('<ingredientContentPercentage/>').text(per))

      $28('ingredientName > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $ing.append($31('<ingredientName/>').attr('languageCode', lang).text(text))
      })
    })

    $28('foodAndBeverageIngredientInformation > ingredientStatement > description', variant).each(function () {
      mod_has_data = true
      var lang = $28('language > languageISOCode', this).text()
      var text = $28('text', this).text()
      $mod.append($31('<ingredientStatement/>').attr('languageCode', lang).text(text))
    })

    if (mod_has_data) $extension.append($mod)
    //if (empty_module) $31('food_and_beverage_ingredient\\:foodAndBeverageIngredientModule', $extension).remove()
  } // end populate variant ingredients

}


