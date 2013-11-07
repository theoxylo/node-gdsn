(function () {

  var GdsnX = require(__dirname + '/../index.js')
  var gdsn = GdsnX({
      homeDataPoolGln: '1100001011285',
      templatePath: __dirname + '/../templates/'
  })
  
  console.log('dirname: ' + __dirname);

  var ts = new Date().getTime()
  var responseOutFile = __dirname + '/outbox/cin_response_to_other_dp_'   + ts + '.xml'
  var forwardOutFile  = __dirname + '/outbox/cin_forward_to_local_party_' + ts + '.xml'

  gdsn.getXmlDomForFile(__dirname + '/cin_from_other_dp.xml', function (err, $cin) {

    handleError(err)

    gdsn.createCinResponse($cin, function (err, responseXml) {
      if (err) handleError(err)
      console.log("gdsn.createCinResponse: result xml length: " + responseXml.length)
      gdsn.writeFile(responseOutFile, responseXml, function (err) {
        if (err) handleError(err)
      })
    })

    gdsn.forwardCinFromOtherDP($cin, function (err, cinOut) {
      if (err) handleError(err)
      console.log("gdsn.forwardCinFromOtherDP: result xml length: " + cinOut.length)
      gdsn.writeFile(forwardOutFile, cinOut, function (err) {
        if (err) handleError(err)
      })
    })
  })
  
  function handleError(err) {
    if (err) {
      console.log("Halting execution after error: ")
      console.log(err)
      console.log(err.stack)
      process.exit(1)
    }
  }

}())
