var cheerio   = require('cheerio')

var log = function (msg) { console.log('RfcinInfo: ' + msg) }

var RfcinInfo = module.exports = function (rfcin_xml, msg_id, trx_id, cmd_id) {

  if (!rfcin_xml || !rfcin_xml.length) return this

  this.xml = rfcin_xml

  console.log('rfcin doc xml: ' + this.xml)

  var $ = cheerio.load(this.xml, {
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
    , decodeEntities: false
  })

  this.msg_id = msg_id
  this.trx_id = trx_id
  this.cmd_id = cmd_id

  this.doc_id = $('catalogueItemSubscriptionIdentification').text()
  
  this.recipient = $('dataRecipient').text() // required

  // optional subscription criteria, but at least one must be present:
  this.provider  = $('dataSource').text()      || ''
  this.gpc       = $('gpcCategoryCode').text() || ''
  this.gtin      = $('gtin').text()            || ''
  this.tm        = $('targetMarket > targetMarketCountryCode').text()    || ''

  // for rfcin only, not used by cis:
  this.reload =  $('isReload').text() // string

  // optional but nice to have!
  this.recipient_dp = $('recipientDataPool').text() || ''

  console.log('+++++++++++++++++++++++++++++++++++++++ new rfcin info: ' + JSON.stringify(this));

  return this
}
