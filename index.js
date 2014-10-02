var fs          = require('fs')
var cheerio     = require('cheerio')

var log = console.log || function (msg) {}

module.exports = Gdsn

function Gdsn(config) {

  if (!(this instanceof Gdsn)) return new Gdsn(config)

  config = config || {clean_newline: true}
  if (!config.templatePath)    config.templatePath    = __dirname + '/templates'
  if (!config.homeDataPoolGln) config.homeDataPoolGln = '0000000000000'
  if (!config.outbox_dir)      config.outbox_dir      = config.out_dir || __dirname + '/outbox'

  log = config.log || log

  //log('GDSN options:')
  //log(config)

  if (!this.validateGln(config.homeDataPoolGln)) {
    log('Error: invalid home data pool GLN: ' + config.homeDataPoolGln)
    process.exit(1)
  }

  this.config = config

  require('./lib/xpath_dom.js')(this) // adds this.dom
}

Gdsn.prototype.getTradeItemInfo = function (raw_xml, msg_info) {
  return this.dom.getTradeItemInfo(raw_xml, msg_info)
}

Gdsn.prototype.readFile = function (filename, cb) {
  fs.readFile(filename, 'utf8', function (err, content) {
    if (err) return cb(err)
    return cb(null, content)
  })
}

Gdsn.prototype.writeFile = function (filename, content, cb) {
  fs.writeFile(filename, content, function (err) {
    if (err) return cb(err)
    var size = Buffer.byteLength(content)
    log('Gdsn.writeFile: ' + filename + ' (' + size + ' bytes)')
    return cb(null, size)
  })
}

Gdsn.prototype.getMessageInfoFromString = function (xml, info) {
  if (!info.msg_id) {
    var match = xml.match(/InstanceIdentifier>([^<\/]*)<\//)
    info.msg_id = match && match.length == 2 && match[1]
    if (info.msg_id) log('msg id: ' + info.msg_id)
  }
  if (!info.created_ts) {
    var match = xml.match(/CreationDateAndTime>([.0-9T:-]*)</)
    if (match && match[1]) {
      var created_date_time = match[1]
      log('create date time: ' + created_date_time)
      info.created_ts = (new Date(created_date_time)).getTime()
      if (info.created_ts) log('create timestamp: ' + info.created_ts)
    }
  }
  if (!info.msg_type) {
    var match = xml.match(/Type>([a-zA-Z]{1,})</)
    info.msg_type = match && match.length == 2 && match[1]
    if (info.msg_type) log('msg_type: ' + info.msg_type)
  }

  if (info.msg_type == 'catalogueItemNotification') {
    if (!info.recipient) {
      var match = xml.match(/dataRecipient>(\d{13})</)
      info.recipient = match && match.length == 2 && match[1]
      if (info.recipient) log('data recipient: ' + info.recipient)
    }
    if (!info.source_dp) {
      var match = xml.match(/sourceDataPool>(\d{13})</)
      info.source_dp = match && match.length == 2 && match[1]
      if (info.source_dp) log('source_dp: ' + info.source_dp)
    }
  }

  var complete = (info.msg_id && info.created_ts && info.msg_type)
    && (info.msg_type != 'catalogueItemNotification' || (info.recipient && info.source_dp))

  return complete
}

Gdsn.prototype.clean_xml = function (raw_xml) {
  var match = raw_xml.match(/<[^]*>/) // match bulk xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  if (!match || !match[0]) return ''
  var clean_xml = match[0]
  clean_xml = clean_xml.replace(/>\s*</g, '><') // remove extra whitespace between tags
  clean_xml = clean_xml.replace(/></g, '>\n<') // add line return between tags
  clean_xml = clean_xml.replace(/<[^\/>][-_a-zA-Z0-9]*[^:>]:/g, '<')                      // remove open tag ns prefix <abc:tag>
  clean_xml = clean_xml.replace(/<\/[^>][-_a-zA-Z0-9]*[^:>]:/g, '<\/')                    // remove close tag ns prefix </abc:tag>
  clean_xml = clean_xml.replace(/\s*xmlns:[^=\s]*\s*=\s*['"][^'"]*['"]/g, '')          // remove xmlns:abc="123" ns attributes
  clean_xml = clean_xml.replace(/\s*[^:\s]*:schemaLocation\s*=\s*['"][^'"]*['"]/g, '') // remove abc:schemaLocation attributes
  return clean_xml
}

Gdsn.prototype.validateGln = function (gln) {
  if (!gln || gln.length != 13) return false

  var digits = gln.split('')
  var numbers = new Array(13)
  for (var idx = 0; idx < 13; idx++) {
    numbers[idx] = Number(digits[idx])
  }

  var sum1 = numbers[0] + numbers[2] + numbers[4] + numbers[6] + numbers[8] + numbers[10]
  var sum2 = numbers[1] + numbers[3] + numbers[5] + numbers[7] + numbers[9] + numbers[11]

  var checkDigit = ((sum2 * 3) + sum1) % 10

  if (checkDigit) {
      checkDigit = 10 - checkDigit
  }
  return checkDigit == numbers[12]
}

Gdsn.prototype.validateGtin = function (gtin) {
  if (!gtin || gtin.length != 14) return false

  var digits = gtin.split('')
  var numbers = new Array(14)
  for (var idx = 0; idx < 14; idx++) {
    numbers[idx] = Number(digits[idx])
  }

  var sum1 = numbers[0] + numbers[2] + numbers[4] + numbers[6] + numbers[8] + numbers[10] + numbers[12]
  var sum2 = numbers[1] + numbers[3] + numbers[5] + numbers[7] + numbers[9] + numbers[11]

  var checkDigit = ((sum1 * 3) + sum2) % 10

  if (checkDigit) {
      checkDigit = 10 - checkDigit
  }
  return checkDigit == numbers[13]
}


//// new cheerio dom approach, like jquery ////
// compare: 
// cheerio: var type = $('DocumentIdentification Type').text()
// xpath:   var type = this.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="Type"]')
// however, the cheerio version must not have namespace prefixes! so we use the clean_xml util first

Gdsn.prototype.cheerio_from_file = function (filename, cb) {
  var self = this
  this.readFile(filename, function (err, xml) {
    if (err) return cb(err)
    log('Gdsn.cheerio_from_file  : read ' + filename + ' (' + Buffer.byteLength(xml) + ' bytes)')
    var clean_xml = self.clean_xml(xml)
    self.cheerio_from_string(clean_xml, cb)
  })
}

Gdsn.prototype.cheerio_from_string = function (xml, cb) {
  setImmediate(function () {
    try {
      log('cheerio_from_string input xml length: ' + (xml && xml.length) || 0)
      var $dom = cheerio.load(xml, { 
        _:0
        , normalizeWhitespace: true
        , xmlMode: true
      })
      cb(null, $dom)
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.cheerio_to_string = function ($, cb) {
  setImmediate(function () {
    try {
      var xml = $.html()
      cb(null, xml)
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.cheerio_to_file = function (filename, $, cb) {
  var xml = $.html()
  var self = this
  this.cheerio_to_string($, function (err, xml) {
    if (err) return cb(err)
    self.writeFile(filename, xml, function(err, size) {
      if (err) return cb(err)
      cb(null, 'cheerio_to_file wrote ' + size + ' bytes')
    })
  })
}

Gdsn.prototype.msg_string_to_msg_info = function(raw_xml, cb) {
  log('gdsn msg_string_to_msg_info called with xml length ' + raw_xml.length)
  var clean_xml = this.clean_xml(raw_xml)
  var self = this
  this.cheerio_from_string(clean_xml, function (err, $) {
    self.cheerio_to_msg_info($, function (err, info) {
      if (err) return cb(err)
      info.xml     = clean_xml
      info.raw_xml = raw_xml
      cb(null, info)
    })
  })
}

Gdsn.prototype.cheerioCinInfoFromFile = function (cinInFile, cb) {
  log('cheerioCinInfoFromFile for file ' + cinInFile)
  var self = this
  this.cheerio_from_file(cinInFile, function (err, $) {
    self.cheerio_to_msg_info($, cb)
  })
}

Gdsn.prototype.cheerio_to_msg_info = function($, cb) {
  var self = this
  setImmediate(function () {
    try {
      var msg_type = $('DocumentIdentification Type').text()
      log('msg_type: ' + msg_type)

      var msg_id = $('DocumentIdentification InstanceIdentifier').text()
      log('msg_id: ' + msg_id)

      var sender = $('StandardBusinessDocumentHeader Sender Identifier').text()
      log('sender gln: ' + sender)

      var receiver = $('StandardBusinessDocumentHeader Receiver Identifier').text()
      log('receiver gln: ' + receiver)

      var recipient = $('dataRecipient').first().text()
      log('data recipient gln: ' + recipient)

      var source_dp = $('sourceDataPool').first().text()
      log('source dp gln: ' + source_dp)

      var created_date_time = $('DocumentIdentification CreationDateAndTime').text()
      var ts = (new Date(created_date_time)).getTime()
      log('created_ts: ' + ts)

      var item_count = 0
      var gtins = []
      var trade_items = []

      log('version: ' + $('HeaderVersion').text())

      var msg_info = {
          created_ts  : ts || 'na'
        , modified_ts : Date.now()
        , instance_id : msg_id || 'na'
        , type        : msg_type || 'na'
        , source_dp   : source_dp
        , recipient   : recipient
        , sender      : sender
        , receiver    : receiver
      }

      /*
      $('tradeItem').each(function () {
        item_count++

        var item = {}
        item.raw_xml    = $(this).html()
        item.created_ts = msg_info.created_ts
        item.recipient  = msg_info.recipient
        item.msg_id     = msg_info.instance_id
        item.source_dp  = msg_info.source_dp

        var clean_xml = self.clean_xml(item.raw_xml)
        item.xml = clean_xml

        item.gtin      = $('tradeItem tradeItemIdentification gtin', this).first().text()
        gtins.push(item.gtin)

        item.provider  = $('tradeItem tradeItemInformation informationProviderOfTradeItem informationProvider gln').first().text()
        item.tm        = $('tradeItem tradeItemInformation targetMarketInformation targetMarketCountryCode countryISOCode').first().text()
        item.unit_type = $('tradeItem tradeItemUnitDescriptor').first().text()
        item.gpc       = $('tradeItem tradeItemInformation classificationCategoryCode classificationCategoryCode').first().text()
        item.brand     = $('tradeItem tradeItemInformation tradeItemDescriptionInformation brandName').first().text()
        item.tm_sub    = $('tradeItem tradeItemInformation targetMarketInformation targetMarketSubdivisionCode countrySubDivisionISOCode').first().text()
        if (!item.tm_sub) item.tm_sub = 'na'
                            

        // child items
        item.child_count = $('tradeItem nextLowerLevelTradeItemInformation quantityOfChildren').first().text()
        item.child_gtins = $('tradeItem nextLowerLevelTradeItemInformation childTradeItem tradeItemIdentification gtin')
        if (item.child_count != item.child_gtins.length) {
          log('WARNING: child count ' + item.child_count + ' does not match child gtins found: ' + item.child_gtins.join(', '))
        }

        var en_name = $('functionalName description', this).filter(function () {
          return $('language languageISOCode', this).text() === 'en'
        }).find('shortText').text()
        log('english functional name: ' + en_name)

        $('tradeItemIdentification additionalTradeItemIdentification', this).each(function () {
          var el = $(this)
          log('item addl id: %s (type: %s)'
            , el.find('additionalTradeItemIdentificationValue').text()
            , el.find('additionalTradeItemIdentificationType').text()
          )
        })

        trade_items.push(item)
      })

      msg_info.item_count = item_count
      msg_info.gtins = gtins
      msg_info.trade_items = trade_items
      */

      cb(null, msg_info)
    }
    catch (err) {
      cb(err)
    }
  })
}

