var Gdsn = require('gdsn')
var test            = require('tap').test

test('cheerioCinInfoFromFile', function (t) {
  t.plan(1)
  var gdsn = new Gdsn({
    homeDataPoolGln: "1100001011285"
    , outbox_dir: __dirname + '/outbox'
  })
  gdsn.cheerioCinInfoFromFile(__dirname + '/cin_from_other_dp.xml', function(err, result) {
    if (err) throw err
    console.log('result: ' + JSON.stringify(result))
    t.ok(true, result)
    t.end()
  })
})
