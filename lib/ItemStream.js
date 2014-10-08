var fs = require('fs')

var MessageTransform = require('./MessageTransform')
var ElementTransform = require('./ElementTransform')

module.exports = ItemStream = function (gdsn) {

  if (!(this instanceof ItemStream)) return new ItemStream(gdsn)

  console.log('Creating new instance of ItemStream service')
  this._gdsn = gdsn
}

ItemStream.prototype.getTradeItemsFromFile = function (filename, cb) {
  console.log('Reading stream ' + filename)
  var is = fs.createReadStream(filename, {encoding: 'utf8'})
  this.getTradeItemsFromStream(is, cb)
}

ItemStream.prototype.getTradeItemsFromStream = function (is, cb) {
  var tradeItems = []
  this.getEachTradeItemFromStream(is, function (err, item) {
    if (err) return cb(err)
    if (!item) return cb(null, tradeItems)
    tradeItems.push(item)
  })
}

ItemStream.prototype.getEachTradeItemFromStream = function (is, cb) {

  var msg_header = new MessageTransform(this._gdsn.populate_msg_info_from_xml_fragment)
  var elements   = new ElementTransform('tradeItem')

  var gdsn = this._gdsn

  var msg_info_result = false

  msg_header.on('msg_info', function (err, msg_info) {
    if (err) return cb(err)
    console.log('found msg_header info: ' + JSON.stringify(msg_info))
    msg_info_result = msg_info

    // once we have the complete msg_info, we can start our trade item stream
    elements.on('element_xml', function (xml) {
      console.log('trade item element xml length: ' + xml.length)
      var item_info = gdsn.getTradeItemInfo(xml, msg_info)
      console.log('found item: ' + item_info.gtin)
      cb(null, item_info)
    })
    elements.on('end', function () {
      console.log('elements -> end')
      cb(null, null) // all done
    })
    elements.on('error', function (err) {
      cb(err)
    })
  })
  msg_header.on('end', function () {
    console.log('msg_header -> end: ' + JSON.stringify(msg_info_result))
    if (!msg_info_result) cb (new Error('required message header info not found'))
  })
  msg_header.on('error', function (err) {
    console.log('msg_header -> err: ' + err)
    cb(err)
  })

  is.pipe(msg_header).pipe(elements).resume()
}

