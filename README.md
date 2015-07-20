## node-gdsn

A GDSN service library for Node.js.

Provides useful utilities for data pools and trading parties.


## Installation

Get the latest published release from npm (0.1.2):

    npm install gdsn

To run a quick test:

    npm test


## Usage

### To handle a CIN from another data pool:
  * must instantiate a specific data pool instance to handle the message
  * will create a GDSNResponse back to the source DP
  * will create a new CIN to the dataRecipient trading party

```js
var Gdsn = require('gdsn')
var gdsn = new Gdsn({
  homeDataPoolGln: '1100001011339',
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

### To extract trade items from a small CIN message:
  * uses in-memory DOM
  * not good for large CIN messages, see streaming approach below

```js
var Gdsn = require('gdsn')
var gdsn = new Gdsn()
gdsn.getXmlDomForFile(cinFile, function(err, $cin) {
  if (err) throw err
  var items = gdsn.getTradeItemsForDom($cin)
  for (i in items) {
    var item = items[i]
    console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
  }
  console.log('item count: ' + items.length)
})
```

### To extract all trade items from a CIN stream:
  * large CIN files may be 10+ MB and contain hundreds of items
  * this approach uses a callback to pass the complete array of items after the stream has ended

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

### To extract trading parties from an RPDD stream one at a time:
  * this approach lets your callback work with each party as it is read
  * the first party will not be passed until the message id has been read from the stream

```js
var fs   = require('fs')
var Gdsn = require('gdsn')
var gdsn = new Gdsn()
var readable = fs.createReadStream(rpddFile, {encoding: 'utf8'})
var parties = []
gdsn.parties.getEachPartyFromStream(readable, function (err, party) {
  if (err) throw err
  if (party) {
    console.log('Found party with GLN ' + party.gln + ', extracted from message ' + party.msg_id)
    parties.push(party)
  }
  else {
    // all done
    console.log('party count: ' + parties.length)
  }
})
```
