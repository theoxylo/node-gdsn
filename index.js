var fs          = require('fs')
var cheerio     = require('cheerio')
var MessageInfo = require('./lib/MessageInfo')

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

Gdsn.prototype.msg_string_to_msg_info = function(raw_xml, cb) {
  log('gdsn msg_string_to_msg_info called with raw xml length ' + raw_xml.length)
  var self = this
  setImmediate(function () {
    try {
      var clean_xml = self.clean_xml(raw_xml)
      var $ = cheerio.load(clean_xml, { 
        _:0
        , normalizeWhitespace: true
        , xmlMode: true
      })
      var msg_info = new MessageInfo()
      msg_info.msg_type = $('DocumentIdentification Type').text()
      msg_info.msg_id = $('DocumentIdentification InstanceIdentifier').text()
      msg_info.sender = $('StandardBusinessDocumentHeader Sender Identifier').text()
      msg_info.receiver = $('StandardBusinessDocumentHeader Receiver Identifier').text()
      msg_info.source_dp = $('sourceDataPool').first().text()

      var created_date_time = $('DocumentIdentification CreationDateAndTime').text()
      msg_info.created_ts = (new Date(created_date_time)).getTime()
      msg_info.version = $('DocumentIdentification TypeVersion').text()

      // gdsn response/exception messages
      if (msg_info.msg_type == 'GDSNResponse') {

        msg_info.request_msg_id = $('RequestingDocumentInstanceIdentifier').text()
        log('request_msg_id: ' + msg_info.request_msg_id)
        // either it is an exception or a status reponse:
        var exception = $('gDSNException').text() // just capture all text for xsd:complexType
        if (exception) {
          msg_info.status = 'ERROR'
          msg_info.exception = exception
        }
        else {
          if (!msg_info.status) msg_info.status = $('eANUCCResponse').first().attr('responseStatus')
          if (!msg_info.status) msg_info.status = $('partyRegistrationResponse').first().attr('responseStatus')
          if (!msg_info.status) msg_info.status = $('catalogueItemRegistrationResponse').first().attr('responseStatus')
        }
      }
      else if (msg_info.msg_type == 'catalogueItemConfirmation') {

        msg_info.status = $('catalogueItemConfirmationState').first().attr('state')
        log('cic state: ' + msg_info.status)
        if (msg_info.status == 'REVIEW') {
          msg_info.exception = $('catalogueItemConfirmationStatus').text() || 'na'
          log('review message: ' + msg_info.exception)
        }
        msg_info.recipient = $('catalogueItemConfirmationState recipientGLN').text()
      }
      else if (msg_info.msg_type == 'catalogueItemNotification') {

        msg_info.provider = $('informationProviderOfTradeItem informationProvider gln').first().text()
        log('data provider gln: ' + msg_info.provider)

        msg_info.recipient = $('dataRecipient').first().text()
        log('data recipient gln: ' + msg_info.recipient)

        var gtins = []
        $('tradeItem').each(function () {
          var gtin = $('tradeItem tradeItemIdentification gtin', this).first().text()
          gtins.push(gtin)
        })
        msg_info.gtins = gtins
      }
      else if (msg_info.msg_type == 'catalogueItemPublication') {
      }
      else if (msg_info.msg_type == 'catalogueItemSubscription') {
      }

      // for most messages, use the command type as the status
      if (!msg_info.status) msg_info.status = $('documentCommandHeader').first().attr('type') || 'na'

      // item ref is used by CIC, CIP, CIS
      var catalog_item_ref = $('catalogueItemReference')
      if (catalog_item_ref.length) {
        msg_info.gtin     = $('gtin', catalog_item_ref).first().text()
        msg_info.provider = $('dataSource', catalog_item_ref).first().text()
        msg_info.tm       = $('countryISOCode', catalog_item_ref).first().text()
        msg_info.tm_sub   = $('countrySubDivisionISOCode', catalog_item_ref).first().text() || 'na'
      }

      msg_info.item_count = (msg_info.gtins && msg_info.gtins.length) || (msg_info.gtin && 1)

      msg_info.xml     = clean_xml
      msg_info.raw_xml = raw_xml

      //log('final msg_info data: ' + JSON.stringify(msg_info))
      cb(null, msg_info)
    }
    catch (err) {
      cb(err)
    }
  })
}

/*
Gdsn.prototype.cheerio_to_file = function (filename, $, cb) {
  setImmediate(function () {
    try {
      var xml = $.html()
      fs.writeFile(filename, xml, function (err) {
        if (err) return cb(err)
        var size = Buffer.byteLength(xml)
        log('Gdsn writeFile: ' + filename + ' (' + size + ' bytes)')
        cb(null, 'cheerio_to_file wrote ' + size + ' bytes')
      })
    }
    catch (err) {
      cb(err)
    }
  })
}
*/

