var log = console.log

var BAR = require('./barcode_28_31.js')
var PAL = require('./pallet_28_31.js')
var UOM = require('./uom_28_31.js')

module.exports = function (cheerio, gdsn) {
  
  return function api(xml) {
    try {
      return convert_ti_xml(xml)
    }
    catch (e) {
      log(e)
      return xml
    }
  }

  function convert_ti_xml(xml) {

    log('AUTO-CONVERT-28-31-©: create 3.1 gdsn tradeItem from 2.8 xml with length ' + (xml && xml.length))
    
    xml = gdsn.trim_xml(xml)

    if (!xml || !xml.length) return ''
    
    var $28 = cheerio.load(xml, {
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
      , decodeEntities: false
    })

    var xml_31
    var ti28
    $28('tradeItem').first().each(function () {
      if ($28('tradeItem > gtin', this).text()) {
        log('found 3.1 tradeItem')
        xml_31 = $28(this).toString() // appears to already be 3.1
        return 
      }
      ti28 = this // only use first tradeItem from source xml in case of large CIN, etc
    })
    if (xml_31) return xml_31

    var $31 = cheerio.load(gdsn.templates.ti_31, {
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
      , decodeEntities: false
    })

    $31('tradeItem > gtin').text($28('tradeItem > tradeItemIdentification > gtin', ti28).text())

    var addId = $31('tradeItem > additionalTradeItemIdentification').remove()
    $28('tradeItem > tradeItemIdentification > additionalTradeItemIdentification', ti28).each(function () {
      var new_addId = addId.clone()
      new_addId.attr('additionalTradeItemIdentificationTypeCode', $28('additionalTradeItemIdentificationType', this).text())
      new_addId.text($28('additionalTradeItemIdentificationValue', this).text())
      $31('tradeItem > gtin').after(new_addId)
    })

    $31('tradeItem > tradeItemUnitDescriptorCode').text($28('tradeItem > tradeItemUnitDescriptor', ti28).text())

    $28('tradeItem > tradeItemInformation > tradeItemTradeChannel', ti28).each(function () {
      $31('tradeItem > tradeItemTradeChannelCode').after($31('<tradeItemTradeChannelCode/>').text($28(this).text()))
    })
    $31('tradeItem > tradeItemTradeChannelCode').first().remove()

    $28('tradingPartnerNeutralTradeItemInformation > brandOwnerOfTradeItem', ti28).first().each(function () { // 0 or 1
      var $gln = $31('<gln/>').text($28('brandOwner > gln', this).text())
      var name = $28('nameOfBrandOwner', this).text()
      $31('tradeItem > brandOwner').after($31('<brandOwner/>').append($gln).append($31('<partyName/>').text(name)))
      $28('brandOwner > additionalPartyIdentification', this).each(function () {
        var id   = $28('additionalPartyIdentificationValue', this).text()
        var type = $28('additionalPartyIdentificationType', this).text()
        $gln.before($31('<additionalPartyIdentification/>').attr('additionalPartyIdentificationTypeCode', type).text(id))
      })
      $gln.after($31('<partyAddress/>').text('na'))
    })
    $31('tradeItem > brandOwner').first().remove()

    $28('tradeItem > tradeItemInformation > informationProviderOfTradeItem', ti28).first().each(function () { // 1 and only 1
      var partyName = $28('nameOfInformationProvider', this).first().text()
      log('partyName ............................................................... ' + partyName)
      $31('tradeItem > informationProviderOfTradeItem > gln'      ).text($28('informationProvider > gln', this).first().text())
      $31('tradeItem > informationProviderOfTradeItem > partyName').text(partyName || 'na')
      $28('informationProvider > additionalPartyIdentification', this).each(function () {
        var id   = $28('additionalPartyIdentificationValue', this).text()
        var type = $28('additionalPartyIdentificationType', this).text()
        $31('tradeItem > informationProviderOfTradeItem > gln').before($31('<additionalPartyIdentification/>').attr('additionalPartyIdentificationTypeCode', type).text(id))
      })
    })

    $28('tradingPartnerNeutralTradeItemInformation > manufacturerOfTradeItem', ti28).each(function () { // 0..*
      var $gln = $31('<gln/>').text($28('manufacturer > gln', this).text())
      var name = $28('nameOfManufacturer', this).text()
      $31('tradeItem > manufacturerOfTradeItem').after($31('<manufacturerOfTradeItem/>').append($gln).append($31('<partyName/>').text(name)))
      $28('manufacturer > additionalPartyIdentification', this).each(function () {
        var id   = $28('additionalPartyIdentificationValue', this).text()
        var type = $28('additionalPartyIdentificationType', this).text()
        $gln.before($31('<additionalPartyIdentification/>').attr('additionalPartyIdentificationTypeCode', type).text(id))
      })
      $gln.after($31('<partyAddress/>').text('na'))
    })
    $31('tradeItem > manufacturerOfTradeItem').first().remove()

    var display = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > tradeItemMeasurements', ti28).attr('hasDisplayReadyPackaging') || 'NOT_APPLICABLE'
    $31('tradeItem > displayUnitInformation').append($31('<hasDisplayReadyPackaging/>').text(display))
    $31('tradeItem > displayUnitInformation').append($31('<isTradeItemADisplayUnit/>').text($28('tradeItem > isTradeItemADisplayUnit', ti28).text() || 'FALSE'))

    $28('classificationCategoryCode', ti28).first().each(function () {
        $31('gdsnTradeItemClassification > gpcCategoryCode').text($28('classificationCategoryCode > classificationCategoryCode', this).first().text())
        $31('gdsnTradeItemClassification > gpcCategoryName').text($28('classificationCategoryCode > classificationCategoryName', this).first().text() || 'na')
    })

    var class_attr = $31('gdsnTradeItemClassification > gDSNTradeItemClassificationAttribute').remove()
    $28('classificationCategoryCode > gDSNTradeItemClassificationAttribute', ti28).each(function () {
      var type  = $28('eANUCCClassificationAttributeTypeCode', this).text()
      var value = $28('eANUCCClassificationAttributeValueCode', this).text()
      var new_attr = class_attr.clone()
      $31('gpcAttributeTypeCode', new_attr).text(type)
      $31('gpcAttributeValueCode', new_attr).text(value)
      $31('gdsnTradeItemClassification').append(new_attr) 
    })

    var addl_class = $31('gdsnTradeItemClassification > additionalTradeItemClassification').remove()
    $28('classificationCategoryCode > additionalClassification', ti28).each(function () {
      var name = $28('additionalClassificationAgencyName', this).text()
      var code = $28('additionalClassificationCategoryCode', this).text()
      var next_class = addl_class.clone()
      $31('additionalTradeItemClassificationSystemCode', next_class).text(name)
      $31('additionalTradeItemClassificationValue > additionalTradeItemClassificationCodeValue', next_class).text(code)
      $31('gdsnTradeItemClassification').append(next_class) 
    })

    var child_count = 0
    var total_child_quantity = 0
    var child = $31('tradeItem > nextLowerLevelTradeItemInformation > childTradeItem').remove()
    $28('tradeItem > nextLowerLevelTradeItemInformation > childTradeItem', ti28).each(function () {
      child_count++
      var new_child = child.clone()
      $31('gtin', new_child).text($28('gtin', this).text())
      $31('quantityOfNextLowerLevelTradeItem', new_child).text($28('quantityofNextLowerLevelTradeItem', this).text())
      $31('tradeItem > nextLowerLevelTradeItemInformation').append(new_child)
    })
    if (!child_count) $31('tradeItem > nextLowerLevelTradeItemInformation').remove()
    else {
      $31('quantityOfChildren').text($28('quantityOfChildren', ti28).text())
      $31('totalQuantityOfNextLowerLevelTradeItem').text($28('totalQuantityOfNextLowerLevelTradeItem', ti28).text())
    }

    //$28('tradeItem > tradeItemInformation > tradeItemDescriptionInformation > tradeItemExternalInformation').each(function () {
    $28('tradeItemExternalInformation', ti28).each(function () { // will include food and bev images!
      log('found 2.8 tradeItemExternalInformation element')

      var ref_file = $31('<referencedFileInformation/>')
      ref_file.append($31('<referencedFileTypeCode/>').text($28('typeOfInformation', this).text()))
      
      $28('contentDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        if (lang && text) ref_file.append($31('<contentDescription/>').attr('languageCode', lang).text(text))
      })

      var file_end = $28('fileEffectiveEndDateTime', this).text()
      if (file_end) ref_file.append($31('<fileEffectiveEndDateTime/>').text(file_end))
      
      var file_start = $28('fileEffectiveStartDateTime', this).text() || new Date().toISOString()
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

    var tm     = $28('tradeItem > tradeItemInformation > targetMarketInformation> targetMarketCountryCode     > countryISOCode'           , ti28).first().text()
    var tm_sub = $28('tradeItem > tradeItemInformation > targetMarketInformation> targetMarketSubdivisionCode > countrySubDivisionISOCode', ti28).first().text()

    $31('tradeItem > targetMarket > targetMarketCountryCode').text(tm)

    if (tm_sub)  $31('tradeItem > targetMarket > targetMarketSubdivisionCode').text(tm_sub)
    else         $31('tradeItem > targetMarket > targetMarketSubdivisionCode').remove()
    
    $28('tradingPartnerNeutralTradeItemInformation > tradeItemUnitIndicator', ti28).first().each(function () {
      $31('tradeItem > isTradeItemABaseUnit').text($28('isTradeItemABaseUnit', this).text())
      $31('tradeItem > isTradeItemAConsumerUnit').text($28('isTradeItemAConsumerUnit', this).text())
      $31('tradeItem > isTradeItemADespatchUnit').text($28('isTradeItemADespatchUnit', this).text())
      $31('tradeItem > isTradeItemAnInvoiceUnit').text($28('isTradeItemAnInvoiceUnit', this).text())
      $31('tradeItem > isTradeItemAnOrderableUnit').text($28('isTradeItemAnOrderableUnit', this).text())
    })

    var $tii = $31('tradeItem > tradeItemInformation').first() // populate first TII already in template
    var $ext = $31('extension', $tii)

    var variant = $28('foodAndBeverageInformation', ti28).first()
    $28('productionVariantDescription', variant).each(function () {
      var lang = $28('language > languageISOCode', this).text()
      var text = $28('text', this).text()
      log('found first fb info production variant: ' + $28(this))
      if (lang && text) $ext.before($31('<productionVariantDescription/>').attr('languageCode', lang).text(text))
    })
    var pved = $28('productionVariantEffectiveDate', variant).text()
    if (pved) $ext.before($31('<productionVariantEffectiveDateTime/>').text(pved + 'T01:01:01.009Z'))

    // populate extension modules in alpha order:

    alcohol_info($28, ti28, $31, $ext, variant)

    allergen_info($28, $31, $ext, variant)

    //certification_info($28, $31, $ext)

    consumer_instructions($28, ti28, $31, $ext)

    dairy_fish_meat_poultry($28, ti28, $31, $ext)
    
    //dangerous_substance_info($28, $31, $ext)

    delivery_purchasing_info($28, ti28, $31, $ext)

    diet_info($28, $31, $ext, variant)

    farming_info($28, ti28, $31, $ext)

    food_and_bev_ingredients($28, $31, $ext, variant)

    food_and_bev_preparation($28, $31, $ext, variant)

    //food_and_bev_properties($28, $31, $ext)

    health_related_info($28, ti28, $31, $ext)

    health_wellness_pack($28, ti28, $31, $ext)

    marketing_info($28, ti28, $31, $ext)

    nutrient_info($28, $31, $ext, variant)

    packaging_info($28, ti28, $31, $ext)

    packaging_marking($28, ti28, $31, $ext)

    safety_data_sheet($28, ti28, $31, $ext)

    sales_info($28, ti28, $31, $ext)
    
    security_tag_info($28, ti28, $31, $ext)

    sustainability_info($28, ti28, $31, $ext)

    textile_material_info($28, ti28, $31, $ext)

    trade_item_data_carrier_info($28, ti28, $31, $ext)
    
    trade_item_description_info($28, ti28, $31, $ext)

    trade_item_handling($28, ti28, $31, $ext)
    
    trade_item_hierarchy($28, ti28, $31, $ext)

    trade_item_humidity($28, ti28, $31, $ext)

    trade_item_lifespan($28, ti28, $31, $ext)

    trade_item_measurements($28, ti28, $31, $ext)

    trade_item_temperature($28, ti28, $31, $ext)

    variable_info($28, ti28, $31, $ext)

    create_additional_variants($28, ti28, $31)

    trade_item_date_info($28, ti28, $31)

    copy_avp($28, ti28, $31)

    return $31.html()

  } // end returned API function for module

  function copy_avp ($28, ti28, $31) {
    log('copy_avp')
    var $avp = $31('avpList')
    var has_data = false
    $28('value[name]', ti28).each(function () {
      var name  = $28(this).attr('name')
      var value = $28(this).text()

      if (!name || !value) return

      if (name == 'alcoholicBeverageSubregionOfOrigin') return // -> alcoholInformation/alcoholicBeverageSubregion
      if (name == 'isTradeItemBiodegradable')           return // -> sustainabilityModule/tradeItemSustainabilityFeatureCode

      if (name == 'nutrientValueDerivation')      name = 'nutrientValueDerivationCode'
      if (name == 'allergenRelevantDataProvided') name = 'isAllergenRelevantDataProvided'
      if (name == 'nutrientRelevantDataProvided') name = 'isNutrientRelevantDataProvided'

      if (value == 'TRUE'  || value == 'YES' || value == 'Yes' || value == 'yes') value = 'true'
      if (value == 'FALSE' || value == 'NO'  || value == 'No'  || value == 'no' ) value = 'false'

      has_data = true
      log('avp: ' + name + ' = ' + value)

      var suffix = 'UOM'
      if (name.length - name.indexOf(suffix) == suffix.length) value = UOM(value)

      $avp.append($31('<stringAVP/>').attr('attributeName', name).text(value))
    })
    if (!has_data) $avp.remove()
  } // end copy_avp

  function trade_item_date_info ($28, ti28, $31) {
    log('trade_item_date_info')
    
    var $tid = $28('tradeItemDateInformation', ti28) // optional in 2.8

    var now = new Date().toISOString()

    var last_change = $tid && $28('lastChangeDateTime', $tid).first().text() || now
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

  function alcohol_info($28, ti28, $31, $ext, variant) {
    log('alcohol_info')
    var $mod = $31('<alcohol_information:alcoholInformationModule xmlns:alcohol_information="urn:gs1:gdsn:alcohol_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:alcohol_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/AlcoholInformationModule.xsd"/>')
    var $info = $31('<alcoholInformation/>')
    $mod.append($info)
    var mod_has_data = false

    var avp = $28('value[name="alcoholicBeverageSubregionOfOrigin"]', ti28).text()
    if (avp) {
      mod_has_data = true
      $info.append($31('<alcoholicBeverageSubregion/>').text(avp))
    }

    var perm = $28('foodAndBeverageMarketingInformationExtension > alcoholicPermissionLevel', ti28).text()
    if (perm) {
      mod_has_data = true
      $info.append($31('<alcoholicPermissionLevel/>').text(perm))
    }

    var perc = $28('tradeItemMeasurements > percentageOfAlcoholByVolume', ti28).text()
    if (perc) {
      mod_has_data = true
      $info.append($31('<percentageOfAlcoholByVolume/>').text(perc))
    }

    if (mod_has_data) $ext.append($mod)
  } // end alcohol_info 

  function allergen_info($28, $31, $ext, variant) {
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
      //$allergens.append($31('<avpList/>').append($31('<stringAVP/>').attr('attributeName', 'allergenRelevantDataProvided').text('true')))
      $ext.append($mod)
    }
  } // end variant allergens

  function certification_info($28, $31, $ext) {
    log('certification_info')
    var $mod = $31('<certification_information:certificationInformationModule xmlns:certification_information="urn:gs1:gdsn:certification_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:certification_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/CertificationInformationModule.xsd"/>')
    var $info = $31('<certificationInformation/>')
    $info.append($31('<certificationStandard/>').text('certification standard'))
    var $cert = $31('<certification/>')
    $cert.append($31('<certificationValue/>').text('some certification'))
    $info.append($cert)
    $mod.append($info)
    $ext.append($mod)
  } // end certification_info 

  function consumer_instructions($28, ti28, $31, $ext) {
    log('consumer_instructions')
    var $info = $31('<consumerInstructions/>')
    var mod_has_data = false
    $28('tradeItemHandlingInformation > consumerUsageStorageInstructions', ti28).each(function () {
      var lang = $28('language > languageISOCode', this).text()
      var text = $28('longText', this).text()
      if (lang && text) {
        $info.append($31('<consumerStorageInstructions/>').attr('languageCode', lang).text(text))
        mod_has_data = true
      }
    })
    if (!mod_has_data) return
    var $mod = $31('<consumer_instructions:consumerInstructionsModule xmlns:consumer_instructions="urn:gs1:gdsn:consumer_instructions:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:consumer_instructions:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/ConsumerInstructionsModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end consumer_instructions 

  function dairy_fish_meat_poultry($28, ti28, $31, $ext) {
    log('dairy_fish_meat_poultry')

    var $mod = $31('<dairy_fish_meat_poultry:dairyFishMeatPoultryItemModule xmlns:dairy_fish_meat_poultry="urn:gs1:gdsn:dairy_fish_meat_poultry:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:dairy_fish_meat_poultry:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DairyFishMeatPoultryItemModule.xsd"/>')
    var $info = $31('<dairyFishMeatPoultryInformation/>')
    $mod.append($info)
    var mod_has_data = false
    $28('tradeItemMeasurements > casingTareWeight', ti28).each(function () {
      mod_has_data = true
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<casingTareWeight/>').attr('measurementUnitCode', UOM(uom)).text(value))
    })
    if (mod_has_data) $ext.append($mod)
  } // end dairy_fish_meat_poultry 

  function dangerous_substance_info($28, $31, $ext) {
    log('dangerous_substance_info')
    var $mod = $31('<dangerous_substance_information:dangerousSubstanceInformationModule xmlns:dangerous_substance_information="urn:gs1:gdsn:dangerous_substance_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:dangerous_substance_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DangerousSubstanceInformationModule.xsd"/>')
    var $info = $31('<dangerousSubstanceInformation/>')
    var $prop = $31('<dangerousSubstanceProperties/>')
    $info.append($prop)
    $prop.append($31('<isDangerousSubstance/>').text('FALSE'))
    $mod.append($info)
    $ext.append($mod)
  } // end dangerous_substance_info 

  function delivery_purchasing_info($28, ti28, $31, $ext) {
    log('delivery_purchasing_info')
    var $mod = $31('<delivery_purchasing_information:deliveryPurchasingInformationModule xmlns:delivery_purchasing_information="urn:gs1:gdsn:delivery_purchasing_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:delivery_purchasing_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DeliveryPurchasingInformationModule.xsd"/>')
    var $info = $31('<deliveryPurchasingInformation/>')
    $mod.append($info)
    var mod_has_data = false

    var $tid = $28('tradeItemDateInformation', ti28).first() // optional in 2.8

    $28('tradingPartnerNeutralTradeItemInformation > tradeItemOrderInformation', ti28).first().each(function() {

      var mxbq = $28('agreedMaximumBuyingQuantity', this).text()
      if (mxbq) {
        mod_has_data = true
        $info.append($31('<agreedMaximumBuyingQuantity/>').text(mxbq))
      }

      var mnbq = $28('agreedMinimumBuyingQuantity', this).text()
      if (mnbq) {
        mod_has_data = true
        $info.append($31('<agreedMinimumBuyingQuantity/>').text(mnbq))
      }

      var bbo = $28('canTradeItemBeBackOrdered', this).text()
      if (bbo) {
        mod_has_data = true
        $info.append($31('<canTradeItemBeBackOrdered/>').text(bbo))
      }

      var cad = $28('consumerAvailabilityDateTime', $tid).text()
      if (cad) {
	mod_has_data = true
	$info.append($31('<consumerFirstAvailabilityDateTime/>').text(cad))
      }

      var fddt = $28('firstDeliveryDateTime', this).text()
      if (fddt) {
        mod_has_data = true
        $info.append($31('<firstDeliveryDateTime/>').text(fddt))
      }

      var fsd = $28('firstShipDate', $tid).text()
      if (fsd) {
	mod_has_data = true
	$info.append($31('<firstShipDateTime/>').text(fsd + 'T01:01:01.009Z'))
      }

      var ead = $28('endAvailabilityDateTime', $tid).text()
      if (ead) {
	mod_has_data = true
	$info.append($31('<endAvailabilityDateTime/>').text(ead))
      }

      var edt = $28('endDateTimeOfExclusivity', $tid).text()
      if (edt) {
	mod_has_data = true
	$info.append($31('<endDateTimeOfExclusivity/>').text(edt))
      }

      var edmxbq = $28('endDateMaximumBuyingQuantity', $tid).text()
      if (edmxbq) {
	mod_has_data = true
	$info.append($31('<endMaximumBuyingQuantityDateTime/>').text(edmxbq))
      }
      
      var edmnbq = $28('endDateMinimumBuyingQuantity', $tid).text()
      if (edmnbq) {
	mod_has_data = true
	$info.append($31('<endMinimumBuyingQuantityDateTime/>').text(edmnbq))
      }

      var fod = $28('firstOrderDate', $tid).text()
      if (fod) {
	mod_has_data = true
	$info.append($31('<firstOrderDateTime/>').text(fod + 'T01:01:01.009Z'))
      }

      $28('goodsPickUpLeadTime > measurementValue', this).each(function () {
        var value = $28('value', this).text()
        var uom = $28(this).attr('unitOfMeasure')
        $info.append($31('<goodsPickupLeadTime/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })

      var iotb = $28('isOneTimeBuy', this).text()
      if (iotb) {
        mod_has_data = true
        $info.append($31('<isOneTimeBuy/>').text(iotb))
      }

      // isProductCustomizable
      // isTradeItemReorderable
      // isTradeItemShippedInMultipleContainers
      // isTradeItemSizeBasedPricing

      var lod = $28('lastOrderDate', $tid).text()
      if (lod) {
	mod_has_data = true
	$info.append($31('<lastOrderDateTime/>').text(lod + 'T01:01:01.009Z'))
      }

      var lsd = $28('lastShipDate', $tid).text()
      if (lsd) {
	mod_has_data = true
	$info.append($31('<lastShipDateTime/>').text(lsd + 'T01:01:01.009Z'))
      }

      // orderingUnitOfMeasure

      var oqmx = $28('orderQuantityMaximum', this).text()
      if (oqmx) {
        mod_has_data = true
        $info.append($31('<orderQuantityMaximum/>').text(oqmx))
      }

      var oqmn = $28('orderQuantityMinimum', this).text()
      if (oqmn) {
        mod_has_data = true
        $info.append($31('<orderQuantityMinimum/>').text(oqmn))
      }

      var oqmu = $28('orderQuantityMultiple', this).text()
      if (oqmu) {
        mod_has_data = true
        $info.append($31('<orderQuantityMultiple/>').text(oqmu))
      }

      $28('orderSizingFactor > measurementValue', this).each(function () {
        var value = $28('value', this).text()
        var uom = $28(this).attr('unitOfMeasure')
        if (value && uom) {
          mod_has_data = true
          $info.append($31('<orderSizingFactor/>').attr('measurementUnitCode', UOM(uom)).text(value))
        }
      })
      
    }) // end first tradeItemOrderInformation

    // shippingQuantityMinimum

    var sad = $28('startAvailabilityDateTime', $tid).text() || new Date().toISOString()
    if (sad) {
      mod_has_data = true
      $info.append($31('<startAvailabilityDateTime/>').text(sad))
    }
    var sdmxbq = $28('startDateMaximumBuyingQuantity', $tid).text()
    if (sdmxbq) {
      mod_has_data = true
      $info.append($31('<startDateMaximumBuyingQuantity/>').text(sdmxbq))
    }
    var sdmnbq = $28('startDateMinimumBuyingQuantity', $tid).text()
    if (sdmnbq) {
      mod_has_data = true
      $info.append($31('<startDateMinimumBuyingQuantity/>').text(sdmnbq))
    }

    // incotermInformation

    var nsr = $28('tradingPartnerNeutralTradeItemInformation > tradeItemMarking > isNonSoldTradeItemReturnable', ti28).text()
    if (nsr)  {
      mod_has_data = true
      $info.append($31('<orderableReturnableInformation/>').append($31('<isNonSoldTradeItemReturnable/>').text(nsr)))
    }

    // distributionDetails
    // avpList

    if (mod_has_data) $ext.append($mod)
  } // end delivery_purchasing_info

  function diet_info($28, $31, $ext, variant) {
    if (!variant) return
    log('diet_info')
    var $mod = $31('<diet_information:dietInformationModule xmlns:diet_information="urn:gs1:gdsn:diet_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:diet_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/DietInformationModule.xsd"/>')
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
            $dc.append($31('<certification/>').append($31('<certificationValue/>').text(value)))
          }

          $mod.append($new_diet)
          mod_has_data = true
        }
    })

    if (mod_has_data) $ext.append($mod)

  } // end variant diet info

  function farming_info($28, ti28, $31, $ext) {
    log('farming info')

    var agency = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > organicTradeItemCharacteristics > organicClaimAgency', ti28).text()
    var code   = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > organicTradeItemCharacteristics > organicTradeItemCode', ti28).text()
    if (!agency && !code) return

    var $mod = $31('<farming_and_processing_information:farmingAndProcessingInformationModule xmlns:farming_and_processing_information="urn:gs1:gdsn:farming_and_processing_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:farming_and_processing_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/FarmingAndProcessingInformationModule.xsd"/>')
    var $info = $31('<tradeItemOrganicInformation/>')
    var $claim = $31('<organicClaim/>')

    $claim.append($31('<organicClaimAgencyCode/>').text(agency))
    $claim.append($31('<organicTradeItemCode/>').text(code))

    $info.append($claim)
    $mod.append($info)
    $ext.append($mod)
  } // done farming_info

  function food_and_bev_ingredients($28, $31, $ext, variant) {
    if (!variant) return
    log('food_and_bev_ingredients')
    var $mod = $31('<food_and_beverage_ingredient:foodAndBeverageIngredientModule xmlns:food_and_beverage_ingredient="urn:gs1:gdsn:food_and_beverage_ingredient:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:food_and_beverage_ingredient:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/FoodAndBeverageIngredientModule.xsd"/>')
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

    if (mod_has_data) $ext.append($mod)
  } // end variant ingredients food_and_bev_ingredients

  function food_and_bev_preparation($28, $31, $ext, variant) {
    log('food_and_bev_preparation')

    var $mod = $31('<food_and_beverage_preparation_serving:foodAndBeveragePreparationServingModule xmlns:food_and_beverage_preparation_serving="urn:gs1:gdsn:food_and_beverage_preparation_serving:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:food_and_beverage_preparation_serving:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/FoodAndBeveragePreparationServingModule.xsd"/>')

    var num_serv = $28('foodAndBeverageServingInformation > numberOfServingsPerPackage', variant).text()
    if (num_serv) {
      $mod.append($31('<servingQuantityInformation/>').append($31('<numberOfServingsPerPackage/>').text(num_serv)))
    }

    var $prep

    $28('foodAndBeveragePreparationInformation > preparationInstructions > description', variant).each(function () {
      var lang = $28('language > languageISOCode', this).text()
      var text = $28('text', this).text()
      if (!$prep) $prep = $31('<preparationServing/>')
      $prep.append($31('<preparationInstructions/>').attr('languageCode', lang).text(text))
    })

    $28('foodAndBeverageMarketingInformationExtension > servingSuggestion > description', variant).each(function () {
      var lang = $28('language > languageISOCode', this).text()
      var text = $28('longText', this).text()
      if (!$prep) $prep = $31('<preparationServing/>')
      $prep.append($31('<servingSuggestion/>').attr('languageCode', lang).text(text))
    })

    if ($prep) $mod.append($prep)
    if (num_serv || $prep) $ext.append($mod)

  } // end food_and_bev_preparation

  function food_and_bev_properties($28, $31, $ext) {
    log('food_and_bev_properties')
    var $mod = $31('<food_and_beverage_properties_information:foodAndBeveragePropertiesInformationModule xmlns:food_and_beverage_properties_information="urn:gs1:gdsn:food_and_beverage_properties_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:food_and_beverage_properties_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/FoodAndBeveragePropertiesInformationModule.xsd"/>')
    var $info = $31('<microbiologicalInformation/>')
    $info.append($31('<microbiologicalOrganismCode/>').text('BACILLUS_CEREUS'))
    $mod.append($info)
    $ext.append($mod)
  } // end food_and_bev_properties

  function health_related_info($28, ti28, $31, $ext) {
    log('health_related_info')
    var mod_has_data = false
    var $info = $31('<healthRelatedInformation/>')
    var cons = $28('tradeItemSustainabilityInformation > tradeItemEnvironmentalProperties', ti28).attr('isTradeItemChemicalNotIntendedForHumanConsumption')
    if (cons) {
      mod_has_data = true
      $info.append($31('<isTradeItemChemicalNotIntendedForHumanConsumption/>').text(cons))
    }
    $28('nutritionLabelTypeCode', ti28).each(function () {
      mod_has_data = true
      $info.append($31('<nutritionalLabelTypeCode/>').text($28(this).text()))
    })
    $28('nutritionalProgramCode', ti28).each(function () {
      mod_has_data = true
      $info.append($31('<nutritionalProgramCode/>').text($28(this).text()))
    })
    if (!mod_has_data) return
    var $mod = $31('<health_related_information:healthRelatedInformationModule xmlns:health_related_information="urn:gs1:gdsn:health_related_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:health_related_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/HealthRelatedInformationModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end health_related_info

  function health_wellness_pack($28, ti28, $31, $ext) {
    log('health_wellness_pack')
    var mod_has_data = false
    var $info = $31('<healthWellnessPackagingMarking/>')
    $28('packagingMarking', ti28).first().each(function () {
      mod_has_data = true
      $info.append($31('<isPackagingMarkedWithIngredients/>').text($28('isPackagingMarkedWithIngredients', this).text() || 'false'))
      $28('packageMarksDietAllergen', this).each(function () {
        $info.append($31('<packagingMarkedDietAllergenCode/>').text($28(this).text()))
      })
      $28('packageMarksFreeFrom', this).each(function () {
        $info.append($31('<packagingMarkedFreeFromCode/>').text($28(this).text()))
      })
    })
    if (!mod_has_data) return
    var $mod = $31('<health_wellness_packaging_marking:healthWellnessPackagingMarkingModule xmlns:health_wellness_packaging_marking="urn:gs1:gdsn:health_wellness_packaging_marking:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:health_wellness_packaging_marking:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/HealthWellnessPackagingMarkingModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end health_wellness_pack

  function marketing_info($28, ti28, $31, $ext) {
    log('marketing_info')
    var mod_has_data = false
    var $info = $31('<marketingInformation/>')

    $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > marketingInformation', ti28).each(function () {
      mod_has_data = true

      $28('tradeItemFeatureBenefit', this).each(function () {
        var text = $28('text', this).text()
        var lang = $28('language > languageISOCode', this).text()
        if (text && lang) {
          mod_has_data = true
          $info.append($31('<tradeItemFeatureBenefit/>').attr('languageCode', lang).text(text))
        }
      })
      $28('tradeItemMarketingMessage', this).each(function () {
        var text = $28('longText', this).text()
        var lang = $28('language > languageISOCode', this).text()
        if (text && lang) {
          mod_has_data = true
          $info.append($31('<tradeItemMarketingMessage/>').attr('languageCode', lang).text(text))
        }
      })

      var has_campaign = false
      var $campaign = $31('<marketingCampaign/>')
      var end = $28('campaignEndDate', this).text()
      if (end) {
        has_campaign = true
        $campaign.append($31('<campaignEndDateTime/>').text(end + 'T01:01:01.009Z'))
      }
      $28('campaignName', this).first().each(function () {
        var text = $28('text', this).text()
        var lang = $28('language > languageISOCode', this).text() || 'en'
        if (text) {
          has_campaign = true
          $campaign.append($31('<campaignName/>').attr('languageCode', lang).text(text))
        }
      })
      var start = $28('campaignStartDate', this).text()
      if (start) {
        has_campaign = true
        $campaign.append($31('<campaignStartDateTime/>').text(start + 'T01:01:01.009Z'))
      }
      if (has_campaign) $info.append($campaign)
    }) // end 2.8 marketingInformation

    // season
    $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > season', ti28).each(function () {
      mod_has_data = true
      var $season = $31('<season/>')
      $info.append($season)

      var seasonal = $28('isTradeItemSeasonal', this).text()
      if (seasonal) $season.append($31('<isTradeItemSeasonal/>').text(seasonal))

      var end   = $28('seasonalAvailabilityEndDate', this).text()
      if (end)   $season.append($31('<seasonalAvailabilityEndDateTime/>').text(end + 'T01:01:01.009Z'))
      var start = $28('seasonalAvailabilityStartDate', this).text()
      if (start) $season.append($31('<seasonalAvailabilityStartDateTime/>').text(start + 'T01:01:01.009Z'))

      $28('seasonCalendarYear', this).each(function () {
        $season.append($31('<seasonCalendarYear/>').text($28(this).text()))
      })
      $28('seasonName', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $season.append($31('<seasonName/>').attr('languageCode', lang).text(text))
      })
      $28('seasonParameter', this).each(function () {
        $season.append($31('<seasonParameterCode/>').text($28(this).text()))
      })
    })
    if (!mod_has_data) return
    var $mod = $31('<marketing_information:marketingInformationModule xmlns:marketing_information="urn:gs1:gdsn:marketing_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:marketing_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/MarketingInformationModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end marketing_info

  function nutrient_info($28, $31, $ext, variant) {
    if (!variant) return
    log('nutrient_info')
    var $mod = $31('<nutritional_information:nutritionalInformationModule xmlns:nutritional_information="urn:gs1:gdsn:nutritional_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:nutritional_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/NutritionalInformationModule.xsd"/>')
    var mod_has_data = false

    $28('foodAndBeverageNutrientInformation', variant).each(function () {
      mod_has_data = true
      var state = $28('preparationState', this).text()
      var $header = $31('<nutrientHeader/>').append($31('<preparationStateCode/>').text(state))
      $mod.append($header)

      $28('servingSize > measurementValue', this).first().each(function () {
        var value = $28('value', this).text()
        var uom = $28(this).attr('unitOfMeasure')
        $header.append($31('<servingSize/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      
      $28('householdServingSize > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $header.append($31('<servingSizeDescription/>').attr('languageCode', lang).text(text))
      })

      $28('foodAndBeverageNutrient', this).each(function () {
        var code = $28('nutrientTypeCode', this).attr('iNFOODSCodeValue')
        var perc = $28('percentageOfDailyValueIntake', this).text()
        var prec = $28('measurementPrecision', this).text()

        var $detail = $31('<nutrientDetail/>')
        $detail.append($31('<nutrientTypeCode/>').text(code))
        if (perc) $detail.append($31('<dailyValueIntakePercent/>').text(perc))
        $detail.append($31('<measurementPrecisionCode/>').text(prec))
        $28('quantityContained > measurementValue', this).each(function() {
          var value = $28('value', this).text()
          var uom = $28(this).attr('unitOfMeasure')
          $detail.append($31('<quantityContained/>').attr('measurementUnitCode', UOM(uom)).text(value))
        })
        $header.append($detail)
      })
    })

    if (mod_has_data) $ext.append($mod)
    log('end nutrient_info')
  } // end variant nutrients

  function packaging_info($28, ti28, $31, $ext) {
    log('packaging_info')
    var $mod = $31('<packaging_information:packagingInformationModule xmlns:packaging_information="urn:gs1:gdsn:packaging_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:packaging_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/PackagingInformationModule.xsd"/>')
    var mod_has_data = false

    $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > tradeItemPalletInformation', ti28).first().each(function () {
      var code = $28('palletTypeCode', this).text()
      if (!code) return
      var $pallet = $31('<packaging/>')

      var terms = $28('palletTermsAndConditions', this).text()
      if (terms) $pallet.append($31('<platformTermsAndConditionsCode/>').text(terms))

      $pallet.append($31('<platformTypeCode/>').text(PAL(code)))
      var palletMaterial = PAL(code, true)
      if (palletMaterial) $pallet.append($31('<packagingMaterial/>').append($31('<packagingMaterialTypeCode/>').text(palletMaterial)))
      $mod.append($pallet)
      mod_has_data = true
    })

    var $info = $31('<packaging/>')
    var description
    $info.append($31('<doesPackagingHaveWheels/>').text('FALSE'))
    $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > packagingType', ti28).first().each(function () {
      var pack_code = $28('packagingTypeCode', this).text()
      if (pack_code) {
        mod_has_data = true
        $info.append($31('<packagingTypeCode/>').text(pack_code))
      }
      $28('packagingWeight', this).each(function () {
        mod_has_data = true
        var value = $28('value', this).text()
        var uom = $28(this).attr('unitOfMeasure')
        $info.append($31('<packagingWeight/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      description = $28('packagingTypeDescription', this).text()
    })
    $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > packagingMaterial', ti28).first().each(function () {
      var pack_mat_code = $28('packagingMaterialCode', this).text()
      if (!pack_mat_code) return
      mod_has_data = true
      
      var $material = $31('<packagingMaterial/>')
      $material.append($31('<packagingMaterialTypeCode/>').text(pack_mat_code))
      $28('packagingMaterialCompositionQuantity > measurementValue', this).each(function () {
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $material.append($31('<packagingMaterialCompositionQuantity/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $info.append($material)

      var dep_eff_date = $28('depositValueEffectiveDate', this).text()
      var dep_end_date = $28('depositValueEndDate', this).text()
      if (dep_eff_date || dep_end_date) {
        var $deposit = $31('<packageDeposit/>')
        $info.append($deposit)
        if (dep_eff_date) $deposit.append($31('<depositValueEffectiveDateTime/>').text(dep_eff_date + 'T01:01:01.009Z'))
        if (dep_end_date) $deposit.append($31('<depositValueEndDateTime/>').text(dep_end_date + 'T01:01:01.009Z'))

        var amount = $28('returnablePackageDepositAmount > monetaryAmount', this).text()
        var curr   = $28('returnablePackageDepositAmount > currencyCode > currencyISOCode', this).text()
        $deposit.append($31('<returnablePackageDepositAmount/>').attr('currencyCode', curr).text(amount))

        $deposit.append($31('<returnablePackageDepositIdentification/>').text($28('returnablePackageDepositCode', this).text()))
      }
    }) // end packagingMaterial

    if (description) $info.append($31('<packagingTypeDescription/>').attr('languageCode', 'en').text(description))

    if (!mod_has_data) return
    $mod.append($info)
    $ext.append($mod)
  } // end packaging_info

  function packaging_marking($28, ti28, $31, $ext) {
    log('packaging_marking')
    var mod_has_data = false
    var $info = $31('<packagingMarking/>')
    $28('packagingMarking', ti28).first().each(function () {
      mod_has_data = true
      $info.append($31('<hasBatchNumber/>').text($28('hasBatchNumber', this).text() || 'false'))
      var net_content = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > tradeItemMeasurements > isNetContentDeclarationIndicated', ti28).text()
      if (net_content) $info.append($31('<isNetContentDeclarationIndicated/>').text(net_content))
      $info.append($31('<isPackagingMarkedReturnable/>').text($28('isPackagingMarkedReturnable', this).text() || 'false'))
      $info.append($31('<isPriceOnPack/>').text($28('isPriceOnPack', this).text() || 'false'))
      $info.append($31('<isTradeItemMarkedAsRecyclable/>').text($28('isTradeItemMarkedAsRecyclable', this).text() || 'false'))
      $info.append($31('<offerOnPack/>').text($28('offerOnPack', this).text() || 'false'))

      var acc_code = $28('packageMarksEnvironment', this).text()
      if (acc_code) $info.append($31('<packagingMarkedLabelAccreditationCode/>').text(acc_code))
      acc_code = $28('packageMarksEthical', this).text()
      if (acc_code) $info.append($31('<packagingMarkedLabelAccreditationCode/>').text(acc_code))
      acc_code = $28('packageMarksHygienic', this).text()
      if (acc_code) $info.append($31('<packagingMarkedLabelAccreditationCode/>').text(acc_code))

      $info.append($31('<packagingMarkedRecyclableScheme/>').text($28('packagingMarkedRecyclableScheme', this).text() || 'na'))
      var pack_date_type = $28('packagingMarkedExpirationDateType', this).text()
      if (pack_date_type) $info.append($31('<packagingDate/>').append($31('<tradeItemDateOnPackagingTypeCode/>').text(pack_date_type)))
    })
    if (!mod_has_data) return
    var $mod = $31('<packaging_marking:packagingMarkingModule xmlns:packaging_marking="urn:gs1:gdsn:packaging_marking:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:packaging_marking:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/PackagingMarkingModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end packaging_marking

  function safety_data_sheet($28, ti28, $31, $ext) {
    log('safety_data_sheet')
    var msds = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > materialSafetyData > materialSafetyDataSheetNumber', ti28).text()
    if (!msds) return
    var $mod = $31('<safety_data_sheet:safetyDataSheetModule xmlns:safety_data_sheet="urn:gs1:gdsn:safety_data_sheet:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:safety_data_sheet:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/SafetyDataSheetModule.xsd"/>')
    var $info = $31('<safetyDataSheetInformation/>')
    $info.append($31('<sDSSheetNumber/>').text(msds))
    $mod.append($info)
    $ext.append($mod)
  } // end safety_data_sheet

  function sales_info($28, ti28, $31, $ext) {
    log('sales_info')
    var bdt = $28('tradeItem > tradeItemInformation > brandDistributionType', ti28).text()
    var pmt = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > tradeItemUnitIndicator > priceByMeasureType', ti28).text()
    var pcc = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > tradeItemMeasurements > priceComparisonContentType', ti28).text()

    if (!bdt && !pmt && !pcc) return

    var $info = $31('<salesInformation/>')
    if (bdt) $info.append($31('<brandDistributionTypeCode/>').text(bdt))
    if (pmt) $info.append($31('<priceByMeasureTypeCode/>').text(pmt))

/* not yet supported:
    $28('tradeItemMeasurements > priceComparisonMeasurement > measurementValue').each(function () {
      var uom   = $28(this).attr('unitOfMeasure')
      var value = $28('value', this).text()
      $info.append($31('<priceComparisonMeasurement/>').attr('measurementUnitCode', UOM(uom)).text(value))
    })
    if (pcc) $info.append($31('<priceComparisonContentTypeCode/>').text(pcc))
*/

    var $mod = $31('<sales_information:salesInformationModule xmlns:sales_information="urn:gs1:gdsn:sales_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:sales_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/SalesInformationModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end sales_info

  function security_tag_info($28, ti28, $31, $ext) {
    log('security_tag_info')
    var loc = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > securityTagInformation > securityTagLocation', ti28).text()
    var typ = $28('tradeItem > tradeItemInformation > tradingPartnerNeutralTradeItemInformation > securityTagInformation > securityTagType', ti28).text()
    if (!loc && !typ) return
    var $info = $31('<securityTagInformation/>')
    if (loc) $info.append($31('<securityTagLocationCode/>').text(loc))
    if (typ) $info.append($31('<securityTagTypeCode/>').text(typ))
    var $mod = $31('<security_tag_information:securityTagInformationModule xmlns:security_tag_information="urn:gs1:gdsn:security_tag_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:security_tag_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/SecurityTagInformationModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end security_tag_info

  function sustainability_info($28, ti28, $31, $ext) {
    log('sustainability_info')
    var mod_has_data = false
    var $info = $31('<sustainabilityInformation/>')
    $28('tradingPartnerNeutralTradeItemInformation > tradeItemSustainabilityInformation', ti28).first().each(function () {
      var pest = $28('tradeItemEnvironmentalProperties', this).attr('doesTradeItemContainPesticide')
      if (pest) {
        mod_has_data = true
        $info.append($31('<doesTradeItemContainPesticide/>').text(pest))
      }
      var rig = $28(this).attr('isTradeItemRigidPlasticPackagingContainer')
      if (rig) {
        mod_has_data = true
        $info.append($31('<isTradeItemRigidPlasticPackagingContainer/>').text(rig))
      }
      var roh = $28(this).attr('isTradeItemROHSCompliant')
      if (roh) {
        mod_has_data = true
        $info.append($31('<isTradeItemROHSCompliant/>').text(roh))
      }
      $28('tradeItemEnvironmentalProperties', this).first().each(function () {
        var plan = $28(this).attr('renewablePlantBasedPlasticComponentsPercent')
        if (plan) {
          mod_has_data = true
          $info.append($31('<renewablePlantBasedPlasticComponentsPercent/>').text(plan))
        }
        $28('rOHSComplianceFailureMaterial', this).each(function () {
          mod_has_data = true
          $info.append($31('<rOHSComplianceFailureMaterial/>').text($28(this).text()))
        })
      })
      var avp = $28('value[name="isTradeItemBiodegradable"]', ti28).text()
      if (avp == 'true' || avp == 'TRUE' || avp == 'yes') {
        mod_has_data = true
        $info.append($31('<tradeItemSustainabilityFeatureCode/>').text('BIODEGRADABLE'))
      }
    })
    if (!mod_has_data) return
    var $mod = $31('<sustainability_module:sustainabilityModule xmlns:sustainability_module="urn:gs1:gdsn:sustainability_module:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:sustainability_module:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/SustainabilityModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end sustainability_info

  function textile_material_info($28, ti28, $31, $ext) {
    log('textile_material_info')

    var $mod = $31('<textile_material:textileMaterialModule xmlns:textile_material="urn:gs1:gdsn:textile_material:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:textile_material:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TextileMaterialModule.xsd"/>')
    var $info
    $28('tradingPartnerNeutralTradeItemInformation > materialComposition', ti28).each(function () {
      $info = $31('<textileMaterial/>').append($31('<materialAgencyCode/>').text($28('materialAgencyCode', this).text()))
      var $comp = $31('<textileMaterialComposition/>')
      $comp.append($31('<materialCode/>').text($28('materialCode > description > text', this).first().text()))
      var lang = $28('materialContent > language > languageISOCode', this).text()
      var text = $28('materialContent > text', this).text()
      $comp.append($31('<materialContent/>').attr('languageCode', lang).text(text))
      $comp.append($31('<materialPercentage/>').text($28('materialPercentage', this).first().text()))
      $info.append($comp)
      $mod.append($info)
    })
    $28('tradingPartnerNeutralTradeItemInformation > tradeItemMaterial', ti28).first().each(function () {
      $info = $31('<textileMaterial/>')//.append($31('<materialAgencyCode/>').text($28('materialAgencyCode', this).text()))
      var $comp = $31('<textileMaterialComposition/>')
      var text = $28('threadCount > text', this).text()
      var lang = $28('threadCount > language > languageISOCode', this).text()
      $comp.append($31('<materialThreadCount/>').attr('languageCode', lang).text(text))
      var value = $28('materialWeight > value', this).text()
      var uom   = $28('materialWeight', this).attr('unitOfMeasure')
      $comp.append($31('<materialWeight/>').attr('measurementUnitCode', UOM(uom)).text(value))
      $info.append($comp)
      $mod.append($info)
    })
    if ($info) $ext.append($mod)
  } // end textile_material_info

  function trade_item_data_carrier_info($28, ti28, $31, $ext) {
    log('trade_item_data_carrier_info')
    var mod_has_data = false
    var $mod = $31('<trade_item_data_carrier_and_identification:tradeItemDataCarrierAndIdentificationModule xmlns:trade_item_data_carrier_and_identification="urn:gs1:gdsn:trade_item_data_carrier_and_identification:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_data_carrier_and_identification:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemDataCarrierAndIdentificationModule.xsd"/>')
    var derivable = $28('tradingPartnerNeutralTradeItemInformation > tradeItemBarCodeInformation > isBarCodeDerivable').first().text() || 'false'
    var variable  = $28('tradingPartnerNeutralTradeItemInformation > isBarCodeOnPackageVariableMeasureBarCode').text() || 'false'
    $28('tradingPartnerNeutralTradeItemInformation > tradeItemBarCodeInformation > barCodeInformation', ti28).each(function () {
      mod_has_data = true
      var value = $28('barCodeValue', this).text()
      if (!value) return
      var type  = $28('barCodeValueType', this).text()
      var $key  = $31('<gs1TradeItemIdentificationKey/>')
      $key.append($31('<gs1TradeItemIdentificationKeyCode/>').text(BAR(type)))
      $key.append($31('<gs1TradeItemIdentificationKeyValue/>').text(value))
      $key.append($31('<isBarCodeDerivable/>').text(derivable))
      $key.append($31('<isBarCodeOnPackageVariableMeasureBarCode/>').text(variable))
      $mod.append($key)
    })
    $28('tradingPartnerNeutralTradeItemInformation > barCodeType', ti28).each(function () {
      mod_has_data = true
      $mod.append($31('<dataCarrier/>').append($31('<dataCarrierTypeCode/>').text(BAR($28(this).text()))))
    })
    if (mod_has_data) $ext.append($mod)
  } // end trade_item_data_carrier_info

  function trade_item_description_info($28, ti28, $31, $ext) {
    log('trade_item_description_info')
    var $mod = $31('<trade_item_description:tradeItemDescriptionModule xmlns:trade_item_description="urn:gs1:gdsn:trade_item_description:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_description:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemDescriptionModule.xsd"/>')
    var $info = $31('<tradeItemDescriptionInformation/>')
    $mod.append($info)
    $ext.append($mod)

    $28('tradeItemDescriptionInformation', ti28).first().each(function () { // should be only one
    
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

      var productRange = $28('productRange', this).text()
      if (productRange) $info.append($31('<productRange/>').text(productRange))

      $28('tradeItemDescription', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $info.append($31('<tradeItemDescription/>').attr('languageCode', lang).text(text))
      })

      $28('tradeItemFormDescription', this).each(function () {
        $info.append($31('<tradeItemFormDescription/>').text($28(this).text()))
      })
      
      var tigicr = $28('tradeItemGroupIdentificationCode', this).text()
      if (tigicr) $info.append($31('tradeItemGroupIdentificationCodeReference').text(tigicr))

      $28('variant > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('shortText', this).text()
        $info.append($31('<variantDescription/>').attr('languageCode', lang).text(text))
      })
      
      var $brand = $31('<brandNameInformation/>')
      $info.append($brand)

      $brand.append($31('<brandName/>').text($28('brandName', this).text() || 'na 70'))

      $28('languageSpecificBrandName > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $brand.append($31('<languageSpecificBrandName />').attr('languageCode', lang).text(text))
      })

      $28('languageSpecificSubBrandName > description', this).each(function () {
        var lang = $28('language > languageISOCode', this).text()
        var text = $28('text', this).text()
        $brand.append($31('<languageSpecificSubbrandName />').attr('languageCode', lang).text(text))
      })

      var subbrand = $28('subBrand', this).text()
      if (subbrand) $brand.append($31('<subBrand/>').text(subbrand))

    }) // end  $28('tradeItemDescriptionInformation').each
  } // end description info

  function trade_item_handling($28, ti28, $31, $ext) {
    log('trade_item_handling')
    var mod_has_data = false
    var $info = $31('<tradeItemHandlingInformation/>')
    $28('tradeItemHandlingInformation', ti28).each(function () {
      $28('clampPressure', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<clampPressure/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('handlingInstructionsCode', this).each(function () {
        mod_has_data = true
        var value = $28('codeValue', this).text()
        $info.append($31('<handlingInstructionsCodeReference/>').text(value))
      })
      var stack_factor = $28('stackingFactor', this).text()
      $28('stackingWeightMaximum > measurementValue', this).first().each(function () {
        mod_has_data = true
        var $stack = $31('<tradeItemStacking/>')
        $info.append($stack)
        if (stack_factor) $stack.append($31('<stackingFactor/>').text(stack_factor))
        var value = $28('value', this).text()
        var uom = $28(this).attr('unitOfMeasure')
        $stack.append($31('<stackingWeightMaximum/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
    })
    if (!mod_has_data) return
    var $mod = $31('<trade_item_handling:tradeItemHandlingModule xmlns:trade_item_handling="urn:gs1:gdsn:trade_item_handling:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_handling:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemHandlingModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end trade_item_handling

  function trade_item_hierarchy($28, ti28, $31, $ext) {
    log('trade_item_hierarchy')
    var mod_has_data = false
    var $info = $31('<tradeItemHierarchy/>')
    $28('tradeItemHierarchy', ti28).first().each(function () {
      mod_has_data = true
      $info.append($31('<isTradeItemPackedIrregularly/>').text($28('isTradeItemPackedIrregularly', this).text() || 'UNSPECIFIED'))
      $28('tradeItemMeasurements > layerHeight', ti28).each(function () {
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<layerHeight/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $info.append($31('<quantityOfCompleteLayersContainedInATradeItem/>').text($28('quantityOfCompleteLayersContainedInATradeItem', this).text() || '0'))
      $info.append($31('<quantityOfInnerPack/>')                          .text($28('quantityOfInnerPack', this).text() || '0'))
      $info.append($31('<quantityOfLayersPerPallet/>')                    .text($28('quantityOfLayersPerPallet', this).text() || '0'))
      $info.append($31('<quantityOfNextLevelTradeItemWithinInnerPack/>')  .text($28('quantityOfNextLevelTradeItemWithinInnerPack', this).text() || '0'))
      $info.append($31('<quantityOfTradeItemsContainedInACompleteLayer/>').text($28('quantityOfTradeItemsContainedInACompleteLayer', this).text() || '0'))
      $info.append($31('<quantityOfTradeItemsPerPallet/>')                .text($28('quantityOfTradeItemsPerPallet', this).text() || '0'))
      $info.append($31('<quantityOfTradeItemsPerPalletLayer/>')           .text($28('quantityOfTradeItemsPerPalletLayer', this).text() || '0'))
    })
    if (!mod_has_data) return
    var $mod = $31('<trade_item_hierarchy:tradeItemHierarchyModule xmlns:trade_item_hierarchy="urn:gs1:gdsn:trade_item_hierarchy:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_hierarchy:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemHierarchyModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end trade_item_hierarchy

  function trade_item_humidity($28, ti28, $31, $ext) {
    log('trade_item_humidity')
    var mod_has_data = false
    var $info = $31('<tradeItemHumidityInformation/>')
    $info.append($31('<humidityQualifierCode/>').text('STORAGE_HANDLING'))
    $28('tradingPartnerNeutralTradeItemInformation > tradeItemTemperatureInformation', ti28).each(function () {
      $28('storageHandlingHumidityMaximum > measurementValue', this).first().each(function () {
        mod_has_data = true
        $info.append($31('<maximumHumidityPercentage/>').text($28('value', this).text()))
      })
      $28('storageHandlingHumidityMinimum > measurementValue', this).first().each(function () {
        mod_has_data = true
        $info.append($31('<minimumHumidityPercentage/>').text($28('value', this).text()))
      })
    })
    if (!mod_has_data) return
    var $mod = $31('<trade_item_humidity_information:tradeItemHumidityInformationModule xmlns:trade_item_humidity_information="urn:gs1:gdsn:trade_item_humidity_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_humidity_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemHumidityInformationModule.xsd"/>')
    $mod.append($info)
    $ext.append($mod)
  } // end trade_item_humidity

  function trade_item_lifespan($28, ti28, $31, $ext) {
    log('trade_item_lifespan')
    var arrival
    var product
    var opened

    $28('tradingPartnerNeutralTradeItemInformation > tradeItemHandlingInformation', ti28).each(function () {
      arrival = $28('minimumTradeItemLifespanFromTimeOfArrival', this).text()
      product = $28('minimumTradeItemLifespanFromTimeOfProduction', this).text()
      opened  = $28('openedTradeItemLifespan', this).text()
    })
    if (!arrival && !product && !opened) return
    var $mod = $31('<trade_item_lifespan:tradeItemLifespanModule xmlns:trade_item_lifespan="urn:gs1:gdsn:trade_item_lifespan:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_lifespan:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemLifespanModule.xsd"/>')
    var $info = $31('<tradeItemLifespan/>')
    if (arrival) $info.append($31('<minimumTradeItemLifespanFromTimeOfArrival/>').text(arrival))
    if (product) $info.append($31('<minimumTradeItemLifespanFromTimeOfProduction/>').text(product))
    if (opened) $info.append($31('<openedTradeItemLifespan/>').text(opened))
    $mod.append($info)
    $ext.append($mod)
  } // end trade_item_lifespan

  function trade_item_measurements($28, ti28, $31, $ext) {
    var $mod = $31('<trade_item_measurements:tradeItemMeasurementsModule xmlns:trade_item_measurements="urn:gs1:gdsn:trade_item_measurements:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_measurements:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemMeasurementsModule.xsd"/>')
    var $info = $31('<tradeItemMeasurements/>')
    $mod.append($info)
    var mod_has_data = false

    $28('tradeItemMeasurements', ti28).first().each(function () {

      $28('depth > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<depth/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('diameter > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<diameter/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('height > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<height/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('inBoxCubeDimension > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<inBoxCubeDimension/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('individualUnitMaximumSize', this).each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<individualUnitMaximumSize/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('individualUnitMinimumSize', this).each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<individualUnitMinimumSize/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('netContent > measurementValue', this).each(function () { // can be many of these
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<netContent/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('tradeItemCompositionDepth > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<tradeItemCompositionDepth/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('tradeItemCompositionWidth > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<tradeItemCompositionWidth/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('width > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $info.append($31('<width/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      $28('pegMeasurements', this).each(function () {
        mod_has_data = true
        var $peg = $31('<pegMeasurements/>')
        $peg.append($31('<pegHoleNumber/>').text($28('pegHoleNumber', this).text() || '1'))
        $28('pegHorizontal > measurementValue', this).first().each(function () {
          var uom   = $28(this).attr('unitOfMeasure')
          var value = $28('value', this).text()
          $peg.append($31('<pegHorizontal/>').attr('measurementUnitCode', UOM(uom)).text(value))
        })
        $28('pegVertical > measurementValue', this).first().each(function () {
          var uom   = $28(this).attr('unitOfMeasure')
          var value = $28('value', this).text()
          $peg.append($31('<pegVertical/>').attr('measurementUnitCode', UOM(uom)).text(value))
        })
        $info.append($peg)
      })
      
      var $nest = $31('<tradeItemNesting/>')
      $28('tradeItemNesting', this).first().each(function () {
        mod_has_data = true
        $nest.append($31('<nestingDirectionCode/>').text($28('nestingDirection', this).text() || 'na'))
        $28('nestingIncrement> measurementValue', this).each(function () {
          var uom   = $28(this).attr('unitOfMeasure')
          var value = $28('value', this).text()
          $nest.append($31('<nestingIncrement/>').attr('measurementUnitCode', UOM(uom)).text(value))
        })
        $nest.append($31('<nestingTypeCode/>').text($28('nestingType', this).text() || 'na'))
        $info.append($nest)
      })
      
      var $weight = $31('<tradeItemWeight/>') // create from scratch
      $info.append($weight)
      
      $28('drainedWeight > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $weight.append($31('<drainedWeight/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
      
      $28('grossWeight > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $weight.append($31('<grossWeight/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })

      $28('netWeight > measurementValue', this).first().each(function () {
        mod_has_data = true
        var uom   = $28(this).attr('unitOfMeasure')
        var value = $28('value', this).text()
        $weight.append($31('<netWeight/>').attr('measurementUnitCode', UOM(uom)).text(value))
      })
    })
    
    if (mod_has_data) $ext.append($mod)
    
  } // end measurements

  function trade_item_temperature($28, ti28, $31, $ext) {
    log('trade_item_temperature')
    var mod_has_data = false
    var $mod = $31('<trade_item_temperature_information:tradeItemTemperatureInformationModule xmlns:trade_item_temperature_information="urn:gs1:gdsn:trade_item_temperature_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:trade_item_temperature_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/TradeItemTemperatureInformationModule.xsd"/>')
    $28('tradingPartnerNeutralTradeItemInformation > tradeItemTemperatureInformation', ti28).each(function () {
      var $info
      $28('deliveryToDistributionCenterTemperatureMaximum > measurementValue', this).first().each(function () {
        $info = $31('<tradeItemTemperatureInformation/>')
        var uom = UOM($28(this).attr('unitOfMeasure')) || 'FAH'
        var text = $28('value', this).text()
        if (text) $info.append($31('<maximumTemperature/>').attr('temperatureMeasurementUnitCode', uom).text(text))
      })
      $28('deliveryToDistributionCenterTemperatureMinimum > measurementValue', this).first().each(function () {
        if ($info) {
          var uom = UOM($28(this).attr('unitOfMeasure')) || 'FAH'
          var text = $28('value', this).text()
          if (text) $info.append($31('<minimumTemperature/>').attr('temperatureMeasurementUnitCode', uom).text(text))
        }
      })
      if ($info) {
        $info.append($31('<temperatureQualifierCode/>').text('DELIVERY_TO_DISTRIBUTION_CENTRE'))
        $mod.append($info)
        mod_has_data = true
        $info = null
      }
      $28('deliveryToMarketTemperatureMaximum > measurementValue', this).first().each(function () {
        $info = $31('<tradeItemTemperatureInformation/>')
        var uom = UOM($28(this).attr('unitOfMeasure')) || 'FAH'
        var text = $28('value', this).text()
        if (text) $info.append($31('<maximumTemperature/>').attr('temperatureMeasurementUnitCode', uom).text(text))
      })
      $28('deliveryToMarketTemperatureMinimum > measurementValue', this).first().each(function () {
        if ($info) {
          var uom = UOM($28(this).attr('unitOfMeasure')) || 'FAH'
          var text = $28('value', this).text()
          if (text) $info.append($31('<minimumTemperature/>').attr('temperatureMeasurementUnitCode', uom).text(text))
        }
      })
      if ($info) {
        $info.append($31('<temperatureQualifierCode/>').text('DELIVERY_TO_MARKET'))
        $mod.append($info)
        mod_has_data = true
        $info = null
      }
      $28('storageHandlingTemperatureMaximum > measurementValue', this).first().each(function () {
        $info = $31('<tradeItemTemperatureInformation/>')
        var uom = UOM($28(this).attr('unitOfMeasure')) || 'FAH'
        var text = $28('value', this).text()
        if (text) $info.append($31('<maximumTemperature/>').attr('temperatureMeasurementUnitCode', uom).text(text))
      })
      $28('storageHandlingTemperatureMinimum > measurementValue', this).first().each(function () {
        if ($info) {
          var uom = UOM($28(this).attr('unitOfMeasure')) || 'FAH'
          var text = $28('value', this).text()
          if (text) $info.append($31('<minimumTemperature/>').attr('temperatureMeasurementUnitCode', uom).text(text))
        }
      })
      if ($info) {
        $info.append($31('<temperatureQualifierCode/>').text('STORAGE_HANDLING'))
        $mod.append($info)
        mod_has_data = true
        $info = null
      }
    })
    if (mod_has_data) $ext.append($mod)
  } // end trade_item_temperature

  function variable_info($28, ti28, $31, $ext) {
    log('variable_info')
    var $mod = $31('<variable_trade_item_information:variableTradeItemInformationModule xmlns:variable_trade_item_information="urn:gs1:gdsn:variable_trade_item_information:xsd:3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:gs1:gdsn:variable_trade_item_information:xsd:3 http://www.gdsregistry.org/3.1/schemas/gs1/gdsn/VariableTradeItemInformationModule.xsd"/>')
    var text = $28('tradeItemUnitIndicator > isTradeItemAVariableUnit', ti28).first().text()
    if (!text) return

    var $info = $31('<variableTradeItemInformation/>')
    $info.append($31('<isTradeItemAVariableUnit/>').text(text))

    var code = $28('tradeItemUnitIndicator > variableTradeItemType', ti28).text()
    if (code) $info.append($31('<variableTradeItemTypeCode/>').text(code))

    $mod.append($info)
    $ext.append($mod)
  } // end variable info

  function create_additional_variants($28, ti28, $31) { // additional variants can only have allergen, diet, ingredient, and nutrient info
    log('create_additional_variants')

    var skip = true // skip first food bev info since already handled above as non-variant

    $28('foodAndBeverageInformation', ti28).each(function () {
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

      var $ext = $31('<extension/>')
      $atii.append($ext)

      allergen_info($28, $31, $ext, this)

      diet_info($28, $31, $ext, this)

      food_and_bev_ingredients($28, $31, $ext, this)

      food_and_bev_preparation($28, $31, $ext, this)

      nutrient_info($28, $31, $ext, this)

    }) // end each additional 2.8 foodAndBeverageInformation
  } // end additional production variants
}


