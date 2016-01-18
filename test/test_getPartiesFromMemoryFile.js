var fs   = require('fs')
var test = require('tap').test
var cheerio = require('cheerio')

test('getPartiesFromMemoryFile', function (t) {
  t.plan(1)

  var start = Date.now()
  console.log('start file read at ' + start + ' ms')

  var filename = __dirname + '/gdsn2/rpdd_28_small.xml'
  //var filename = __dirname + '/rpdd_28_med.xml'
  //var filename = __dirname + '/rpdd_28_HUGE.xml'

  fs.readFile(filename, {encoding: 'utf8'}, function(err, data) {
    if (err) throw err
    if (!data) throw Error('data not found')
    console.log('read ' + data.length + ' characters in ' + (Date.now() - start) + ' ms')

    var start2 = Date.now()
    console.log('start parse at ' + start2)
    var $ = cheerio.load(data, { 
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
    })
    console.log('parsed ' + $.length + ' elements in ' + (Date.now() - start2) + ' ms')

    var parties = []

    var start3 = Date.now()
    console.log('start party extraction at ' + start3)
    $('registryPartyDataDumpDetail').each(function () {
        //console.log('this: ' + JSON.stringify(this))

      var party = {}
      parties.push(party)
      party.gln    = $('registryParty informationProviderOfParty gln', this).text()
      party.active = $('registryParty isPartyActive', this).text()
      party.name   = $('registryPartyInformation partyRoleInformation partyOrDepartmentName', this).text()
      party.role   = $('registryPartyInformation partyRoleInformation partyRole', this).text()


      party.datapool = $('informationProvider', $(this).parent()).text()

      console.error(party.gln) // just the gln for uniq analysis
      //console.log(party.gln)
      //console.log('is active: ' + party.active)
      //console.log('party name: ' + party.name)
      //console.log('party role: ' + party.role)
      //console.log('gln: ' + party.gln + ', name: ' + party.name + ', datapool: ' + party.datapool)
    })
    console.log('extracted: ' + parties.length + ' parties in ' + (Date.now() - start3) + ' ms')
    console.log('found: ' + parties.length + ' parties in total ' + (Date.now() - start) + ' ms')
    t.ok(parties.length > 0, 'found ' + parties.length + ' parties')
    t.end()
  })
})
