(function () {

  if (process.argv.length < 3) {
    console.log("usage: node extract_trade_items.js cinFile1 cinFile2 ...")
    process.exit(1)
  }

  var fs = require('fs')
  var Gdsn = require(__dirname + '/../index.js')

  var gdsn = new Gdsn()
  
  var processFile = function (filename) {
    console.log('Processing RPDD file: ' + filename)
    var is = fs.createReadStream(process.cwd() + '/' + filename, {encoding: 'utf8'})

    var count = 0

    gdsn.parties.getEachPartyFromStream(is, function(err, party) {
      if (err) throw err
      if (party) {
        count++
        console.log('party name: ' + party.name)
      }
    })

    console.log('found ' + count + ' parties')
  }

  while (process.argv.length > 2) {
    processFile(process.argv.pop())
  }

})()
