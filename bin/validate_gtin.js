(function () {

  if (process.argv.length < 3) {
    console.log("usage: node validate_gtin.js {gtin}")
    process.exit(1)
  }
  var gtin = process.argv[2]

  var Gdsn = require('../index.js')
  var gdsn = new Gdsn()
  
  console.log('gtin ' + gtin + ' is valid: ' + gdsn.validateGtin(gtin))

})()
