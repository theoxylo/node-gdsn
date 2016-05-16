var cheerio   = require('cheerio')

var log = function (msg) { console.log('PublicationInfo: ' + msg) }

var PublicationInfo = module.exports = function (pub_xml, msg_id, trx_id, cmd_id) {

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
  this.doc_id = $('catalogueItemPublicationIdentification').text()
  
  this.initial_load = false // TODO support initial load still?
  this.deleted_ts = '' // TODO need argument for command ADD/DELETE?

  this.recipient = $('publishToGLN').text()

  this.gtin     = $('catalogueItemReference > gtin').text()
  this.provider = $('catalogueItemReference > dataSource').text()

  this.tm               = $('catalogueItemReference > targetMarket > targetMarketCountryCode > countryISOCode').text() // 2.8
  if (!this.tm) this.tm = $('catalogueItemReference >                targetMarketCountryCode').text()                  // 3.1

  this.tm_sub                   = $('catalogueItemReference > targetMarket > targetMarketSubdivisionCode > countrySubDivisionISOCode').text() // 2.8
  if (!this.tm_sub) this.tm_sub = $('catalogueItemReference >                targetMarketSubdivisionCode').text()                             // 3.1
  if (!this.tm_sub) this.tm_sub = 'na'

  console.log('new pub info: ' + JSON.stringify(this));

  return this
}
