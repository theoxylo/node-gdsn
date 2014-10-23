var Gdsn = require('gdsn')
var fs   = require('fs')
var test = require('tap').test

test('getTradeItemsFromDom', function (t) {
  t.plan(1)

  var gdsn   = new Gdsn()

  gdsn.dom.getXmlDomForFile(__dirname + '/cin_from_other_dp.xml', function(err, $cin) {
    if (err) throw err

    var items = gdsn.dom.getTradeItemsForDom($cin)

    for (i in items) {
      var item = items[i]
      console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
    }
    console.log('item count: ' + items.length)
    t.ok(items.length == 3, 'found 3 items as expected')
    t.end()
  })
})
