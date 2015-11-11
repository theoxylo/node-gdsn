#!/usr/bin/env node

(function () {

  if (process.argv.length < 3) {
    console.log("usage: node extract_trade_items_from_stream.js cinFile1 cinFile2 ...")
    process.exit(1)
  }

  var fs = require('fs')
  var Gdsn = require(__dirname + '/../index.js')

  var gdsn = new Gdsn()
  
  var processFile = function (filename) {
    console.log('Processing CIN file: ' + filename)
    var is = fs.createReadStream(process.cwd() + '/' + filename, {encoding: 'utf8'})

    var count = 0

    gdsn.getEachTradeItemFromStream(is, function(err, item) {
      if (err) throw err

      if (item) {
        count++
        console.log('Found item with GTIN ' + item.gtin + ', msg_id ' + item.msg_id)
      }
      console.log('found ' + count + ' trade items')
    })
  }

  while (process.argv.length > 2) {
    processFile(process.argv.pop())
  }

})()
