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


    trade_item_date_info($28, $31)

    create_variants($28, $31)

    var $extension = $31('tradeItem > tradeItemInformation > extension').first()
    
    populate_delivery_info($28, $31, $extension)

    populate_description_info($28, $31, $extension)
    
    populate_measurements($28, $31, $extension)
    
    populate_variable_info($28, $31, $extension)
    
    return $31.html()

  } // end returned API function for module

  function trade_item_date_info ($28, $31) {
    log('trade_item_date_info')
    
    var $tid = $28('tradeItemDateInformation') // optional in 2.8

    var now = new Date().toISOString()

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
  }

  function populate_delivery_info($28, $31, $extension) {

    var $mod = $31('<delivery_purchasing_information:deliveryPurchasingInformationModule xmlns:delivery_purchasing_information="urn:gs1:gdsn:delivery_purchasing_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:delivery_purchasing_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DeliveryPurchasingInformationModule.xsd"/>')
    var $dpi = $31('<deliveryPurchasingInformation/>')
    $mod.append($dpi)

    var mod_has_data = false

    $28('tradingPartnerNeutralTradeItemInformation > tradeItemOrderInformation').first().each(function() {
      var mxbq = $28('agreedMaximumBuyingQuantity', this).text()
      if (mxbq) {
        mod_has_data = true
        $dpi.append($31('<agreedMaximumBuyingQuantity/>').text(mxbq))
      }
      var mnbq = $28('agreedMinimumBuyingQuantity', this).text()
      if (mnbq) {
        mod_has_data = true
        $dpi.append($31('<agreedMinimumBuyingQuantity/>').text(mnbq))
      }
    })

    var $tid = $28('tradeItemDateInformation') // optional in 2.8

    var cad = $28('consumerAvailabilityDateTime', $tid).text()
    if (cad) {
      mod_has_data = true
      $dpi.append($31('<consumerFirstAvailabilityDateTime/>').text(cad))
    }

    var fsd = $28('firstShipDate', $tid).text()
    if (fsd) {
      mod_has_data = true
      $dpi.append($31('<firstShipDateTime/>').text(fsd + 'T01:01:01.009Z'))
    }

    var ead = $28('endAvailabilityDateTime', $tid).text()
    if (ead) {
      mod_has_data = true
      $dpi.append($31('<endAvailabilityDateTime/>').text(ead))
    }

    var edt = $28('endDateTimeOfExclusivity', $tid).text()
    if (edt) {
      mod_has_data = true
      $dpi.append($31('<endDateTimeOfExclusivity/>').text(edt))
    }

    var edmxbq = $28('endDateMaximumBuyingQuantity', $tid).text()
    if (edmxbq) {
      mod_has_data = true
      $dpi.append($31('<endMaximumBuyingQuantityDateTime/>').text(edmxbq))
    }

    var edmnbq = $28('endDateMinimumBuyingQuantity', $tid).text()
    if (edmnbq) {
      mod_has_data = true
      $dpi.append($31('<endMinimumBuyingQuantityDateTime/>').text(edmnbq))
    }

    var fod = $28('firstOrderDate', $tid).text()
    if (fod) {
      mod_has_data = true
      $dpi.append($31('<firstOrderDateTime/>').text(fod + 'T01:01:01.009Z'))
    }

    var lod = $28('lastOrderDate', $tid).text()
    if (lod) {
      mod_has_data = true
      $dpi.append($31('<lastOrderDateTime/>').text(lod + 'T01:01:01.009Z'))
    }

    var lsd = $28('lastShipDate', $tid).text()
    if (lsd) {
      mod_has_data = true
      $dpi.append($31('<lastShipDateTime/>').text(lsd + 'T01:01:01.009Z'))
    }

    $28('tradingPartnerNeutralTradeItemInformation > tradeItemOrderInformation').first().each(function() {
      var oqmx = $28('orderQuantityMaximum', this).text()
      if (oqmx) {
        mod_has_data = true
        $dpi.append($31('<orderQuantityMaximum/>').text(oqmx))
      }
      var oqmn = $28('orderQuantityMinimum', this).text()
      if (oqmn) {
        mod_has_data = true
        $dpi.append($31('<orderQuantityMinimum/>').text(oqmn))
      }
      var oqmu = $28('orderQuantityMultiple', this).text()
      if (oqmu) {
        mod_has_data = true
        $dpi.append($31('<orderQuantityMultiple/>').text(oqmu))
      }
    })

    var sad = $28('startAvailabilityDateTime', $tid).text()
    if (sad) {
      mod_has_data = true
      $dpi.append($31('<startAvailabilityDateTime/>').text(sad))
    }

    var sdmxbq = $28('startDateMaximumBuyingQuantity', $tid).text()
    if (sdmxbq) {
      mod_has_data = true
      $dpi.append($31('<startDateMaximumBuyingQuantity/>').text(sdmxbq))
    }

    var sdmnbq = $28('startDateMinimumBuyingQuantity', $tid).text()
    if (sdmnbq) {
      mod_has_data = true
      $dpi.append($31('<startDateMinimumBuyingQuantity/>').text(sdmnbq))
    }

    var nsr = $28('tradingPartnerNeutralTradeItemInformation > tradeItemMarking > isNonSoldTradeItemReturnable').text()
    if (nsr)  {
      mod_has_data = true
      $dpi.append($31('<orderableReturnableInformation/>').append($31('<isNonSoldTradeItemReturnable/>').text(nsr)))
    }
    if (mod_has_data) $extension.append($mod)
  }

  function create_variants ($28, $31) {
    log('create_variants')

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
      else  $tii = $31('tradeItem > tradeItemInformation').first()
        
      log('$tii: ' + $tii)
      var $extension = $31('extension', $tii)

      populate_variant_allergen_info($28, $31, $extension, this)

      populate_variant_diet_info($28, $31, $extension, this)

      populate_variant_ingredient_info($28, $31, $extension, this)

      populate_variant_nutrient_info($28, $31, $extension, this)

    }) // end each 2.8 foodAndBeverageInformation
  }

  function populate_variant_allergen_info($28, $31, $extension, variant) {
    log('populate_variant_allergen_info')
    var $mod = $31('<allergen_information:allergenInformationModule xmlns:allergen_information="urn:gs1:gdsn:allergen_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:allergen_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/AllergenInformationModule.xsd"/>')
    var $allergens = $31('<allergenRelatedInformation/>')
    $mod.append($allergens)

    var mod_has_data = false

    $28('foodAndBeverageAllergyRelatedInformation', variant).first().each(function () { // only one of these
      var spec_agency = ''
      var spec_name   = ''
      $28('foodAndBeverageAllergen', this).each(function () {
        spec_agency = spec_agency || $28('allergenSpecificationAgency', this).text()
        spec_name   = spec_name   || $28('allergenSpecificationName'  , this).text()
        var type = $28('allergenTypeCode', this).text()
        var cont = $28('levelOfContainment', this).text()
        if (type && cont) {
          $allergens.append($31('<allergen><allergenTypeCode>' + type + '</allergenTypeCode><levelOfContainmentCode>' + cont + '</levelOfContainmentCode></allergen>'))
          mod_has_data = true
        }
      })

      if (spec_agency) $allergens.append($31('allergenSpecificationAgency').text(spec_agency))

      if (spec_name)   $allergens.append($31('allergenSpecificationName').text(spec_name))

      $28('allergenStatement > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('longText', this).text()
        if (lang && text) {
          $allergens.append($31('<allergenStatement/>').attr('languageCode', lang).text(text))
          mod_has_data = true
        }
      })
    })
    if (mod_has_data) $extension.append($mod)
  } // end populate variant allergens

    /*
    <diet_information:dietInformationModule xmlns:diet_information="urn:gs1:gdsn:diet_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:diet_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DietInformationModule.xsd">
    <dietInformation>
        <dietTypeDescription languageCode/>
        <dietTypeInformation>
            <dietTypeCode/>
            <dietTypeSubcode/>
            <dietCertification>
                <certificationAgency/>
                <certification>
                    <certificationValue/>
                </certification>
            </dietCertification>
        </dietTypeInformation>
    </dietInformation>
</diet_information:dietInformationModule>
    */
  function populate_variant_diet_info($28, $31, $extension, variant) {
    log('populate_variant_diet_info')
    var $mod = $31('<diet_information:dietInformationModule xmlns:diet_information="urn:gs1:gdsn:diet_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:diet_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DietInformationModule.xsd"/>')

    var mod_has_data = false

    $28('foodAndBeverageDietRelatedInformation', variant).each(function () { // can be many of these

        var $new_diet = $31('<dietInformation/>')
        var add_new = false

        $28('dietTypeDescription > description', this).each(function () {
          var lang = $28('language > languageISOCode', this).text()
          var text = $28('text', this).text()
          if (lang && text) {
            add_new = true
            $new_diet.append($31('<dietTypeDescription/>').attr('languageCode', lang).text(text))
          }
        })

        var type   = $28('foodAndBeverageDietTypeInformation > dietTypeCode', this).text()
        var subtype= $28('foodAndBeverageDietTypeInformation > dietTypeSubcode', this).text()
        var agency = $28('dietCertificationAgency', this).text()
        var value  = $28('dietCertificationNumber', this).text()

        if (type) {
          add_new = true

          var $dti = $31('<dietTypeInformation/>')
          $new_diet.append($dti)

          $dti.append($31('<dietTypeCode/>').text(type))

          if (subtype) {
            $dti.append($31('<dietTypeSubcode/>').text(subtype))
          }

          if (agency && value) {
            var $dc = $31('<dietCertification/>')
            $dti.append($dc)
            $dc.append($31('<certificationAgency/>').text(agency))
            $dc.append($31('<certification/>').append('<certificationValue/>').text(value))
          }
        }

        if (!add_new) return // didn't find any data

        mod_has_data = true
        $mod.append($new_diet)
    })

    if (mod_has_data) $extension.append($mod)

  } // end populate variant diet info

  function populate_variant_ingredient_info($28, $31, $extension, variant) {
    log('populate_variant_ingredient_info')
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
  } // end populate variant ingredients

  function populate_variant_nutrient_info($28, $31, $extension, variant) {
    log('populate_variant_nutrient_info')
    var $mod = $31('<nutritional_information:nutritionalInformationModule xmlns:nutritional_information="urn:gs1:gdsn:nutritional_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:nutritional_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/NutritionalInformationModule.xsd"/>')
    var mod_has_data = false

/*
<nutrientHeader>
  <preparationStateCode>PREPARED</preparationStateCode>
  <nutrientBasisQuantityTypeCode>BY_MEASURE</nutrientBasisQuantityTypeCode>
  <servingSize measurementUnitCode="Millilitre">12</servingSize>
  <servingSizeDescription languageCode="Afar">sd</servingSizeDescription>
  <nutrientDetail>
    <nutrientTypeCode>BIOT</nutrientTypeCode>
    <dailyValueIntakePercent>12</dailyValueIntakePercent>
    <measurementPrecisionCode>ABSENCE</measurementPrecisionCode>
    <quantityContained measurementUnitCode="Microgram">12</quantityContained>
  </nutrientDetail>
</nutrientHeader>
*/
    $28('foodAndBeverageNutrientInformation', variant).each(function () {
      mod_has_data = true
      var state = $28('preparationState', this).text()
      var $header = $31('<nutrientHeader/>').append($31('<preparationStateCode/>').text(state))
      $mod.append($header)
      $28('foodAndBeverageNutrient', this).each(function () {
        var prec = $28('measurementPrecision', this).text()
        var code = $28('nutrientTypeCode', this).attr('iNFOODSCodeValue')
        var perc = $28('percentageOfDailyValueIntake', this).text()

        var $detail = $31('<nutrientDetail/>')
        $detail.append($31('<nutrientTypeCode/>').text(code))
        if (perc) $detail.append($31('<dailyValueIntakePercent/>').text(perc))
        $detail.append($31('<measurementPrecisionCode/>').text(prec))
        $28('quantityContained > measurementValue', this).each(function() {
          var value = $28('value', this).text()
          var uom = $28(this).attr('unitOfMeasure')
          $detail.append($31('<quantityContained/>').attr('measurementUnitCode', uom).text(value))
        })
        $header.append($detail)
      })
    })

    if (mod_has_data) $extension.append($mod)
  } // end populate variant nutrients

  function populate_measurements($28, $31, $extension) {
    log('populate_measurements')
    var $mod = $31('<trade_item_measurements:tradeItemMeasurementsModule xmlns:trade_item_measurements="urn:gs1:gdsn:trade_item_measurements:xsd:3" xsi:schemaLocation="urn:gs1:gdsn:trade_item_measurements:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemMeasurementsModule.xsd"/>')
    var $tim = $31('<tradeItemMeasurements/>')
    $mod.append($tim)
    
    var mod_has_data = false

    $28('tradeItemMeasurements > depth > measurementValue').each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $tim.append($31('<depth/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > height > measurementValue').each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $tim.append($31('<height/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > width > measurementValue').each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $tim.append($31('<width/>').attr('measurementUnitCode', uom).text(value))
    })
    
    var $weight = $31('<tradeItemWeight/>') // create from scratch
    $tim.append($weight)
    
    $28('tradeItemMeasurements > netWeight > measurementValue').each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $weight.append($31('<netWeight/>').attr('measurementUnitCode', uom).text(value))
    })
    
    // TODO: grossWeight

    if (mod_has_data) $extension.append($mod)
    
  } // end populate measurements

  function populate_variable_info($28, $31, $extension) {
    log('populate_variable_info')
    var $mod = $31('<variable_trade_item_information:variableTradeItemInformationModule xmlns:variable_trade_item_information="urn:gs1:gdsn:variable_trade_item_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:variable_trade_item_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/VariableTradeItemInformationModule.xsd"/>')
    var $tim = $31('<variableTradeItemInformation/>')
    var $vtu = $31('<isTradeItemAVariableUnit/>') // create from scratch
    var text = $28('isTradeItemAVariableUnit').text()
    if (!text) return
    $vtu.text(text)
    $tim.append($vtu)
    $mod.append($tim)
    $extension.append($mod)
  } // end populate variable info

  function populate_description_info($28, $31, $extension) {
    log('populate_variable_info')
    var $mod = $31('<trade_item_description:tradeItemDescriptionModule xmlns:trade_item_description="urn:gs1:gdsn:trade_item_description:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_description:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemDescriptionModule.xsd"/>')
    var $info = $31('<tradeItemDescriptionInformation/>')
    $mod.append($info)
    $extension.append($mod)

    $28('tradeItemDescriptionInformation').each(function () { // should be only one
    
      $28('additionalTradeItemDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $info.append($31('<additionalTradeItemDescription/>').attr('languageCode', lang).text(text))
      })

      $28('descriptionShort > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $info.append($31('<descriptionShort/>').attr('languageCode', lang).text(text))
      })
      
      $28('functionalName > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $info.append($31('<functionalName/>').attr('languageCode', lang).text(text))
      })
      
      $28('invoiceName > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $info.append($31('<invoiceName/>').attr('languageCode', lang).text(text))
      })

      $31('labelDescription', $info).attr('languageCode', 'en').text('New label descripiton 500 field. Is there something from 2.8 we can map to here? TBD')

      var productRange = $28('productRange').text()
      if (productRange) {
        $info.append($31('<productRange/>').text(productRange))
      }

      $28('tradeItemDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $info.append($31('<tradeItemDescription/>').attr('languageCode', lang).text(text))
      })

      $28('tradeItemFormDescription', this).each(function () {
        $info.append($31('<tradeItemFormDescription/>').text($28(this).text()))
      })
      
      var tigicr = $28('tradeItemGroupIdentificationCode').text()
      if (tigicr) {
        $info.append($31('tradeItemGroupIdentificationCodeReference').text(tigicr))
      }

      $28('variant > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $info.append($31('<variantDescription/>').attr('languageCode', lang).text(text))
      })
      
      var $brand = $31('<brandNameInformation/>')
      $info.append($brand)

      $brand.append($31('<brandName/>').text($28('brandName').text() || 'na 70'))

      $28('languageSpecificBrandName > description').each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $brand.append($31('<languageSpecificBrandName />').attr('languageCode', lang).text(text))
      })

      $28('languageSpecificSubBrandName > description').each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $brand.append($31('<languageSpecificSubbrandName />').attr('languageCode', lang).text(text))
      })

      var subbrand = $28('subBrand' ).text()
      if (subbrand) {
        $brand.append($31('<subBrand/>').text(subbrand))
      }

    }) // end  $28('tradeItemDescriptionInformation').each
  } // end populate description info

}


