(function () {

  if (process.argv.length < 3) {
    console.log("usage: node validate_gln.js {gln}")
    process.exit(1)
  }
  var gln = process.argv[2]

  var Gdsn = require('../index.js')
  var gdsn = new Gdsn()
  
  console.log('gln ' + gln + ' is valid: ' + gdsn.validateGln(gln))

})()
