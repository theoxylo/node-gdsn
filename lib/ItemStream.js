var fs               = require('fs')
var HeaderTransform  = require('./HeaderTransform')
var ElementTransform = require('./ElementTransform')

module.exports = ItemStream

function ItemStream(gdsn) {
  if (!(this instanceof ItemStream)) {
    return new ItemStream(gdsn)
  }
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

  var msgInfo  = new HeaderTransform(this._gdsn.getMessageInfoFromString)
  var elements = new ElementTransform('tradeItem')

  var gdsn = this._gdsn

  var header_info_result = false

  msgInfo.on('header_info', function (err, header_info) {
    if (err) return cb(err)
    console.log('found msgInfo info: ' + JSON.stringify(header_info))
    header_info_result = header_info

    // once we have the complete header_info, we can start our trade item stream
    elements.on('element_xml', function (xml) {
      console.log('trade item element xml length: ' + xml.length)
      var item_info = gdsn.getTradeItemInfo(xml, header_info)
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
  msgInfo.on('end', function () {
    console.log('msgInfo -> end')
    if (!header_info_result) cb (new Error('required message header info not found'))
  })
  msgInfo.on('error', function (err) {
    console.log('msgInfo -> err: ' + err)
    //cb(err)
  })

  is.pipe(msgInfo).pipe(elements).resume()
}

