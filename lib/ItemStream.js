var fs = require('fs')

var ItemInfo         = require('./ItemInfo.js')
var MessageTransform = require('./MessageTransform.js')
var ElementTransform = require('./ElementTransform.js')

module.exports = ItemStream = function (gdsn) {

  if (!(this instanceof ItemStream)) return new ItemStream(gdsn)

  console.log('Creating new instance of ItemStream service')
  this._gdsn = gdsn
}

ItemStream.prototype.getEachTradeItem= function (is, cb) {

  var msg_info_extract = new MessageTransform()
  var trade_items_extract   = new ElementTransform('tradeItem')

  var gdsn = this._gdsn

  var msg_info_success = false

  msg_info_extract.on('msg_info', function (err, msg_info) {
    if (err) return cb(err)
    msg_info.xml_fragment_length = msg_info.xml && msg_info.xml.length // how much xml did it take to find our header info?
    delete msg_info.xml // remove raw xml from info since not used
    console.log('found msg_info from beginning of stream: ' + JSON.stringify(msg_info))

    msg_info_success = msg_info

    // once we have the complete msg_info, we can start our trade item stream
    trade_items_extract.on('element_xml', function (xml) {
      console.log('trade item element xml length: ' + xml.length)
      var item_info = new ItemInfo(xml, msg_info.msg_id)
      if (!item_info) return cb(Error('item not found in xml'))
      cb(null, item_info)
    })
    trade_items_extract.on('end', function () {
      console.log('trade_items_extract -> end')
      cb(null, null) // all done
    })
    trade_items_extract.on('error', function (err) {
      cb(err)
    })
  })
  msg_info_extract.on('end', function () {
    console.log('msg_info_extract -> end with msg_info_success: ' + JSON.stringify(msg_info_success))
    if (!msg_info_success) {
      cb (new Error('required message header info not found'))
    }
  })
  msg_info_extract.on('error', function (err) {
    console.log('msg_info_extract -> err: ' + err)
    cb(err)
  })

  is.pipe(msg_info_extract).pipe(trade_items_extract).resume()
}

