## node-gdsn

A GDSN service library for Node.js. 

Provides useful utilities for data pools and trading parties.


## Installation

Get the latest published release from npm:

    npm install gdsn

To run a quick test:

    npm test


## Usage

### To handle a CIN from another data pool:
  * create a specific data pool instance to handle the message
  * must create a GDSNResponse back to the source DP
  * must create a new CIN to the dataRecipient trading party

```js
var Gdsn = require('gdsn')
var gdsn = new Gdsn({
  homeDataPoolGln: '1100001011285',  
  templatePath: './node_modules/gdsn/templates/'
  out_dir: './test'
})
gdsn.processCinFromOtherDp(cinInboundFile)
```

### To validate a GLN:
  * should be 13 digits
  * may contain leading zeroes (it's a string, not a number)
  * the last digit is a check digit

```js
var Gdsn = require('gdsn')
var gln = '1100001011292'
var isValid = Gdsn.validateGln(gln) // return [true|false]
console.log('GLN ' + gln + ' is ' + (isValid ? 'valid' : 'invalid'))
```

### To validate a GTIN:
  * should be 14 digits
  * may contain leading zeroes (it's a string, not a number)
  * the last digit is a check digit

```js
var Gdsn = require('gdsn')
var gtin = '00749384988152'
var isValid = Gdsn.validateGtin(gtin) // return [true|false]
console.log('GTIN ' + gtin + ' is ' + (isValid ? 'valid' : 'invalid'))
```

### To extract trade items from a small CIN message:
  * uses in-memory DOM
  * not good for large CIN messages, see streaming approach below

```js
var Gdsn = require('gdsn')
Gdsn.getXmlDomForFile(cinFile, function(err, $cin) {
  if (err) throw err
  var items = Gdsn.getTradeItemsForDom($cin)
  for (i in items) {
    var item = items[i]
    console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
  }
  console.log('item count: ' + items.length)
})
```

### To extract trade items from a CIN stream:
  * large CIN files may be 10+ MB and contain hundreds of items
  * this approach uses a callback to deliver the complete array of items

```js
var Gdsn = require('gdsn')
Gdsn.getTradeItemsFromFile(cinFile, function(err, items) {
  if (err) throw err
  for (i in items) {
    var item = items[i]
    console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
  }
  console.log('item count: ' + items.length)
})
```

### To extract trade items from a CIN stream one at a time:
  * this approach lets your callback work with each trade item
  * the first trade item will not be deliverd until the dataRecipient has been read from the stream

```js
var fs   = require('fs')
var Gdsn = require('gdsn')
var readable = fs.createReadStream(cinFile, {encoding: 'utf8'})
var items = []
Gdsn.getEachTradeItemFromStream(readable, function (err, item) {
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

