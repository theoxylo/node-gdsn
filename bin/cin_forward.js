(function () {
  
  if (process.argv.length < 4) {
    console.log("usage: node cin_respond.js dataPoolGln file1 file2 ...")
    process.exit(1)
  }

  var dpGln = process.argv[2]
  if (!dpGln.length || dpGln.length !== 13) {
    console.log("Error: invalid home data pool GLN: " + dpGln)
    process.exit(1)
  }

  var Gdsn = require(__dirname + '/../index.js')
  var gdsn = new Gdsn({
    homeDataPoolGln: dpGln
  })
  
  var processFile = function(filename) {
    console.log('Processing inbound CIN file: ' + filename)
    gdsn.getXmlDomForFile(filename, function(err, $cin) {
      if (err) {
        console.log("Error: " + err.message)
        process.exit(1)
      }
      gdsn.forwardCinFromOtherDP($cin, function(err, forwardXml) {
        if (err) {
          console.log("Error: " + err.message)
          process.exit(1)
        }
        gdsn.writeFile(filename + "_forward", forwardXml, function(err) {
          if (err) {
            console.log("Error: " + err.message)
            process.exit(1)
          }
        })
      })
    })
  }

  while (process.argv.length > 3) {
    processFile(process.argv.pop())
  }
  
}())
