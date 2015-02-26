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

module.exports = api
