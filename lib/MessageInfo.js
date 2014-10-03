module.exports = MessageInfo = function (config) {

  if (!(this instanceof MessageInfo)) return new MessageInfo(config)

  console.log('Creating new instance of MessageInfo')

  this.created_ts 
  this.modified_ts

  this.sender
  this.receiver
  this.msg_type
  this.msg_id

  this.source_dp
  this.provider
  this.recipient
  this.gtins
  //this.trade_items
  this.item_count

  this.xml
  this.raw_xml
}

// handles xml fragments with regex
MessageInfo.prototype.populate_from_xml_fragment = function (xml) {
  if (!xml || !xml.length) return false

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
}

MessageInfo.prototype.is_populated = function () {
  return (
    this.msg_id && 
    this.created_ts && 
    this.msg_type && 
    (this.msg_type != 'catalogueItemNotification' || 
     (this.recipient && this.source_dp))
  )
}

