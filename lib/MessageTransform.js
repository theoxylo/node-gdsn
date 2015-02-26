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

module.exports = MessageTransform = function () {

  if (!(this instanceof MessageTransform)) return new MessageTransform()

  stream.Transform.call(this, {decodeStrings:false, encoding:'utf8'})

  this.msg_info = {
    // handles xml fragments with regex
    populate_from_xml_fragment: function (xml) {
      console.log('populate_from_xml_fragment with xml length: ' + (xml && xml.length))
      if (!xml || !xml.length) return false
      //this.xml = xml

      var match

      if (!this.msg_id) {
        match = xml.match(/InstanceIdentifier>([^<\/]*)<\//)
        this.msg_id = match && match.length == 2 && match[1]
        if (this.msg_id) console.log('msg id: ' + this.msg_id)
      }
      if (!this.created_ts) {
        match = xml.match(/CreationDateAndTime>([.0-9T:-]*)</)
        if (match && match[1]) {
          var created_date_time = match[1]
          console.log('create date time: ' + created_date_time)
          this.created_ts = (new Date(created_date_time)).getTime()
          if (this.created_ts) console.log('create timestamp: ' + this.created_ts)
        }
      }
      if (!this.msg_type) {
        match = xml.match(/Type>([a-zA-Z]{1,})</)
        this.msg_type = match && match.length == 2 && match[1]
        if (this.msg_type) console.log('msg_type: ' + this.msg_type)
      }

      if (this.msg_type == 'catalogueItemNotification') {
        if (!this.recipient) {
          match = xml.match(/dataRecipient>(\d{13})</)
          this.recipient = match && match.length == 2 && match[1]
          if (this.recipient) console.log('data recipient: ' + this.recipient)
        }
        if (!this.source_dp) {
          match = xml.match(/sourceDataPool>(\d{13})</)
          this.source_dp = match && match.length == 2 && match[1]
          if (this.source_dp) console.log('source_dp: ' + this.source_dp)
        }
      }
      return this.is_populated()
    },
    is_populated: function () {
        console.log('MessageTransform.is_populated, JSON.stringify(this)')
        console.log(JSON.stringify(this))
      return (
        this.msg_id && 
        this.created_ts && 
        this.msg_type && 
        (this.msg_type != 'catalogueItemNotification' || 
         (this.recipient && this.source_dp))
      )
    }
  }

  this.content  = ''
}

util.inherits(MessageTransform, stream.Transform);

MessageTransform.prototype._transform = function(chunk, encoding, done) {

  //console.log('MessageTransform _transform with chunk length ' + (chunk && chunk.length))
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
