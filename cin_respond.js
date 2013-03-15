(function () {
  
  var Gdsn = require('./index.js')
  
  var gdsn = new Gdsn({
    homeDataPoolGln: '1100001011285'
  })
  
  console.log(gdsn.getVersion())

  if (process.argv.length < 3) {
    console.log("usage: node cin_respond.js file1 file2 ...")
    process.exit(1)
  }

  var processFile = function(file) {

    console.log('file arg: ' + file)
    
    gdsn.readXmlFile(file, function(err, xml) {
      if (err) {
        console.log('Error: ' + err)
        process.exit(1)
      }
      var doc = gdsn.getDocForXml(xml)
      gdsn.createCinResponse(doc, function(err, responseXml) {
        var outputFile = file + '_response'
        gdsn.writeXmlFile(outputFile, responseXml, function(err, result) {
          if (err) {
            console.log('Error: ' + err)
            process.exit(1)
          }
          console.log('Created new CIN response file: ' + outputFile)
        })
      })
    })
  }

  while (process.argv.length > 2) {
    processFile(process.argv.pop())
  }
  
}())
