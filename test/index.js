(function () {

  var GdsnX = require(__dirname + '/../index.js')

  //////////////////////////////////////////////////////////////////

  var data_pool = new GdsnX({
    homeDataPoolGln: '1100001011285'
    , out_dir        : __dirname
    , templatePath   : __dirname + '/../templates/'
  })
  data_pool.processCinFromOtherDp(__dirname + '/cin_from_other_dp.xml')

  //////////////////////////////////////////////////////////////////

  var gln = '1100001011292'
  var isValid = GdsnX.validateGln(gln) // return [true|false]
  console.log('GLN ' + gln + ' is ' + (isValid ? 'valid' : 'invalid'))

  //////////////////////////////////////////////////////////////////

  var gtin = '00749384988152'
  var isValid = GdsnX.validateGtin(gtin) // return [true|false]
  console.log('GTIN ' + gtin + ' is ' + (isValid ? 'valid' : 'invalid'))

  //////////////////////////////////////////////////////////////////

  GdsnX.getTradeItemsFromFile(__dirname + '/cin_from_other_dp.xml', function(err, items) {
    if (err) throw err
    for (i in items) {
      var item = items[i]
      console.log('Found item with GTIN ' + item.gtin + ', extracted from message ' + item.msg_id)
    }
    console.log('item count: ' + items.length)
  })


}())
