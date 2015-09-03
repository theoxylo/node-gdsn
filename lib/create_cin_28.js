var log = console.log

module.exports = function (cheerio) {
    
  return function (trade_items, receiver, command, reload, docStatus, sender) {
    
    log('create_cin_28')
    if (!trade_items || !trade_items.length) return ''
    
    // for easy access to items by gtin
    // save each gtin as an index to its xml
    var item_xmls = {} 
    trade_items.forEach(function (item) {
      if (!item.xml) log('missing xml for item query gtin ' + item.gtin)
      item_xmls[item.gtin] = item.xml || ''
    })

    var ti = trade_items[0]
    
    sender        = sender || this.config.homeDataPoolGln
    var provider  = ti.provider
    var recipient = ti.recipient
    var new_msg_id = 'CIN_' + Date.now() + '_' + recipient + '_' + provider + '_' + ti.gtin // maxlength 64 in synch list queue table
    var dateTime = new Date().toISOString()
    var isReload = Boolean(reload == 'true' || reload == 'TRUE').toString() // CIN "initial load" if reload along with ADD cmd

    var $ = cheerio.load(this.templates.cin_28, { 
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
    })

    // new values for this message
    $('sh\\:Sender > sh\\:Identifier').text(sender)
    $('sh\\:Receiver > sh\\:Identifier').text(receiver)

    $('sh\\:InstanceIdentifier').text(new_msg_id)
    $('sh\\:CreationDateAndTime').text(dateTime)


    // new message values for dp: trx/cmd/doc id and owner glns, created ts
    // assume naming convention based on new_msg_id and only support single doc
    $('entityIdentification > uniqueCreatorIdentification').text(new_msg_id) // same ID for msg, trx, cmd, doc
    $('contentOwner > gln').text(sender)
    $('documentCommandHeader').attr('type', command || 'ADD') // e.g ADD/CORRECT/etc

    $('gdsn\\:catalogueItemNotification').attr('creationDateTime', dateTime)
    $('gdsn\\:catalogueItemNotification').attr('documentStatus', docStatus || 'ORIGINAL')
    $('gdsn\\:catalogueItemNotification').attr('isReload', Boolean(reload == 'true' || reload == 'TRUE').toString())

    
    var $ci       = $('catalogueItem')
    var $link     = $('catalogueItemChildItemLink', $ci).remove()
    
    function create_catalog_item(gtin) {
      log('adding CIN gtin: ' + gtin)
      var $new_ci = $ci.clone()
      $new_ci.append(item_xmls[gtin])
      $new_ci.append('<dataRecipient>' + recipient + '</dataRecipient>')
      $new_ci.append('<sourceDataPool>' + recipient + '</sourceDataPool>')
      $('childTradeItem', $new_ci).each (function (idx, child) {
        var child_gtin = $('tradeItemIdentification > gtin', child).text()
        log('found child gtin: ' + child_gtin)
        var quantity = $('quantityofNextLowerLevelTradeItem', child).text()
        log('found child quantity: ' + quantity)
        var $new_link = $link.clone()
        $new_link.attr('quantity', quantity)
        $new_link.append(create_catalog_item(child_gtin))
        $new_ci.append($new_link)
      })
      return $new_ci.toString()
    }
    $ci.replaceWith(create_catalog_item(ti.gtin))

    $('dataRecipient').text(recipient)
    $('sourceDataPool').text(sender)

    $('contentOwner > gln').each(function () {
      $(this).text(provider)
    })

    return $.html()
  }
}


