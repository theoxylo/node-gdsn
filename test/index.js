(function () {

  var Gdsn = require('../index.js')
  var gdsn = new Gdsn()
  
  var ts = new Date().getTime()
  var responseOutFile = 'test/outbox/cin_response_to_other_db_'   + ts + '.xml'
  var forwardOutFile  = 'test/outbox/cin_forward_to_local_party_' + ts + '.xml'

  gdsn.getXmlDomForFile('test/cin_from_other_dp.xml', function(err, $cin) {

    handleError(err)

    gdsn.createCinResponse($cin, function(err, responseXml) {
      handleError(err)
      gdsn.writeFile(responseOutFile, responseXml, function(err) {
        handleError(err)
      })
    })

    gdsn.forwardCinFromOtherDP($cin, function(err, cinOut) {
      handleError(err)
      gdsn.writeFile(forwardOutFile, cinOut, function(err) {
        handleError(err)
      })
    })
  })
  
  function handleError(err) {
    if (err) {
      console.log("Error: " + err)
      process.exit(1)
    }
  }

}())
