var cheerio   = require('cheerio')

var log = function (msg) { console.log('PartyInfo: ' + msg) }

var PartyInfo = module.exports = function (party_xml, msg_id, trx_id, cmd_id) {

  if (!party_xml || !party_xml.length) return this // empty object for empty xml string

  var party = this // for uniform use with callbacks
  //console.log('starting party cheerio with xml: ' + party_xml)

  party.xml = party_xml

  var $ = cheerio.load(party_xml, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  party.created_ts  = Date.parse(($('creationDateTime').text()))
  party.update_ts   = Date.parse($('lastUpdateDateTime').text())
  party.modified_ts = Date.now()

  party.msg_id = msg_id
  party.trx_id = trx_id
  party.cmd_id = cmd_id
  party.doc_id = $('entityIdentification').text() // for both BPR and RPDD

  party.gln      = $('informationProviderOfParty > gln').text()
  party.source_dp= $('registeringParty').text()
  party.tm       = $('partyAddress > countryCode').text()
  party.city     = $('partyAddress > city').text()
  party.name     = $('partyAddress > name').text()
  party.zip      = $('partyAddress > postalCode').text()
  party.state    = $('partyAddress > state').text()
  party.address1 = $('partyAddress > streetAddressOne').text()
  party.address2 = $('partyAddress > streetAddressTwo').text()
  party.language = $('partyAddress > languageOfThePartyCode').text()
  party.role     = $('partyInRole > partyRoleCode').text()

  party.capability = $('processCapabilityCode').text()

  party.contact_name = $('personName').first().text()

  party.contact_email = $('communicationChannelCode:contains(EMAIL)').next().text()
  party.contact_phone = $('communicationChannelCode:contains(TELEPHONE)').next().text()

  log('derived party gln: ' + party.gln)
  return party
}
