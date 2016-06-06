// sample XML: <catalogue_item_hierarchical_withdrawal:catalogueItemHierarchicalWithdrawal> <creationDateTime>2016-06-04T05:31:16</creationDateTime> <documentStatusCode>ORIGINAL</documentStatusCode> <catalogueItemHierarchicalWithdrawalIdentification> <entityIdentification>cih.LG64A3116000107.0000.0024105000017.90024105925009.US.Delete</entityIdentification> <contentOwner> <gln>0024105000017</gln></contentOwner></catalogueItemHierarchicalWithdrawalIdentification> <hierarchyDeletionReasonCode>PUBLICATION_WITHDRAWAL</hierarchyDeletionReasonCode> <catalogueItemReference> <dataSource>0024105000017</dataSource> <gtin>90024105925009</gtin> <targetMarketCountryCode>840</targetMarketCountryCode></catalogueItemReference> <dataRecipient> <gln>0074865000000</gln></dataRecipient></catalogue_item_hierarchical_withdrawal:catalogueItemHierarchicalWithdrawal>

var cheerio   = require('cheerio')

var log = function (msg) { console.log('WithdrawalInfo: ' + msg) }

var WithdrawalInfo = module.exports = function (cihw_xml, msg_id, trx_id, cmd_id) {

  var cihw = this
  if (!cihw_xml || !cihw_xml.length) return cihw

  cihw.xml = cihw_xml

  //console.log('cihw doc xml: ' + cihw.xml) 
  

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
  cihw.source_dp = $('sourceDataPool > gln'                                ).text() // optional, may need to be infered in MsgInfo

  cihw.reason    = $('hierarchyDeletionReasonCode'                         ).text() || 'MISC_WITHDRAWAL'

  //console.log('+++++++++++++++++++++++++++++++++++++++ new cihw info: ' + JSON.stringify(cihw));

  return cihw
}
