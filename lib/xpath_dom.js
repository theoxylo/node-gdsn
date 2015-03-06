var select      = require('xpath').select
var xmldom      = require('xmldom')

var _xmldom_parser = new xmldom.DOMParser({
  locator: {},
  errorHandler: function (level, msg) {console.log(level, "dom parse error: " + msg)}
})

var _xmldom_serializer = new xmldom.XMLSerializer()

var log = function (msg) {
  console.log(msg)
}

var getNodeData = function ($doc, path, asArray) {
  var nodes = select(path, $doc)
  var values = nodes.map(function (node) {
    if (!node) return
    var value = node.firstChild && node.firstChild.data
    return value || node.value // for attributes
  })
  if (asArray) return values || []
  return (values && values[0]) || ''
}

// removes extra whitespace between tags, but adds a new line for easy diff later
var trim = function (xml) {
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

// removes all namespace information
var clean = function (xml) {
  if (!xml || !xml.length) return ''
  xml = xml.replace(/<[^\/>][-_a-zA-Z0-9]*[^:>]:/g, '<')                   // remove open tag ns prefix <abc:tag>
  xml = xml.replace(/<\/[^>][-_a-zA-Z0-9]*[^:>]:/g, '<\/')                 // remove close tag ns prefix </abc:tag>
  xml = xml.replace(/\s*xmlns:[^=\s]*\s*=\s*['"][^'"]*['"]/g, '')          // remove xmlns:abc="123" ns attributes
  xml = xml.replace(/\s*[^:\s]*:schemaLocation\s*=\s*['"][^'"]*['"]/g, '') // remove abc:schemaLocation attributes
  return xml
}

api = {}

api.getTradeItemInfo = function (raw_xml, msg_info) {

  var info = {}
  info.created_ts = msg_info.created_ts
  info.recipient  = msg_info.recipient
  info.msg_id     = msg_info.msg_id
  info.source_dp  = msg_info.source_dp

  var trimmed_xml = trim(raw_xml)
  var clean_xml = clean(trimmed_xml)
  info.xml = trimmed_xml

  var $doc
  try {
    $doc = _xmldom_parser.parseFromString(clean_xml, 'text/xml')
    $doc.normalize()
  }
  catch (err) {
    $doc = {}
    console.log('ignoring parse error: ' + err + ' for xml: ' + clean_xml)
  }
  info.gtin      = getNodeData($doc, '/tradeItem/tradeItemIdentification/gtin')
  info.provider  = getNodeData($doc, '/tradeItem/tradeItemInformation/informationProviderOfTradeItem/informationProvider/gln')
  info.tm        = getNodeData($doc, '/tradeItem/tradeItemInformation/targetMarketInformation/targetMarketCountryCode/countryISOCode')
  info.unit_type = getNodeData($doc, '/tradeItem/tradeItemUnitDescriptor')
  info.gpc       = getNodeData($doc, '/tradeItem/tradeItemInformation/classificationCategoryCode/classificationCategoryCode')
  info.brand     = getNodeData($doc, '/tradeItem/tradeItemInformation/tradeItemDescriptionInformation/brandName')
  info.tm_sub    = getNodeData($doc, '/tradeItem/tradeItemInformation/targetMarketInformation/targetMarketSubdivisionCode/countrySubDivisionISOCode')
  if (!info.tm_sub) info.tm_sub = 'na'

  // child items
  info.child_count = getNodeData($doc, '/tradeItem/nextLowerLevelTradeItemInformation/quantityOfChildren')
  info.child_gtins = getNodeData($doc, '/tradeItem/nextLowerLevelTradeItemInformation/childTradeItem/tradeItemIdentification/gtin', true)
  if (info.child_count != info.child_gtins.length) {
    log('WARNING: child count ' + info.child_count + ' does not match child gtins found: ' + info.child_gtins.join(', '))
  }

  return info
}

api.getPartyInfo = function (raw_xml, msg_info) {

  var info = {}
  //info.raw_xml    = raw_xml
  info.msg_id     = msg_info.msg_id

  var trimmed_xml = trim(raw_xml)
  var clean_xml = clean(trimmed_xml)
  info.xml = trimmed_xml

  var $doc
  try {
    $doc = _xmldom_parser.parseFromString(clean_xml, 'text/xml')
    $doc.normalize()
  }
  catch (err) {
    $doc = {}
    console.log('ignoring parse error: ' + err + ' for xml: ' + clean_xml)
  }
  info.provider      = getNodeData($doc, '/registryPartyDataDumpDetail/registryParty/informationProviderOfParty/gln')
  info.name          = getNodeData($doc, '/registryPartyDataDumpDetail/registryParty/registryPartyInformation/partyRoleInformation/partyOrDepartmentName')
  info.tm            = getNodeData($doc, '/registryPartyDataDumpDetail/registryParty/registryPartyInformation/registryPartyNameAndAddress/countryCode/countryISOCode')
  info.source_dp     = getNodeData($doc, '/registryPartyDataDumpDetail/registryPartyDates/registeringParty')
  var created_date_time = getNodeData($doc, '/registryPartyDataDumpDetail/registryPartyDates/registrationDateTime')
  info.created_ts    = (new Date(created_date_time)).getTime()

  return info
}

module.exports = api
