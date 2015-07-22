#!/usr/bin/env node

(function () {

  var Gdsn = require('../index.js')

  if (process.argv.length < 3) {
    console.log("usage: node validate_gln.js {gln}")
    process.exit(1)
  }
  var gln = process.argv[2]

  console.log('gln ' + gln + ' is valid: ' + Gdsn.validateGln(gln))

})()
