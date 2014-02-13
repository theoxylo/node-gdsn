## node-gdsn

A GDSN service library for Node.js. 

Provides useful utilities for data pools and trading parties.


## Installation

Get the latest published release from npm:

    npm install gdsn

To run a quick test:

    npm test


## Usage

To handle a CIN from another data pool, we must create 2 new messages:
  * a GDSNResponse back to the source DP
  * a new CIN to the dataRecipient trading party

  ```js
  var Gdsn = require('gdsn');
  var gdsn = new Gdsn({ 
    homeDataPoolGln: '1100001011285',  
    templatePath: './node_modules/gdsn/templates' } 
  });

  var ts = Date.now()
  var cinInboundFile  = 'test/cin_from_other_dp.xml'
  var responseOutFile = 'test/outbox/cin_response_to_other_db_'   + ts + '.xml'
  var forwardOutFile  = 'test/outbox/cin_forward_to_local_party_' + ts + '.xml'

  gdsn.getXmlDomForFile(cinInboundFile, function(err, $cin) {
    if (err) throw err

    gdsn.createCinResponse($cin, function(err, responseXml) {
      if (err) throw err
      gdsn.writeFile(responseOutFile, responseXml, function(err) {
        if (err) throw err
      })
    })

    gdsn.forwardCinFromOtherDP($cin, function(err, cinOut) {
      if (err) throw err
      gdsn.writeFile(forwardOutFile, cinOut, function(err) {
        if (err) throw err
      })
    })
  })
  ```

