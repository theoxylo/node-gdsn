var cheerio   = require('cheerio')

var log = function (msg) { console.log('SubscriptionInfo: ' + msg) }

var SubscriptionInfo = module.exports = function (pub_xml, msg_id, trx_id, cmd_id) {

  if (!pub_xml || !pub_xml.length) return this

  this.xml = pub_xml

  console.log('cip doc xml: ' + this.xml)

  var $ = cheerio.load(this.xml, {
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  this.msg_id = msg_id
  this.trx_id = trx_id
  this.cmd_id = cmd_id

  this.doc_id = $('catalogueItemSubscriptionIdentification').text()
  
  this.recipient = $('dataRecipient').text()
  this.provider  = $('dataSource').text()
  this.gtin      = $('gtin').text()
  this.gpc       = $('gpcCategoryCode').text()

  console.log('new sub info: ' + JSON.stringify(this));

  return this
}
