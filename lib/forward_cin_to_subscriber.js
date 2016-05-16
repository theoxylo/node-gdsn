var log = console.log

module.exports = function (cheerio, gdsn) {
  
  return function (cin_xml, recipient, provider, gtin) {

    log('forward_cin_31_to_subscriber with length ' + (cin_xml && cin_xml.length))

    if (!cin_xml || !cin_xml.length) return ''
    
    //var msg = gdsn.get_msg_info(cin_xml)

    var $ = cheerio.load(cin_xml, { 
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
    })

    // swap some values to make a new CIN message to subscriber
    // msg_id maxlength 64 in synch list queue table
    $('sh\\:Sender > sh\\:Identifier'  ).text(gdsn.config.homeDataPoolGln)
    $('sh\\:Receiver > sh\\:Identifier').text(recipient)
    $('sh\\:InstanceIdentifier'        ).text('CIN_IN_' + Date.now() + '_' + recipient + '_' + provider + '_' + gtin) 
    $('sh\\:CreationDateAndTime'       ).text(new Date().toISOString())



    // validation rules?
    $('tradeItem').each(function () {
      log('found next SUBSCRIBER tradeItem, checking language codes:')
      var elements = {}
      $('[languageCode]', this).each(function () {
        var name = this.name
        var code = this.attribs.languageCode
        log('found element with language code ' + name + ' with code ' + code)
        if (elements[name + code]) log('WARNGING: duplicated code usage detected')
        else elements[name + code] = true
      })
    })

    return $.html()
  }
}


