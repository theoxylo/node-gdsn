var Gdsn = require('gdsn')
var test            = require('tap').test

test('processCinFromOtherDp', function (t) {
  t.plan(1)
  var gdsn = new Gdsn({
    homeDataPoolGln: "1100001011285"
    , outbox_dir: __dirname + '/outbox'
  })
  gdsn.processCinFromOtherDp(__dirname + '/cin_from_other_dp.xml', function(err, result) {
    if (err) throw err
    console.log('result: ' + result)
    t.ok(true, result)
    t.end()
  })
})
