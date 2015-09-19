var log = console.log

module.exports = function (cheerio) {
    
  return function (trade_items, receiver, command, reload, docStatus, sender) {
    
    log('create_cin_28 trade_items.length: ' + trade_items.length)

    if (!trade_items || !trade_items.length) return ''
    
    // for easy access to items by gtin
    // save each gtin as an index to its xml
    var item_xmls = {} 
    trade_items.forEach(function (item) {
      if (!item.xml) return log('missing xml for item query gtin ' + item.gtin)
      else log('item xml length: ' + item.xml.length + ' for gtin: ' + item.gtin)
      
      if (item_xmls[item.gtin]) {
        //log('existing xml: ' + item_xmls[item.gtin])
        return log('found duplicate gtin definition for gtin ' + item.gtin)
      }
      item_xmls[item.gtin] = item.xml
    })

    var item = trade_items[0]
    
    var provider  = item.provider
    var recipient = item.recipient
    var new_msg_id = 'CIN_' + Date.now() + '_' + recipient + '_' + provider + '_' + item.gtin // maxlength 64 in synch list queue table
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


    $('uniqueCreatorIdentification').text(new_msg_id + '_doc1') // ok to use same trc, cmd, doc ID?
    $('contentOwner > gln').text(item.provider) // almost always the provider, except at message level set below
    $('eanucc\\:message > entityIdentification > uniqueCreatorIdentification').text(new_msg_id) // same as msg id
    $('eanucc\\:message > entityIdentification > contentOwner > gln').text(sender) // sender NOT provider

    $('documentCommandHeader').attr('type', command || 'ADD') // e.g ADD/CORRECT/etc

    $('gdsn\\:catalogueItemNotification').attr('creationDateTime', dateTime)
    $('gdsn\\:catalogueItemNotification').attr('documentStatus', docStatus || 'ORIGINAL')
    $('gdsn\\:catalogueItemNotification').attr('isReload', Boolean(reload == 'true' || reload == 'TRUE').toString())

    
    var $ci       = $('catalogueItem')
    var $link     = $('catalogueItemChildItemLink', $ci).remove()
    
    var gtins = []

    function create_catalog_item(gtin) {
      log('adding CIN gtin: ' + gtin)
      gtins.push(gtin)
      
      var $new_ci = $ci.clone()
      $new_ci.append(item_xmls[gtin])
      
      if (gtins.length > 99) {
        return log('error: too many items in one CIN')
      }
      
      $('childTradeItem', $new_ci).each (function () {
        var child_gtin = $('gtin', this).text()
        log('found child gtin: ' + child_gtin)
        var quantity = $('quantityofNextLowerLevelTradeItem', this).text()
        log('found child quantity: ' + quantity)
        var $new_link = $link.clone()
        $new_link.attr('quantity', quantity)
        $new_link.append(create_catalog_item(child_gtin))
        $new_ci.append($new_link)
      })
        
      if (recipient != receiver) $new_ci.append('<dataRecipient>' + recipient + '</dataRecipient>')
      $new_ci.append('<sourceDataPool>' + receiver + '</sourceDataPool>')
      return $new_ci.toString()
    }

    var ci_string = create_catalog_item(item.gtin)
    log(ci_string)
    $ci.replaceWith(ci_string)

    $('eanucc\\:transaction > entityIdentification > contentOwner > gln').each(function () {
      $(this).text(provider)
    })

    $('eanucc\\:documentCommand > documentCommandHeader > entityIdentification > contentOwner > gln').each(function () {
      $(this).text(provider)
    })
    $('gdsn\\:catalogueItemNotification > catalogueItemNotificationIdentification > contentOwner > gln').each(function () {
      $(this).text(provider)
    })

    return $.html()
  }
}
