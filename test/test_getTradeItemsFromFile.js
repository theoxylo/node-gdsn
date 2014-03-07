var GdsnConstructor = require('gdsn')
var test            = require('tap').test

var gdsn = new GdsnConstructor()

test('getTradeItemsFromFile', function (t) {
  t.plan(1)
  gdsn.getTradeItemsFromFile(__dirname + '/cin_from_other_dp.xml', function(err, items) {
    if (err) throw err
    for (i in items) {
      var item = items[i]
      console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
    }
    console.log('item count: ' + items.length)
    t.ok(items.length == 3, 'found 3 items as expected')
    t.end()
  })
})
