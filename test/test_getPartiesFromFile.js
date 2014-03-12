var Gdsn         = require('gdsn')
var test         = require('tap').test

test('getPartiesFromFile', function (t) {
  t.plan(1)

  var gdsn   = new Gdsn()

  gdsn.parties.getPartiesFromFile(__dirname + '/RPDD_small.xml', function(err, parties) {
    if (err) throw err
    for (i in parties) {
      var party = parties[i]
      console.log('Found party with GLN ' + party.gln + ', extracted from message ' + party.msg_id)
    }
    console.log('party count: ' + parties.length)
    t.ok(parties.length === 86, 'found ' + parties.length + ' parties as expected')
    t.end()
  })
})
