module.exports = function (cheerio, gdsn) {
    
  var log = console.log

  return function (trade_items, receiver, command, reload, docStatus, sender) {
    
    log('create_cin_28 trade_items.length: ' + trade_items.length)
    log('create_cin_28 sender: ' + sender)
    log('create_cin_28 receiver: ' + receiver)

    if (!trade_items || !trade_items.length) return ''
    
    // for easy access to items by gtin
    // save each gtin as an index to its xml
    var item_xmls = {} 
    trade_items.forEach(function (item) {
      if (!item.xml) return log('missing xml for item query gtin ' + item.gtin)
      log('item xml length: ' + item.xml.length + ' for gtin: ' + item.gtin)
      if (!item_xmls[item.gtin]) item_xmls[item.gtin] = item.xml
      else log('found duplicate gtin definition for gtin ' + item.gtin)
    })

    var item = trade_items[0]
    
    var provider  = item.provider
    var recipient = item.recipient
    var source_dp = item.source_dp
    var new_msg_id = 'CIN_' + Date.now() + '_' + recipient + '_' + provider + '_' + item.gtin // maxlength 64 in synch list queue table
    var dateTime = new Date().toISOString()
    var isReload = Boolean(reload == 'true' || reload == 'TRUE').toString() // CIN "initial load" if reload along with ADD cmd

    var $ = cheerio.load(gdsn.templates.cin_28, { 
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


    $(                                          'contentOwner > gln').text(item.provider) // always the provider, except at message level set below
    $('eanucc\\:message > entityIdentification > contentOwner > gln').text(sender) // sender

    $(                                          'uniqueCreatorIdentification').text(new_msg_id + '_doc1') // ok to use same trc, cmd, doc ID
    $('eanucc\\:message > entityIdentification > uniqueCreatorIdentification').text(new_msg_id) // same as msg id

    $('documentCommandHeader').attr('type', command || 'ADD') // e.g ADD/CORRECT/etc

    $('gdsn\\:catalogueItemNotification').attr('creationDateTime', dateTime)
    $('gdsn\\:catalogueItemNotification').attr('documentStatus', docStatus || 'ORIGINAL')
    $('gdsn\\:catalogueItemNotification').attr('isReload', Boolean(reload == 'true' || reload == 'TRUE').toString())

    // if populated in item
    var disDate = false
    var canDate = false
    
    var $ci       = $('catalogueItem')
    var $link     = $('catalogueItemChildItemLink', $ci).remove()
    
    var gtins = []

    function create_catalog_item(gtin) {
      log('adding CIN gtin: ' + gtin)
      gtins.push(gtin)
      var $new_ci = $ci.clone()
      if (!item_xmls[gtin]) throw Error('missing item with gtin: ' + gtin)

      $new_ci.append(item_xmls[gtin]) // <tradeItem>...</tradeItem>
      $new_ci.append('<dataRecipient>' + recipient + '</dataRecipient>')
      $new_ci.append('<sourceDataPool>' + (source_dp || receiver) + '</sourceDataPool>')

      var $ciState = $('catalogueItemState', $new_ci) // faster to save ref for multiple access below
      log('ci state for gtin ' + gtin + ': ' + $ciState.attr('state')) // eg 'IN_PROGRESS' from template, could set here
      // TODO: change to CANCELED or DISCONTINUED in disDate or canDate has passed?

      disDate = disDate || $('tradeItemDateInformation > discontinuedDate', $new_ci).text()
      log('disDate: ' + disDate)
      if (disDate) $ciState.attr('discontinueDate', disDate + 'T01:01:01')

      canDate = canDate || $('tradeItemDateInformation > canceledDate').text()
      log('canDate: ' + canDate)
      if (canDate) $ciState.attr('cancelDate', canDate + 'T01:01:01')

      if (gtins.length > 99) throw Error('error: too many items in one CIN')

      $('childTradeItem', $new_ci).each (function () {
        var child_gtin = $('tradeItemIdentification > gtin', this).text()
        log('found child gtin: ' + child_gtin)
        var quantity = $('quantityofNextLowerLevelTradeItem', this).text()
        log('found child quantity: ' + quantity)
        var $new_link = $link.clone()
        $new_link.attr('quantity', quantity)
        $new_link.append(create_catalog_item(child_gtin)) // recursive call for each child
        $new_ci.append($new_link)
      })
      return $new_ci.toString()
    }

    $ci.replaceWith(create_catalog_item(item.gtin))

    return $.html()
  }
}
