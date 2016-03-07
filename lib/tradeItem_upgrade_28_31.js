var log = console.log

module.exports = function (cheerio, gdsn) {
  
  return function (ti_28_xml) {

    log('AUTO-CONVERT-28-31-©: create 3.1 gdsn tradeItem from 2.8 xml with length ' + (ti_28_xml && ti_28_xml.length))
    
    ti_28_xml = gdsn.trim_xml(ti_28_xml)

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

    $28('tradeItem > tradeItemInformation > tradeItemTradeChannel').each(function () {
      $31('tradeItem > tradeItemTradeChannelCode').after($31('<tradeItemTradeChannelCode/>').text($28(this).text()))
    })
    $31('tradeItem > tradeItemTradeChannelCode').first().remove()

    $28('tradingPartnerNeutralTradeItemInformation > brandOwnerOfTradeItem').each(function () {
      var gln = $28('brandOwner > gln', this).text()
      var name = $28('nameOfBrandOwner', this).text()
      $31('tradeItem > brandOwner').after($31('<brandOwner/>').append($31('<gln/>').text(gln)).append($31('<partyName/>').text(name)))
    })
    $31('tradeItem > brandOwner').first().remove()

    $28('tradeItem > tradeItemInformation > informationProviderOfTradeItem').each(function () {
      $31('tradeItem > informationProviderOfTradeItem > gln'         ).text($28('informationProvider > gln', this).first().text())
      $31('tradeItem > informationProviderOfTradeItem > partyName'   ).text($28('nameOfInformationProvider', this).first().text() || 'na')
    })

    $28('tradeItem > tradeItemInformation > informationProviderOfTradeItem > informationProvider > additionalPartyIdentification').each(function () {
      var id   = $28('additionalPartyIdentificationValue', this).text()
      var type = $28('additionalPartyIdentificationType', this).text()
      $31('tradeItem > informationProviderOfTradeItem > gln').before($31('<additionalPartyIdentification/>').attr('additionalPartyIdentificationTypeCode', type).text(id))
    })

    $28('tradingPartnerNeutralTradeItemInformation > manufacturerOfTradeItem').each(function () {
      var gln = $28('manufacturer > gln', this).text()
      var name = $28('nameOfManufacturer', this).text()
      $31('tradeItem > manufacturerOfTradeItem').after($31('<manufacturerOfTradeItem/>').append($31('<gln/>').text(gln)).append($31('<partyName/>').text(name)))
    })
    $31('tradeItem > manufacturerOfTradeItem').first().remove()

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

    //$28('tradeItem > tradeItemInformation > tradeItemDescriptionInformation > tradeItemExternalInformation').each(function () {
    $28('tradeItemExternalInformation').each(function () { // will include food and bev images!
      log('found 2.8 tradeItemExternalInformation element')
      var ref_file = $31('<referencedFileInformation/>')
      ref_file.append($31('<referencedFileTypeCode/>').text($28('typeOfInformation', this).text()))
      
      var file_end = $28('fileEffectiveEndDateTime', this).text()
      if (file_end) ref_file.append($31('<fileEffectiveEndDateTime/>').text(file_end))
      
      var now = new Date().toISOString()
      var file_start = $28('fileEffectiveStartDateTime', this).text() || now
      ref_file.append($31('<fileEffectiveStartDateTime/>').text(file_start))
      
      var format = $28('fileFormatName', this).text() || 'JPG'
      if (format) ref_file.append($31('<fileFormatName/>').text(format))
      
      var filename = $28('fileName', this).text() || 'filename'
      if (filename) ref_file.append($31('<fileName/>').text(filename))
      
      var url = $28('uniformResourceIdentifier', this).text() || 'http://url'
      if (url) ref_file.append($31('<uniformResourceIdentifier/>').text(url))
      $31('tradeItem > referencedFileInformation').after(ref_file)
    })
    $31('tradeItem > referencedFileInformation').first().remove()

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

    var $tii = $31('tradeItem > tradeItemInformation').first() // populate first TII already in template
    var $ext = $31('extension', $tii)

    alcohol_info($28, $31, $ext)

    var $28_fbInfo = $28('foodAndBeverageInformation').first()
    if ($28_fbInfo) {
      log('found fb info element')

      $28('productionVariantDescription', $28_fbInfo).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        if (lang && text) {
          log('found variant: ' + text)
          $ext.before($31('<productionVariantDescription/>').attr('languageCode', lang).text(text))
        }
      })
      var pved = $28('productionVariantEffectiveDate', $28_fbInfo).text()
      if (pved) $ext.before($31('<productionVariantEffectiveDateTime/>').text(pved + 'T01:01:01.009Z'))

      allergen_info($28, $31, $ext, $28_fbInfo)
    }

    consumer_instructions($28, $31, $ext)

    certification_info($28, $31, $ext)

    dairy_fish_meat_poultry($28, $31, $ext)
    
    dangerous_substance_info($28, $31, $ext)

    delivery_info($28, $31, $ext)

    if ($28_fbInfo) diet_info($28, $31, $ext, $28_fbInfo)

    farming_info($28, $31, $ext)

    if ($28_fbInfo) {

      food_and_bev_ingredient_info($28, $31, $ext, $28_fbInfo)

      nutrient_info($28, $31, $ext, $28_fbInfo)
    }

    packaging_info($28, $31, $ext)

    packaging_marking($28, $31, $ext)

    safety_info($28, $31, $ext)

    sales_info($28, $31, $ext)
    
    trade_item_data_carrier_info($28, $31, $ext)
    
    trade_item_description_info($28, $31, $ext)
    
    trade_item_measurements($28, $31, $ext)

    variable_info($28, $31, $ext)

    create_additional_variants($28, $31)

    return $31.html()

  } // end returned API function for module

  function trade_item_date_info ($28, $31) {
    log('trade_item_date_info')
    
    var $tid = $28('tradeItemDateInformation') // optional in 2.8

    var now = new Date().toISOString()

    var last_change = $tid && $28('lastChangeDateTime', $tid).text() || now
    log('lastChangeDateTime: ' + last_change)
    $31('tradeItemSynchronisationDates > lastChangeDateTime').text(last_change) // required in 3.1 XSD

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

    var effective_date = $28('effectiveDate', $tid).text()
    effective_date = effective_date ? effective_date + 'T01:01:01.009Z' : now
    $31('tradeItemSynchronisationDates > effectiveDateTime').text(effective_date) // required in 3.1 BMS

    var publication_date = $28('publicationDate', $tid).first().text()
    if (publication_date) {
      $31('tradeItemSynchronisationDates > publicationDateTime').text(publication_date + 'T01:01:01.009Z')
    }
    else {
      $31('tradeItemSynchronisationDates > publicationDateTime').remove()
    }
  }

  function trade_item_data_carrier_info($28, $31, $ext) {
    log('trade_item_data_carrier_info')
    var $mod = $31('<trade_item_data_carrier_and_identification:tradeItemDataCarrierAndIdentificationModule xmlns:trade_item_data_carrier_and_identification="urn:gs1:gdsn:trade_item_data_carrier_and_identification:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_data_carrier_and_identification:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemDataCarrierAndIdentificationModule.xsd"/>')
    var $info = $31('<dataCarrier/>')
    var $ele = $31('<dataCarrierTypeCode/>') // create from scratch
    //var text = $28('isTradeItemAVariableUnit').text()
    var text = 'EAN_8_COMPOSITE' // test
    if (!text) return
    $ele.text(text)
    $info.append($ele)
    $mod.append($info)
    $ext.append($mod)
  } // end data carrier info

  function alcohol_info($28, $31, $extension) {
    log('alcohol_info')
    var $mod = $31('<alcohol_information:alcoholInformationModule xmlns:alcohol_information="urn:gs1:gdsn:alcohol_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:alcohol_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/AlcoholInformationModule.xsd"/>')
    var $info = $31('<alcoholInformation/>')
    $info.append($31('<alcoholicPermissionLevel/>').text('12ee'))
    $info.append($31('<percentageOfAlcoholByVolume/>').text('20'))
    $mod.append($info)
    $extension.append($mod)
  } // end alcohol_info 

  function allergen_info($28, $31, $extension, variant) {
    if (!variant) return
    log('allergen_info')
    var $mod = $31('<allergen_information:allergenInformationModule xmlns:allergen_information="urn:gs1:gdsn:allergen_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:allergen_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/AllergenInformationModule.xsd"/>')
    var $allergens = $31('<allergenRelatedInformation/>')
    $mod.append($allergens)

    var mod_has_data = false

    $28('foodAndBeverageAllergyRelatedInformation', variant).first().each(function () { // only one of these per variant

      $28('allergenStatement > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('longText', this).text()
        if (lang && text) {
          $allergens.append($31('<allergenStatement/>').attr('languageCode', lang).text(text))
          mod_has_data = true
        }
      })

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
    })
    if (mod_has_data) {
      $allergens.append($31('<avpList/>').append($31('<stringAVP/>').attr('attributeName', 'allergenRelevantDataProvided').text('true')))
      $extension.append($mod)
    }
  } // end variant allergens

  function consumer_instructions($28, $31, $extension) {
    log('consumer_instructions')
    var $mod = $31('<consumer_instructions:consumerInstructionsModule xmlns:consumer_instructions="urn:gs1:gdsn:consumer_instructions:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:consumer_instructions:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/ConsumerInstructionsModule.xsd"/>')
    var $info = $31('<consumerInstructions/>')
    $info.append($31('<consumerStorageInstructions/>').attr('languageCode', 'en').text('some consumer storage instructions'))
    $mod.append($info)
    $extension.append($mod)
  } // end consumer_instructions 

  function certification_info($28, $31, $extension) {
    log('certification_info')
    var $mod = $31('<certification_information:certificationInformationModule xmlns:certification_information="urn:gs1:gdsn:certification_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:certification_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/CertificationInformationModule.xsd"/>')
    var $info = $31('<certificationInformation/>')
    $info.append($31('<certificationStandard/>').text('certification standard'))
    var $cert = $31('<certification/>')
    $cert.append($31('<certificationValue/>').text('some certification'))
    $info.append($cert)
    $mod.append($info)
    $extension.append($mod)
  } // end certification_info 

  function dairy_fish_meat_poultry($28, $31, $extension) {
    log('dairy_fish_meat_poultry')
    var $mod = $31('<dairy_fish_meat_poultry:dairyFishMeatPoultryItemModule xmlns:dairy_fish_meat_poultry="urn:gs1:gdsn:dairy_fish_meat_poultry:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:dairy_fish_meat_poultry:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DairyFishMeatPoultryItemModule.xsd"/>')
    var $info = $31('<dairyFishMeatPoultryInformation/>')
    $info.append($31('<casingTareWeight/>').attr('measurementUnitCode', 'ONZ').text('20'))
    $mod.append($info)
    $extension.append($mod)
  } // end dairy_fish_meat_poultry 

  function dangerous_substance_info($28, $31, $extension) {
    log('dangerous_substance_info')
    var $mod = $31('<dangerous_substance_information:dangerousSubstanceInformationModule xmlns:dangerous_substance_information="urn:gs1:gdsn:dangerous_substance_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:dangerous_substance_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DangerousSubstanceInformationModule.xsd"/>')
    var $info = $31('<dangerousSubstanceInformation/>')
    var $prop = $31('<dangerousSubstanceProperties/>')
    $info.append($prop)
    $prop.append($31('<isDangerousSubstance/>').text('FALSE'))
    $mod.append($info)
    $extension.append($mod)
  } // end dangerous_substance_info 

  function delivery_info($28, $31, $extension) {
    log('delievery_info')
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

  function diet_info($28, $31, $extension, variant) {
    if (!variant) return
    log('diet_info')
    var $mod = $31('<diet_information:dietInformationModule xmlns:diet_information="urn:gs1:gdsn:diet_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:diet_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DietInformationModule.xsd"/>')
    var $new_diet = $31('<dietInformation/>')

    var mod_has_data = false

    $28('foodAndBeverageDietRelatedInformation > dietTypeDescription > description', variant).each(function () {
      var add_new = false
      var lang = $28('language > languageISOCode', this).text()
      var text = $28('text', this).text()
      if (lang && text) {
        mod_has_data = true
        $new_diet.append($31('<dietTypeDescription/>').attr('languageCode', lang).text(text))
      }
    })

    $28('foodAndBeverageDietRelatedInformation', variant).each(function () { // can be many of these

        var type   = $28('foodAndBeverageDietTypeInformation > dietTypeCode', this).text()
        var subtype= $28('foodAndBeverageDietTypeInformation > dietTypeSubcode', this).text()
        var agency = $28('dietCertificationAgency', this).text()
        var value  = $28('dietCertificationNumber', this).text()

        if (type) {
          var $dti = $31('<dietTypeInformation/>')
          $new_diet.append($dti)

          $dti.append($31('<dietTypeCode/>').text(type))

          if (subtype) $dti.append($31('<dietTypeSubcode/>').text(subtype))

          if (agency && value) {
            var $dc = $31('<dietCertification/>')
            $dti.append($dc)
            $dc.append($31('<certificationAgency/>').text(agency))
            $dc.append($31('<certification/>').append('<certificationValue/>').text(value))
          }

          $mod.append($new_diet)
          mod_has_data = true
        }
    })

    if (mod_has_data) $extension.append($mod)

  } // end variant diet info

  function farming_info($28, $31, $extension) {
    log('farming info')
    var $mod = $31('<farming_and_processing_information:farmingAndProcessingInformationModule xmlns:farming_and_processing_information="urn:gs1:gdsn:farming_and_processing_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:farming_and_processing_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/FarmingAndProcessingInformationModule.xsd"/>')
    var $info = $31('<tradeItemOrganicInformation/>')
    $mod.append($info)
    $extension.append($mod)
  } // done farming_info

  function food_and_bev_ingredient_info($28, $31, $extension, variant) {
    if (!variant) return
    log('food_and_bev_ingredient_info')
    var $mod = $31('<food_and_beverage_ingredient:foodAndBeverageIngredientModule xmlns:food_and_beverage_ingredient="urn:gs1:gdsn:food_and_beverage_ingredient:xsd:3" xsi:schemaLocation="urn:gs1:gdsn:food_and_beverage_ingredient:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/FoodAndBeverageIngredientModule.xsd"/>')
    var mod_has_data = false

    $28('foodAndBeverageIngredientInformation > ingredientStatement > description', variant).each(function () {
      mod_has_data = true
      var lang = $28('language > languageISOCode', this).text()
      var text = $28('text', this).text()
      $mod.append($31('<ingredientStatement/>').attr('languageCode', lang).text(text))
    })

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

    if (mod_has_data) $extension.append($mod)
  } // end variant ingredients food_and_bev_ingredient_info

  function nutrient_info($28, $31, $extension, variant) {
    if (!variant) return
    log('nutrient_info')
    var $mod = $31('<nutritional_information:nutritionalInformationModule xmlns:nutritional_information="urn:gs1:gdsn:nutritional_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:nutritional_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/NutritionalInformationModule.xsd"/>')
    var mod_has_data = false

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
  } // end variant nutrients

  function trade_item_measurements($28, $31, $extension) {
    var $mod = $31('<trade_item_measurements:tradeItemMeasurementsModule xmlns:trade_item_measurements="urn:gs1:gdsn:trade_item_measurements:xsd:3" xsi:schemaLocation="urn:gs1:gdsn:trade_item_measurements:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemMeasurementsModule.xsd"/>')
    var $info = $31('<tradeItemMeasurements/>')
    $mod.append($info)
    
    var mod_has_data = false

    $28('tradeItemMeasurements > depth > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<depth/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > diameter > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<diameter/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > height > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<height/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > inBoxCubeDimension > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<inBoxCubeDimension/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > individualUnitMaximumSize > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<individualUnitMaximumSize/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > individualUnitMinimumSize > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<individualUnitMinimumSize/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > netContent > measurementValue').each(function () { // can be many of these
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<netContent/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > width > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<width/>').attr('measurementUnitCode', uom).text(value))
    })
    
    var $weight = $31('<tradeItemWeight/>') // create from scratch
    $info.append($weight)
    
    $28('tradeItemMeasurements > drainedWeight > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $weight.append($31('<drainedWeight/>').attr('measurementUnitCode', uom).text(value))
    })
    
    $28('tradeItemMeasurements > grossWeight > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $weight.append($31('<grossWeight/>').attr('measurementUnitCode', uom).text(value))
    })

    $28('tradeItemMeasurements > netWeight > measurementValue').first().each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $weight.append($31('<netWeight/>').attr('measurementUnitCode', uom).text(value))
    })
    
    if (mod_has_data) $extension.append($mod)
    
  } // end measurements

  function safety_info($28, $31, $extension) {
    log('safety_info')
    var $mod = $31('<safety_data_sheet:safetyDataSheetModule xmlns:safety_data_sheet="urn:gs1:gdsn:safety_data_sheet:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:safety_data_sheet:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/SafetyDataSheetModule.xsd"/>')
    var $info = $31('<safetyDataSheetInformation/>')
    $info.append($31('<sDSSheetNumber/>').text('12'))
    $mod.append($info)
    $extension.append($mod)
  } // end safety info

  function packaging_info($28, $31, $extension) {
    log('packaging_info')
    var $mod = $31('<packaging_information:packagingInformationModule xmlns:packaging_information="urn:gs1:gdsn:packaging_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:packaging_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/PackagingInformationModule.xsd"/>')
    var $info = $31('<packaging/>')
    $info.append($31('<doesPackagingHaveWheels/>').text('FALSE'))
    $mod.append($info)
    $extension.append($mod)
  } // end packaging info

  function packaging_marking($28, $31, $extension) {
    log('packaging_marking')
    var $mod = $31('<packaging_marking:packagingMarkingModule xmlns:packaging_marking="urn:gs1:gdsn:packaging_marking:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:packaging_marking:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/PackagingMarkingModule.xsd"/>')
    var $info = $31('<packagingMarking/>')
    $info.append($31('<consumerPackageDisclaimer/>').attr('languageCode', 'en').text('true'))
    $mod.append($info)
    $extension.append($mod)
  } // end packaging marking

  function sales_info($28, $31, $extension) {
    log('sales_info')
    var bdt = $28('tradeItem > tradeItemInformation > brandDistributionType').text()
    var pmt = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > tradeItemUnitIndicator > priceByMeasureType').text()
    if (!bdt && !pmt) return

    var $info = $31('<salesInformation/>')
    if (bdt) $info.append($31('<brandDistributionTypeCode/>').text(bdt))
    if (pmt) $info.append($31('<priceByMeasureTypeCode/>').text(pmt))

    var $mod = $31('<sales_information:salesInformationModule xmlns:sales_information="urn:gs1:gdsn:sales_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:sales_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/SalesInformationModule.xsd"/>')
    $mod.append($info)
    $extension.append($mod)
  } // end sales_info

  function variable_info($28, $31, $extension) {
    log('variable_info')
    var $mod = $31('<variable_trade_item_information:variableTradeItemInformationModule xmlns:variable_trade_item_information="urn:gs1:gdsn:variable_trade_item_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:variable_trade_item_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/VariableTradeItemInformationModule.xsd"/>')
    var $info = $31('<variableTradeItemInformation/>')
    var $ele = $31('<isTradeItemAVariableUnit/>') // create from scratch
    var text = $28('isTradeItemAVariableUnit').text()
    if (!text) return
    $ele.text(text)
    $info.append($ele)
    $mod.append($info)
    $extension.append($mod)
  } // end variable info

  function trade_item_description_info($28, $31, $extension) {
    log('trade_item_description_info')
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
  } // end description info

  function create_additional_variants($28, $31) {
    log('create_additional_variants')

    var skip = true // skip first food bev info since already handled above as non-variant

    $28('foodAndBeverageInformation').each(function () {
      log('found fb info element')

      if (skip) {
        skip = false
        return
      }

      var $atii = $31('<tradeItemInformation/>')
      $31('tradeItem > tradeItemSynchronisationDates').before($atii)

      $28('productionVariantDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        if (lang && text) {
          log('found additional variant: ' + text)
          $atii.append($31('<productionVariantDescription/>').attr('languageCode', lang).text(text))
        }
      })

      var pved = $28('productionVariantEffectiveDate', this).text()
      if (pved) $atii.append($31('<productionVariantEffectiveDateTime/>').text(pved + 'T01:01:01.009Z'))

      var $extension = $31('<extension/>')
      $atii.append($extension)

      allergen_info($28, $31, $extension, this)

      diet_info($28, $31, $extension, this)

      food_and_bev_ingredient_info($28, $31, $extension, this)

      nutrient_info($28, $31, $extension, this)

    }) // end each additional 2.8 foodAndBeverageInformation
  }

  function xxx($28, $31, $extension) {
    log('xxx')
    var $mod = $31('</>')
    var $info = $31('</>')
    $info.append($31('</>').text('FALSE'))
    $mod.append($info)
    $extension.append($mod)
  } // end xxx 

}


