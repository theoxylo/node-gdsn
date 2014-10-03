// attempt to populate msg_info instance using the xml content received so far

// Until population is complete, no chunks will be pushed and the content
// will accumulate. Once complete, the current content will be pushed 
// immediately as will any future chunks

// the purpose is to delay further xml message processing until required
// prerequisites are available from the stream. for example, we don't extract
// items from a CIN until we know the source data pool, so that the item
// can be created with such required references

// if the end of the stream is reached without successful population, the 'end'
// event will pass a partial/default msg_info. the receiver can call the 
// is_populated method and proceed from there

var stream      = require('stream')
var util        = require('util')

var MessageInfo = require('./MessageInfo')

module.exports = MessageTransform = function () {

  if (!(this instanceof MessageTransform)) return new MessageTransform()

  stream.Transform.call(this, {decodeStrings:false, encoding:'utf8'})

  this.msg_info = new MessageInfo()
  this.content  = ''
}

util.inherits(MessageTransform, stream.Transform);

MessageTransform.prototype._transform = function(chunk, encoding, done) {

  if (!this.msg_info) { // info was already pushed, so just pass any remaining chunks
    this.push(chunk)
    return done()
  }

  this.content += chunk

  if (this.msg_info.populate_from_xml_fragment(this.content)) {

    this.emit('msg_info', null, this.msg_info)

    this.push(this.content)

    this.content = null
    this.msg_info = null
  }

  done()
}
