(function () {
  
  var Gdsn = require('../')
  var gdsn = new Gdsn({
    homeDataPoolGln: '1100001011285'
  })
  var log = console.log
  var file = process.argv.length == 3 ? process.argv.pop() : __dirname + '/cin_from_other_dp.xml'
  
  log('__dirname: ' + __dirname)
  log('file arg: ' + file)
  
  log("Transforming CIN from other data pool for local trading party recipient...")
  gdsn.readXmlFile(file, function(err, xml) {
    if (err) {
      log('Error: ' + err)
      process.exit(1)
    }
    var modXml = gdsn.processCinFromOtherDP(xml) // sync
    var outputFile = 'cin_to_local_party_' + new Date().getTime() + '.xml'
    gdsn.writeXmlFile(outputFile, modXml, function(err, result) {
      if (err) {
        log('Error: ' + err)
        process.exit(1)
      }
      log('Success! Created new CIN file ' + outputFile)
    })
  })
  
}())
