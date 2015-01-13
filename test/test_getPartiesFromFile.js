var Gdsn = require('gdsn')
var fs   = require('fs')
var test = require('tap').test

test('getPartiesFromFile', function (t) {
  t.plan(1)

  var gdsn   = new Gdsn()

  var filename = __dirname + '/rpdd_28_small.xml'
  var is = fs.createReadStream(filename, {encoding: 'utf8'})
  var parties = []

  gdsn.getEachPartyFromStream(is, function(err, party) {
    if (err) return t.fail(err)
    if (party) {
      console.log('Found party with GLN ' + party.gln + ', extracted from message ' + party.msg_id)
      parties.push(party)
    }
    else { // null party is passed when no more parties are available
      t.ok(parties.length === 11, 'found ' + parties.length + ' parties as expected')
      t.end()
    }
  })
})
