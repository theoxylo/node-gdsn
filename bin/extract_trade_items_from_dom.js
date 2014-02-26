(function () {

  if (process.argv.length < 3) {
    console.log("usage: node extract_trade_items.js homeDpGln cinFile1 cinFile2 ...")
    process.exit(1)
  }

  var Gdsn = require(__dirname + '/../index.js')
  
  var processFile = function (filename) {
    console.log('Processing CIN file: ' + filename)
    Gdsn.getXmlDomForFile(process.cwd() + '/' + filename, function(err, $cin) {

      if (err) throw err

      var items = Gdsn.getTradeItemsForDom($cin)

      for (i in items) {
        console.log('Found item with GTIN ' + items[i].gtin)
        //console.log(items[i])
      }
      console.log('item count: ' + items.length)
    })
  }

  while (process.argv.length > 2) {
    processFile(process.argv.pop())
  }

})()
