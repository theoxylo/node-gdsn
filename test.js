(function () {
  
  var Gdsn = require('./index.js')
  var gdsn = new Gdsn()
  
  var repeatCount = 1
  var startTime = new Date().getTime()

  while (repeatCount--) {
    gdsn.readXmlFile('test/cin_from_other_dp.xml', function(err, xml) {
      handleError(err)
      gdsn.getXmlDom(xml, function (err, doc) {
        gdsn.createCinResponse(doc, function(err, responseXml) {
          var outputFile = 'test/outbox/cin_response_' + new Date().getTime() + '.xml'
          gdsn.writeXmlFile(outputFile, responseXml, function(err, result) {
            handleError(err)
            console.log('Created new CIN response file: ' + outputFile)
          })
        })
        gdsn.forwardCinFromOtherDP(doc, function(err, cinOut) {
          var outputFile = 'test/outbox/cin_to_local_party_' + new Date().getTime() + '.xml'
          gdsn.writeXmlFile(outputFile, cinOut, function(err, result) {
            handleError(err)
            console.log('Created new CIN out file: ' + outputFile)
          })
        })    // end forwardCinFromOtherDP
      })      // end getXmlDom
    })        // end readXmlFile
  }

  // time measure not working, logs right away while we wait for async functions
  //console.log('Test run time: ' + ((new Date().getTime() - startTime) / 1000) + ' seconds')
  
}())

function handleError(err) {
  if (err) {
    console.log('Error: ' + err)
    process.exit(1)
  }
}
