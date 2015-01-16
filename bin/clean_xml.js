#!/usr/bin/env node
(function () {

  if (process.argv.length < 3) {
    console.log("usage: node clean_xml cinFile1 cinFile2 ...")
    process.exit(1)
  }

  var Gdsn = require(__dirname + '/../index.js')
  var fs = require('fs')

  var gdsn = new Gdsn({
    homeDataPoolGln: '1100001011285'
    , out_dir        : __dirname
    , templatePath   : __dirname + '/../templates/'
  })

  var processFile = function (filename) {
    console.log('Processing file: ' + filename)
    fs.readFile(filename, 'utf8', function (err, content) {
      if (err) throw err
      console.log('read raw file: ' + filename + ' (' + Buffer.byteLength(content) + ' bytes)')
      var clean_xml = gdsn.clean_xml(content)
      if (clean_xml) {
        filename += '_clean.xml'
        fs.writeFile(filename, clean_xml, function (err) {
          if (err) throw err
          console.log('wrote clean file: ' + filename + ' (' + Buffer.byteLength(clean_xml) + ' bytes)')
        })
      }
    })
  }

  while (process.argv.length > 2) {
    processFile(process.cwd() + '/' + process.argv.pop())
  }

}())
