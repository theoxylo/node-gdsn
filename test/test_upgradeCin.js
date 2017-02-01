var Gdsn = require('../index.js')
var fs   = require('fs')
var test = require('tap').test

test('cheerioCinInfoFromFile', function (t) {
  t.plan(1)

  var gdsn = new Gdsn({
    homeDataPoolGln: "1100001011285"
    , outbox_dir: __dirname + '/outbox'
  })

  var filename = __dirname + '/gdsn2/cin_from_other_dp.xml'

  fs.readFile(filename, 'utf8', function (err, content) {

    if (err) throw err

    var cleaned = gdsn.clean_xml(content)

    fs.writeFile('test_cleaned.xml', cleaned, function (err) {
      if (err) throw err
    })

    // parse 2.8 XML from other DP
    var msg_info = gdsn.get_msg_info(cleaned)


    // generate new 3.1 CIN XML for local DP subscriber
    var cin_xml = gdsn.create_cin(msg_info.data, // array of items
                                  msg_info.recipient, 
                                  'ADD' /*command*/, 
                                  false /*reload*/, 
                                  'ORIGINAL' /*docStatus*/, 
                                  gdsn.config.homeDataPoolGln /*sender*/)

    fs.writeFile('test_generated31.xml', cin_xml, function (err) {
      if (err) throw err
    })

    t.ok(true, msg_info)

    t.end()
  })

})
