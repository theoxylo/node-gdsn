(function () {

  if (process.argv.length < 4) {
    console.log("usage: node extract_trade_items.js homeDpGln cinFile1 cinFile2 ...")
    process.exit(1)
  }

  var dpGln = process.argv[2]
  if (!dpGln.length || dpGln.length !== 13) {
    console.log("Error: invalid home data pool GLN: " + dpGln)
    process.exit(1)
  }

  var Gdsn = require(__dirname + '/../index.js')
  var gdsn = new Gdsn({
    homeDataPoolGln: dpGln
    , templatePath: __dirname + '/../templates/'
  })
  
  var processFile = function (filename) {
    console.log('Processing CIN file: ' + filename)
    gdsn.getTradeItemsFromFile(__dirname + '/' + filename, function(err, items) {
      if (err) throw err
      for (i in items) {
        console.log('Found item with GTIN ' + items[i].gtin)
        //console.log(items[i])
      }
      console.log('item count: ' + items.length)
    })
  }

  while (process.argv.length > 3) {
    processFile(process.argv.pop())
  }

})()
