(function () {

  if (process.argv.length < 3) {
    console.log("usage: node extract_trade_items.js cinFile1 cinFile2 ...")
    process.exit(1)
  }

  var XXX = require(__dirname + '/../index.js')
  
  var processFile = function (filename) {
    console.log('Processing CIN file: ' + filename)
    XXX.getTradeItemsFromFile(process.cwd() + '/' + filename, function(err, items) {
      if (err) throw err
      for (i in items) {
        var item = items[i]
        console.log('Found item with GTIN ' + item.gtin + ', msg_id ' + item.msg_id)
        //console.log(items[i])
      }
      console.log('item count: ' + items.length)
    })
  }

  while (process.argv.length > 2) {
    processFile(process.argv.pop())
  }

})()
