(function () {
  
  var Gdsn = require('./index.js')
  var gdsn = new Gdsn({
    homeDataPoolGln: '1100001011285'
  })
  var log = console.log
  log(gdsn.getVersion())
  
  var file = process.argv.length == 3 ? process.argv.pop() : __dirname + '/test/cin_from_other_dp.xml'
  log('__dirname: ' + __dirname)
  log('file arg: ' + file)
  
  
  gdsn.readXmlFile(file, function(err, xml) {
    if (err) {
      log('Error: ' + err)
      process.exit(1)
    }
    gdsn.createCinResponse(xml, function(err, responseXml) {
      if (err) {
        log('Error: ' + err)
        process.exit(1)
      }
      log("Response: " + responseXml)
    })
  })
  
//  (function () { 
//    log("Transforming CIN from other data pool for local trading party recipient...")
//    gdsn.readXmlFile(file, function(err, xml) {
//      if (err) {
//        log('Error: ' + err)
//        process.exit(1)
//      }
//      gdsn.processCinFromOtherDP(xml, function(modXml) {
//        var outputFile = 'test/test_cin_to_local_party_' + new Date().getTime() + '.xml'
//        gdsn.writeXmlFile(outputFile, modXml, function(err, result) {
//          if (err) {
//            log('Error: ' + err)
//            process.exit(1)
//          }
//          log('Success! Created new CIN file ' + outputFile)
//        })
//      })
//    })
//  }()) // immediate execution
  
}())
