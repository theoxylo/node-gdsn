//Gdsn.prototype.create_tp_item_rci_28 = function (item) {

module.exports = function (cheerio, gdsn) {
  
  return function create_rci_28(item) {

    gdsn.log('create_rci_28')
    
    if (!item || !item.xml) gdsn.log('missing xml for item query gtin ' + item.gtin)

    var sender    = item.source_dp
    var provider  = item.provider
    var receiver  = gdsn.config.gdsn_gr_gln
    var new_msg_id = 'RCI_' + Date.now() + '_' + provider + '_' + item.gtin // maxlength 64 in synch list queue table
    var dateTime = new Date().toISOString()

    var $ = cheerio.load(this.templates.rci_to_gr_2, { 
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
      , decodeEntities: false
    })

    // new values for this message
    $('sh\\:Sender > sh\\:Identifier').text(sender)
    $('sh\\:Receiver > sh\\:Identifier').text(receiver)

    $('sh\\:InstanceIdentifier').text(new_msg_id)
    $('sh\\:CreationDateAndTime').text(dateTime)


    $(                   'entityIdentification > contentOwner > gln').text(item.provider) // almost always the provider, except at message level set below
    $(    'registryCatalogueItemIdentification > contentOwner > gln').text(item.provider) // same xsd type as entityIdentification
    $('eanucc\\:message > entityIdentification > contentOwner > gln').text(sender) // sender NOT provider

    $(                   'entityIdentification > uniqueCreatorIdentification').text(new_msg_id + '_tcd01') // ok to use same trx, cmd, doc ID
    $(    'registryCatalogueItemIdentification > uniqueCreatorIdentification').text(new_msg_id + '_tcd01') // same xsd type as entityIdentification
    $('eanucc\\:message > entityIdentification > uniqueCreatorIdentification').text(new_msg_id) // same as msg id

    $('documentCommandHeader').attr('type', 'ADD' || 'CORRECT' || 'CHANGE_BY_REFRESH') // RCI command to GR

    $('gdsn\\:registryCatalogueItem').attr('creationDateTime', dateTime)
    $('gdsn\\:registryCatalogueItem').attr('documentStatus', 'ORIGINAL')
    $('catalogueItemDates').attr('lastChangedDate', dateTime)
    $('catalogueItemClassification').attr('classificationCategoryCode', item.gpc)
    $('catalogueItemReference > gtin').text(item.gtin)
    $('catalogueItemReference > dataSource').text(item.provider)

    $('catalogueItemReference > targetMarket > targetMarketCountryCode > countryISOCode').text(item.tm) // 2.8!!!
    
    if (item.tm_sub && item.tm_sub != 'na') {
      $('catalogueItemReference > targetMarket > targetMarketSubdivisionCode > countrySubDivisionISOCode').text(item.tm_sub) // 2.8!!!
    }
    else {
      $('catalogueItemReference > targetMarket > targetMarketSubdivisionCode').remove() // 2.8!!!
    }

    $('sourceDataPool').text(item.source_dp)

    return $.html()
  } // end create_rci_28
}
