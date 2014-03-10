var stream = require('stream')
var util   = require('util')

module.exports = ElementStream

function ElementStream(elementName) {

  if (!(this instanceof ElementStream)) return new ElementStream(elementName, options)

  var options = {
    decodeStrings: false
    , encoding: 'utf8'
  }

  stream.Transform.call(this, options)

  this.setEncoding('utf8')

  this._elementName = elementName

  this._content = ''

  this._start_regex = new RegExp('<' + elementName + '[\s>]')
}

util.inherits(ElementStream, stream.Transform)

ElementStream.prototype._transform = function(chunk, encoding, done) {

  console.log('_transform chunk type: ' + chunk.constructor.name)
  console.log('_transform chunk length: ' + chunk.length)
  console.log('_transform chunk encoding: ' + encoding)
  
  this._content += chunk

  var element = ''
  while (element = this.getNextElement()) {

    this.emit('element', element)
  }

  this.push(chunk, 'utf8')

  console.log('_transform content length: ' + this._content.length)

  done()
}

ElementStream.prototype.getNextElement = function() {

  //var startIndex = this._content.indexOf('<' + this._elementName)
  var startIndex = this._content.search(this._start_regex)

  if (startIndex === -1) {
    // start tag not found, so we can trim most of the leading content we are tracking
    this._content = this._content.slice(this._content.length - this._elementName.length)
    return
  }

  this._content = this._content.slice(startIndex) // truncate leading content to avoid memory usage

  var endIndex = this._content.indexOf('</' + this._elementName + '>')
  if (endIndex === -1) return

  endIndex += this._elementName.length + 3
  if (endIndex > this._content.length) return

  var e = this._content.slice(0, endIndex)

  this._content = this._content.slice(endIndex)

  return e
}
