var stream = require('stream')
var util   = require('util')

// The 'process' argument is a function to be called with the content received 
// so far, along with an info object that can be used to store state or results.
// Until this function returns true, no chunks will be pushed and the content
// will accumulate. Once it returns true, the function will no longer be called 
// and the current content will be pushed immediately as will any future chunks

module.exports = HeaderTransform

function HeaderTransform(process) {

  if (!(this instanceof HeaderTransform)) {
    return new HeaderTransform(process, options)
  }

  var options = {
    decodeStrings: false
    , encoding: 'utf8'
  }

  stream.Transform.call(this, options)

  this._info       = {}
  this._process    = process 
  this._content    = ''
}

util.inherits(HeaderTransform, stream.Transform);

HeaderTransform.prototype._transform = function(chunk, encoding, done) {

  if (!this._info) { // info was already pushed, so just pass any remaining chunks
    this.push(chunk)
    done()
    return
  }

  this._content += chunk

  if (this._process(this._content, this._info)) {

    this.emit('header_info', null, this._info)

    this.push(this._content)

    this._content = null
    this._info = null
  }

  done()
}
