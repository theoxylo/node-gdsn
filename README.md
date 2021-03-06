## node-gdsn

A GDSN service library for Node.js.

Provides useful utilities for data pools and trading parties.


## Installation

Get the latest published release from npm:

    npm install gdsn
    
    
## Usage

### To validate a GLN:
  * should be 13 digits
  * may contain leading zeroes (it's a string, not a number)
  * the last digit is a check digit

```js
var Gdsn = require('gdsn')
var gdsn = new Gdsn()
var gln = '1100001011483'
var isValid = gdsn.validateGln(gln) // return [true|false]
console.log('GLN ' + gln + ' is ' + (isValid ? 'valid' : 'invalid'))
```

### To validate a GTIN:
  * should be 14 digits
  * may contain leading zeroes (it's a string, not a number)
  * the last digit is a check digit

```js
var Gdsn = require('gdsn')
var gdsn = new Gdsn()
var gtin = '00749384988152'
var isValid = gdsn.validateGtin(gtin) // return [true|false]
console.log('GTIN ' + gtin + ' is ' + (isValid ? 'valid' : 'invalid'))
```

### To extract all trade items from a CIN file:
  * large CIN files may be 10+ MB and contain hundreds of items
  * this approach uses a callback to pass the complete array of items after the parsing has ended

```js
var Gdsn = require('gdsn')
var gdsn = new Gdsn()
gdsn.items.getTradeItemsFromFile(cinFile, function(err, items) {
  if (err) throw err
  for (i in items) {
    var item = items[i]
    console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
  }
  console.log('item count: ' + items.length)
})
```

### To extract trade items from a CIN stream one at a time:
  * this approach lets your callback work with each trade item as it is read
  * the first trade item will not be passed until the dataRecipient has been read from the stream

```js
var fs   = require('fs')
var Gdsn = require('gdsn')
var gdsn = new Gdsn()
var readable = fs.createReadStream(cinFile, {encoding: 'utf8'})
var items = []
gdsn.items.getEachTradeItemFromStream(readable, function (err, item) {
  if (err) throw err
  if (item) {
    console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
    items.push(item)
  }
  else {
    // all done
    console.log('item count: ' + items.length)
  }
})
```


## Development

Clone the latest DEV release from GH:

    git clone git@github.com:theoxylo/node-gdsn.git


To run some quick tests:

    cd node-gdsn
    npm update
    npm test


Submit a pull request to contribute!
