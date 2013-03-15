[![build status](https://secure.travis-ci.org/theoxylo/node-gdsn.png)](http://travis-ci.org/theoxylo/node-gdsn)

## node-gdsn

A GDSN EIP service library for Node.js. 

Provides useful utilities for data pools and trading parties.


## Installation

Get the latest published release from npm [v006_20130315]

    npm install gdsn

Or add to package.json and 

    npm install
    
To run a quick test

    npm test


## Usage

To handle a CIN from another data pool, we must create 2 new messages:
  1. a GDSNResponse back to the source DP
  2. a new CIN to the dataRecipient trading party

  ```javascript
  var Gdsn = require('gdsn')
  var gdsn = new Gdsn({ homeDataPoolGln: '1100001011285' })
  console.log(gdsn.getVersion())

  gdsn.readXmlFile('test/cin_from_other_dp.xml', function(err, xml) {
    if (err) {
      console.log('Error: ' + err)
      process.exit(1)
    }
    var doc = gdsn.getDocForXml(xml)
    gdsn.createCinResponse(doc, function(err, responseXml) {
      var outputFile = 'test/outbox/test_cin_response_' + new Date().getTime() + '.xml'
      gdsn.writeXmlFile(outputFile, responseXml, function(err, result) {
        if (err) {
          console.log('Error: ' + err)
          process.exit(1)
        }
        console.log('Created new CIN response file: ' + outputFile)
      })
      gdsn.forwardCinFromOtherDP(doc, function(err, cinOut) {
        var outputFile = 'test/outbox/test_cin_to_local_party_' + new Date().getTime() + '.xml'
        gdsn.writeXmlFile(outputFile, cinOut, function(err, result) {
          if (err) {
            console.log('Error: ' + err)
            process.exit(1)
          }
          console.log('Created new CIN out file: ' + outputFile)
        })
      })
    })
  })
  ```
The new XML output files will be placed in the 'test/outbox' directory


## Development
    
Get the latest version from GitHub instead of npm:

    mkdir project_dir
    cd project_dir
    git clone https://github.com/theoxylo/node-gdsn.git node_modules/gdsn
    cd node_modules/gdsn
    npm install
    node test/test.js test/cin.xml
