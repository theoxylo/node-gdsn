var stream = require('stream')
var util   = require('util')

// The 'process' argument is a function to be called with the content received so far,
// along with an info object that can be used to store state or results.
// If the function returns true, the content and future chunks will be pushed.

module.exports = MsgInfo

function MsgInfo(process) {

  if (!(this instanceof MsgInfo)) return new MsgInfo(process, options)

  var options = {
    decodeStrings: false
    , encoding: 'utf8'
  }

  stream.Transform.call(this, options)

  this._info       = {}
  this._process    = process 
  this._content    = ''
}

util.inherits(MsgInfo, stream.Transform);

MsgInfo.prototype._transform = function(chunk, encoding, done) {

  if (!this._info) { // info was already pushed, so just pass any remaining chunks
    this.push(chunk)
    done()
    return
  }

  this._content += chunk

  if (this._process(this._content, this._info)) {

    this.emit('info', null, this._info)

    this.push(this._content)

    this._content = null
    this._info = null
  }

  done()
}
