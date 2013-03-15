(function () {
  
  var Gdsn = require('./index.js')
  
  var gdsn = new Gdsn({
    homeDataPoolGln: '1100001011285'
  })
  
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
  
}())
