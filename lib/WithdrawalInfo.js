var cheerio   = require('cheerio')

var log = function (msg) { console.log('WithdrawalInfo: ' + msg) }

var WithdrawalInfo = module.exports = function (cihw_xml, msg_id, trx_id, cmd_id) {

  var cihw = this
  if (!cihw_xml || !cihw_xml.length) return cihw

  cihw.xml = cihw_xml

  console.log('cihw doc xml: ' + cihw.xml)

  var $ = cheerio.load(cihw.xml, {
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  cihw.msg_id = msg_id
  cihw.trx_id = trx_id
  cihw.cmd_id = cmd_id

  cihw.doc_id = $('catalogueItemHierarchicalWithdrawalIdentification').text()
  

  cihw.provider  = $('catalogueItemReference > dataSource'                 ).text()
  cihw.gtin      = $('catalogueItemReference > gtin'                       ).text()
  cihw.tm        = $('catalogueItemReference > targetMarketCountryCode'    ).text()
  cihw.tm_sub    = $('catalogueItemReference > targetMarketSubdivisionCode').text() || 'na'
  cihw.recipient = $('dataRecipient > gln'                                 ).text()
  cihw.source_dp = $('sourceDataPool > gln'                                ).text()

  cihw.reason    = $('hierarchyDeletionReasonCode'                         ).text() || 'MISC_WITHDRAWAL'

  console.log('+++++++++++++++++++++++++++++++++++++++ new cihw info: ' + JSON.stringify(cihw));

  return cihw
}
