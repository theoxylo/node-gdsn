var cheerio     = require('cheerio')

var log = console.log

module.exports = Gdsn = function (config) {

  if (!(this instanceof Gdsn)) return new Gdsn(config)

  config = config || {clean_newline: true}
  if (!config.templatePath)    config.templatePath    = __dirname + '/templates'
  if (!config.homeDataPoolGln) config.homeDataPoolGln = '0000000000000'
  if (!config.outbox_dir)      config.outbox_dir      = config.out_dir || __dirname + '/outbox'

  if (!this.validateGln(config.homeDataPoolGln)) {
    log('Error: invalid home data pool GLN: ' + config.homeDataPoolGln)
    process.exit(1)
  }

  this.config = config
  config.gdsn = this

  this.ItemInfo    = require('./lib/ItemInfo')(config)
  this.MessageInfo = require('./lib/MessageInfo')(config)

  require('./lib/xpath_dom.js')(this) // adds this.dom
}

Gdsn.prototype.getTradeItemInfo = function (xml, msg_header_info) {
  return this.dom.getTradeItemInfo(xml, msg_header_info)
}

// removes extra whitespace between tags, but adds a new line for easy diff
Gdsn.prototype.trim_xml = function (xml) {
  var match = xml.match(/<[^]*>/) // match bulk xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  if (!match || !match[0] || !match[0].length) {
    log('WARNING could not parse string as xml: ' + xml)
    return ''
  }
  var result = match[0]
  result = result.replace(/>\s*</g, '><') // remove extra whitespace between tags
  result = result.replace(/></g, '>\n<')  // add line return between tags
  return result
}

Gdsn.prototype.clean_xml = function (xml, skip_trim) {
  if (!xml || !xml.length) return ''
  var clean_xml = ''
  if (!skip_trim) clean_xml = this.trim_xml(xml)
  else clean_xml = xml
  clean_xml = clean_xml.replace(/<[^\/>][-_a-zA-Z0-9]*[^:>]:/g, '<')                   // remove open tag ns prefix <abc:tag>
  clean_xml = clean_xml.replace(/<\/[^>][-_a-zA-Z0-9]*[^:>]:/g, '<\/')                 // remove close tag ns prefix </abc:tag>
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

Gdsn.prototype.msg_string_to_msg_info = function(xml, cb) {
  log('gdsn msg_string_to_msg_info called with raw xml length ' + xml.length)
  var self = this
  setImmediate(function () {
    try {
      var msg_info = new self.MessageInfo(xml)
      log('new msg_info msg_id: ' + msg_info.msg_id)
      cb(null, msg_info)
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.item_string_to_item_info = function(xml, cb) {
  log('gdsn item_string_to_item_info called with raw xml length ' + xml.length)
  var self = this
  setImmediate(function () {
    try {
      var item_info = new self.ItemInfo(xml)
      log('new item_info msg_id: ' + item_info.msg_id)
      cb(null, item_info)
    }
    catch (err) {
      cb(err)
    }
  })
}
