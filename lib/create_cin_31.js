var log = console.log

module.exports = function (cheerio, gdsn) {
  
  return function (trade_items, receiver, command, reload, docStatus, sender) {
    
    log('create_cin_31')
    if (!trade_items || !trade_items.length) return ''
    
    // for easy access to items by gtin
    // save each gtin as an index to its xml
    var item_xmls = {} 
    trade_items.forEach(function (item) {
      //item_xmls[item.gtin] = item.xml || ('<tradeItem><gtin>' + item.gtin + '</gtin></tradeItem>')
      if (!item.xml) log('missing xml for item query gtin ' + item.gtin)

      // convert 2.8 xml to 3.1
      if (item.version == '2.8') item_xmls[item.gtin] = gdsn.convert_tradeItem_28_31(item.xml)
      else item_xmls[item.gtin] = item.xml || ''
    })

    var ti = trade_items[0]
    
    sender        = sender || gdsn.config.homeDataPoolGln
    var provider  = ti.provider
    var recipient = ti.recipient
    var new_msg_id = 'CIN_' + Date.now() + '_' + recipient + '_' + provider + '_' + ti.gtin // maxlength 64 in synch list queue table
    var dateTime = new Date().toISOString()
    var isReload = Boolean(reload == 'true' || reload == 'TRUE').toString() // CIN "initial load" if reload along with ADD cmd

    var $ = cheerio.load(gdsn.templates.cin_31, { 
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


    // new message values for dp: trx/cmd/doc id and owner glns, created ts
    // assume naming convention based on new_msg_id and only support single doc
    $('transactionIdentification > entityIdentification').text(new_msg_id + '_t1')
    $('documentCommand > documentCommandHeader').attr('type', command || 'ADD') // e.g ADD/CORRECT/etc
    $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_t1_c1')
    $('catalogueItemNotificationIdentification > entityIdentification').text(new_msg_id + '_t1_c1_d1')

    $('creationDateTime').text(dateTime)
    $('documentStatusCode').text(docStatus || 'ORIGINAL')
    $('isReload').text(Boolean(reload == 'true' || reload == 'TRUE').toString()) // CIN "initial load" if reload along with ADD cmd
    
    var $ci       = $('catalogueItem')
    var $link     = $('catalogueItemChildItemLink', $ci).remove()
    $('dataRecipient', $ci).text(recipient)
    $('sourceDataPool', $ci).text(sender)
    
    function create_catalog_item(gtin) {
      log('adding CIN gtin: ' + gtin)
      var $new_ci = $ci.clone()
      $new_ci.append(item_xmls[gtin])
      $('childTradeItem', $new_ci).each (function (idx, child) {
        var child_gtin = $('gtin', child).text()
        log('found child gtin: ' + child_gtin)
        var quantity = $('quantityOfNextLowerLevelTradeItem', child).text()
        log('found child quantity: ' + quantity)
        var $new_link = $link.clone()
        $('quantity', $new_link).text(quantity)
        $new_link.append(create_catalog_item(child_gtin))
        $new_ci.append($new_link)
      })
      return $new_ci.toString()
    }
    $ci.replaceWith(create_catalog_item(ti.gtin))

    $('contentOwner > gln').each(function () {
      $(this).text(provider)
    })

    $('tradeItem').each(function () {
      var cancel = $('tradeItemSynchronisationDates > cancelledDateTime', this).text()
      if (cancel) {
        log('found ti cancel date: ' + cancel)
        $(this).prev().append('<cancelDateTime>' + cancel + '</cancelDateTime>')
        if (new Date(cancel).getTime() < Date.now()) { // change item state if canceled date has passed
          log('updating CI state to CANCELED') // CANCELLED
          $(this).prev().find('catalogueItemStateCode').text('CANCELED') // note spelling from CatalogueItemNotification.xsd
        }
      }
      var discontinue = $('tradeItemSynchronisationDates > discontinuedDateTime', this).text()
      if (discontinue) {
        log('found ti discontinue date: ' + discontinue)
        $(this).prev().append('<discontinueDateTime>' + discontinue + '</discontinueDateTime>')
        if (new Date(discontinue).getTime() < Date.now()) { // change item state if discontinued date has passed
          $(this).prev().find('catalogueItemStateCode').text('DISCONTINUED') // note spelling from CatalogueItemNotification.xsd
        }
      }
    })

    return $.html()
  }
}


