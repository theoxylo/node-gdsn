var stream = require('stream')
var util   = require('util')

module.exports = ElementTransform

function ElementTransform(elementName) {

  if (!(this instanceof ElementTransform)) {
    return new ElementTransform(elementName, options)
  }

  var options = {
    decodeStrings: false
    , encoding: 'utf8'
  }

  stream.Transform.call(this, options)

  this.setEncoding('utf8')

  this._content     = ''
  this._elementName = elementName
  this._start_regex = new RegExp('<' + elementName + '[\s>]')
}

util.inherits(ElementTransform, stream.Transform)

ElementTransform.prototype._transform = function(chunk, encoding, done) {

  this._content += chunk

  var element = ''
  while (element = this.getNextElement()) {
    this.emit('element_xml', element)
  }

  this.push(chunk, 'utf8')

  done()
}

ElementTransform.prototype.getNextElement = function() {

  var startIndex = this._content.search(this._start_regex)

  if (startIndex === -1) {
    // start tag not found, so we can trim most of the leading content we are tracking
    this._content = this._content.slice(this._content.length - this._elementName.length)
    return
  }

  // truncate leading content to avoid memory usage
  this._content = this._content.slice(startIndex) 

  var endIndex = this._content.indexOf('</' + this._elementName + '>')
  if (endIndex === -1) return

  endIndex += this._elementName.length + 3
  if (endIndex > this._content.length) return

  var element = this._content.slice(0, endIndex)

  this._content = this._content.slice(endIndex)

  return element
}
