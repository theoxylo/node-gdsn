var fs       = require('fs')
var Header   = require('./HeaderTransform')
var Elements = require('./ElementTransform')

module.exports = ItemStream

function ItemStream(gdsn) {
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

  var msg       = new Header(this._gdsn.getMessageInfoFromString)
  var recipient = new Header(this._gdsn.getDataRecipientFromString)
  var elements  = new Elements('tradeItem')

  var gdsn = this._gdsn

  msg.on('info', function (err, msg_info) {
    if (err) return cb(err)
    console.log('found msg info: ' + JSON.stringify(msg_info))

    recipient.on('info', function (err, recipient_info) {
      if (err) return cb(err)
      console.log('found recipient info: ' + JSON.stringify(recipient_info))
      msg_info.recipient = recipient_info.recipient

      // once we have the complete msg_info, we can start our trade item stream
      elements.on('element', function (xml) {
        console.log('trade item element xml length: ' + xml.length)
        var item_info = gdsn.getTradeItemInfo(xml, msg_info)
        console.log('found item: ' + item_info.gtin)
        cb(null, item_info)
      })
      elements.on('end', function () {
        cb(null, null) // all done
      })
      elements.on('error', function (err) {
        cb(err)
      })
    })
  })

  is.pipe(msg).pipe(recipient).pipe(elements).resume()
}

