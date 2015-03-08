var Gdsn = require('../index.js')

if (process.argv.length < 3) {
  console.log("usage: node validate_gtin.js {gtin}")
  process.exit(1)
}
var gtin = process.argv[2]

console.log('gtin ' + gtin + ' is valid: ' + Gdsn.validateGtin(gtin))
