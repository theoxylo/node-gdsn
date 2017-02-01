var Gdsn        = require('../index.js')
var fs          = require('fs')
var test        = require('tap').test

test('getTradeItemsFromFile', function (t) {
  t.plan(1)

  var gdsn   = new Gdsn()

  var filename = __dirname + '/gdsn2/cin_from_other_dp.xml'
  var is = fs.createReadStream(filename, {encoding: 'utf8'})
  var items = []

  gdsn.getEachTradeItemFromStream(is, function(err, item) {
    if (err) return t.fail(err)
    if (item) {
      console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
      items.push(item)
    }
    else { // null item is passed when no more items are available
      t.ok(items.length === 3, 'found ' + items.length + ' parties as expected')
      t.end()
    }
  })
})
