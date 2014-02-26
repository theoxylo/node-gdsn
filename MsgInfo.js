var stream = require('stream')
var util   = require('util')

function MsgInfo(testFunction, info, callback) {
  this.info       = info
  this.callback   = callback
  this.testFunction = testFunction
  this.content    = ''
  stream.Transform.call(this, {});
}

util.inherits(MsgInfo, stream.Transform);

MsgInfo.prototype._transform = function(chunk, encoding, cb) {

  //console.log('_transform called with chunk length ' + (chunk ? chunk.length : 0))

  if (!this.info) {
    //console.log('MsgInfo work already completed')
    this.push(chunk)
    return cb()
  }

  this.content += chunk

  if (this.testFunction(this.content, this.info)) {
    this.push(this.content)
    var final_info = this.info
    this.info = null
    this.callback(null, final_info)
  }

  cb()
}

module.exports = MsgInfo
