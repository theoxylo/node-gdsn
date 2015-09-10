var Gdsn = require('gdsn')
var fs   = require('fs')
var test = require('tap').test

test('getPartiesFromFile', function (t) {
  t.plan(1)

  var gdsn   = new Gdsn()

  var filename = __dirname + '/rpdd_28_small.xml'
  //var filename = __dirname + '/rpdd_28_med.xml'
  //var filename = __dirname + '/rpdd_28_HUGE.xml'

  var start = Date.now()
  console.log('start file read at ' + start + ' ms')

  var is = fs.createReadStream(filename, {encoding: 'utf8'})
  var parties = []

  gdsn.getEachPartyFromStream(is, function(err, party) {
    if (err) return t.fail(err)
    if (party) {
      //console.log('Found party with GLN ' + party.gln + ', extracted from message ' + party.msg_id)
      parties.push(party)
      console.error(party.gln) // just the gln for uniq analysis
    }
    else { // null party is passed when no more parties are available
      console.log('found: ' + parties.length + ' parties in total ' + (Date.now() - start) + ' ms')
      t.ok(parties.length > 0, 'found ' + parties.length + ' parties')
      t.end()
    }
  })
  console.log('done sync')
})
