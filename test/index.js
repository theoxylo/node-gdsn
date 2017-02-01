var GdsnConstructor = require('../index.js')
var test            = require('tap').test

test('validateGln', function (t) {
  t.plan(1)
  var gdsn = new GdsnConstructor()
  var gln = '1100001011292'
  var isValid = gdsn.validateGln(gln) // return [true|false]
  t.ok(isValid, 'Tap: GLN ' + gln + ' is valid')
  console.log('GLN ' + gln + ' is ' + (isValid ? 'valid' : 'invalid'))
  t.end()
})

test('validateGtin', function (t) {
  t.plan(1)
  var gdsn = new GdsnConstructor()
  var gtin = '00749384988152'
  var isValid = gdsn.validateGtin(gtin) // return [true|false]
  t.ok(isValid, 'Tap: GTIN ' + gtin + ' is valid')
  console.log('GTIN ' + gtin + ' is ' + (isValid ? 'valid' : 'invalid'))
  t.end()
})

