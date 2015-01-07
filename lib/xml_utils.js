var ItemInfo     = require('./ItemInfo')
var MessageInfo  = require('./MessageInfo')
var MessageInfo3 = require('./MessageInfo3')

var api = {}

// removes extra whitespace between tags, but adds a new line for easy diff later
api.trim = function (xml) {
  var match = xml.match(/<[^]*>/) // match bulk xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  if (!match || !match[0] || !match[0].length) {
    console.log('WARNING could not parse string as xml: ' + xml)
    return ''
  }
  var result = match[0]
  result = result.replace(/>\s*</g, '><') // remove extra whitespace between tags
  result = result.replace(/></g, '>\n<')  // add line return between tags
  return result
}

// removes all namespace information
api.clean = function (xml) {
  if (!xml || !xml.length) return ''
  xml = xml.replace(/<[^\/>][-_a-zA-Z0-9]*[^:>]:/g, '<')                   // remove open tag ns prefix <abc:tag>
  xml = xml.replace(/<\/[^>][-_a-zA-Z0-9]*[^:>]:/g, '<\/')                 // remove close tag ns prefix </abc:tag>
  xml = xml.replace(/\s*xmlns:[^=\s]*\s*=\s*['"][^'"]*['"]/g, '')          // remove xmlns:abc="123" ns attributes
  xml = xml.replace(/\s*[^:\s]*:schemaLocation\s*=\s*['"][^'"]*['"]/g, '') // remove abc:schemaLocation attributes
  return xml
}

api.get_message_info = function (xml, config) {
  var trimmed_xml = this.trim(xml)
  var msg_info = new MessageInfo3(trimmed_xml, config)
  if (msg_info.msg_type == 'StandardBusinessDocument') {
    var cleaned_xml = this.clean(trimmed_xml)
    msg_info = new MessageInfo(cleaned_xml, config)
  }
  msg_info.xml = trimmed_xml
  return msg_info
}

api.get_item_info = function(xml) {
  var cleaned_xml = this.clean(this.trim(xml))
  var item_info = new ItemInfo(cleaned_xml)
  item_info.raw_xml = xml
  return item_info
}

api.get_party_info = function(xml) {
  var cleaned_xml = this.clean(this.trim(xml))
  var party_info = new PartyInfo(cleaned_xml)
  party_info.raw_xml = xml
  return party_info
}

module.exports = api
