// logic to parse all kinds of gdsn responses, both 2.8 and 3.1, ack, nack, etc

module.exports = parse_response = function ($, msg) {
  // RESPONSE message (includes PRR, CIRR, ACCEPTED, gS1Exception)
  // response/exception messages including PRR and CIRR
  // response/exception messages including PRR and CIRR

  if (msg.msg_type == 'gS1Response'                       // 3.1, includes gS1Exception
   || msg.msg_type == 'GDSNResponse'                      // 2.8, includes gDSNException and 2.8 CIRR from GR
   || msg.msg_type == 'partyRegistrationResponse'         // 2.8 and 3.1, PRR response to BPR
   || msg.msg_type == 'catalogueItemRegistrationResponse' // 3.1, CIRR response to RCI
  ) {

    // either it is an exception or a status reponse:
    // just capture all text for now
    var exception = $('gS1Exception').text() // 3.1
      || $('gDSNException').text()           // 2.8

    if (exception) {
      msg.status = 'ERROR'
      msg.exception = exception
    }
    else {
      msg.status = 'ACCEPTED' // always ACCEPTED if not an exception
      //if (!msg.status) msg.status = $('transactionResponse responseStatus')
      //if (!msg.status) msg.status = $('transactionResponse responseStatusCode')

      // 3.1 CIRR, catalogueItemRegistrationResponse, assuming single item at a time from GR
      if (msg.msg_type == 'catalogueItemRegistrationResponse') {
        msg.gtin     = $('catalogueItemReference > gtin').text()
        msg.provider = $('catalogueItemReference > dataSource').text()
        msg.tm       = $('catalogueItemReference > targetMarketCountryCode').text()
        msg.tm_sub   = $('catalogueItemReference > targetMarketSubdivisionCode').text() || 'na'
      }
      // basicPartyRegistrationResponse for party GLN
      else if (msg.msg_type == 'partyRegistrationResponse') {
        msg.provider = $('partyReference').text() // the party gln
      }
      // CIRR from GR, response to RCI or other misc response
      else if (msg.msg_type == 'GDSNResponse') {
        $('catalogueItemReference').each(function () { // 2.8 CIRR
          msg.gtin     = $('gtin', this).text()
          msg.provider = $('dataSource', this).text()
          msg.tm       = $('targetMarket > targetMarketCountryCode > countryISOCode', this).text()
          msg.tm_sub   = $('targetMarket > targetMarketSubdivisionCode > countrySubDivisionISOCode', this).text() || 'na'
        })
      }
    }
    msg.msg_type = 'GDSNResponse' // use older name for gS1Response, PRR, CIRR
    //console.dir(msg)
    return msg
  }
  else {
    //console.log('parse_response - non-response msg_type: ' + msg.msg_type)
  }
  return false
}
