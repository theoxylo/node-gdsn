#!/usr/bin/env node

(function () {

  if (process.argv.length < 3) {
    console.log("usage: bin/msg_split file1 file2 ...")
    process.exit(1)
  }

  var fs = require('fs')
  var Gdsn = require('../index.js')

  var gdsn = new Gdsn({
    homeDataPoolGln: '1100001011285'
  })

  var processFile = function (filename) {
    console.log('Processing file: ' + filename)

    fs.readFile(filename, 'utf8', function (err, xml) {
      if (err) throw err
      if (!xml || !xml.length) throw Error('file ' + filename + ' seems to be empty')
      console.log('read raw file: ' + filename + ' (' + Buffer.byteLength(xml) + ' bytes)')

      var msg_info = gdsn.get_msg_info(xml)
      gdsn.log_msg_info(msg_info)

      // generate new 3.1 CIN XML for local DP subscriber
      var cin_xml = gdsn.create_cin(msg_info.data,      // for CIN, an array of trade items
                                    msg_info.recipient, // subscriber
                                    'ADD',              // command
                                    false,              // reload
                                    'ORIGINAL',         // docStatus
                                    gdsn.config.homeDataPoolGln) // sender

      fs.writeFile(filename + '_convert31.xml', cin_xml, function (err) {
        if (err) throw err
      })
    })
  }

  while (process.argv.length > 2) {
    processFile(process.cwd() + '/' + process.argv.pop())
  }

})()
