var cheerio     = require('cheerio')
var xml_utils   = require('./lib/xml_utils')
var ItemStream  = require('./lib/ItemStream')
var PartyStream = require('./lib/PartyStream')

var log = console.log

module.exports = Gdsn = function (config) {

  if (!(this instanceof Gdsn)) return new Gdsn(config)

  config = config || {clean_newline: true}
  if (!config.templatePath)    config.templatePath    = __dirname + '/templates'
  if (!config.homeDataPoolGln) config.homeDataPoolGln = '0000000000000'
  if (!config.outbox_dir)      config.outbox_dir      = config.out_dir || __dirname + '/outbox'

  if (!this.validateGln(config.homeDataPoolGln)) {
    log('Error: invalid home data pool GLN: ' + config.homeDataPoolGln)
    process.exit(1)
  }

  this.config = config
  config.gdsn = this

  this.dom = require('./lib/xpath_dom.js')

  this.itemStream = new ItemStream(this)
  this.partyStream = new PartyStream(this)
}

Gdsn.prototype.getTradeItemInfo = function (xml, msg_info) {
  return this.dom.getTradeItemInfo(xml, msg_info)
}

Gdsn.prototype.getEachTradeItemFromStream = function (req, cb) {
  this.itemStream.getEachTradeItem(req, cb)
}

Gdsn.prototype.getPartyInfo = function (xml, msg_info) {
  return this.dom.getPartyInfo(xml, msg_info)
}

Gdsn.prototype.getEachPartyFromStream = function (req, cb) {
  this.partyStream.getEachParty(req, cb)
}

Gdsn.prototype.validateGln = function (gln) {
  if (!gln || gln.length != 13) return false

  var digits = gln.split('')
  var numbers = new Array(13)
  for (var idx = 0; idx < 13; idx++) {
    numbers[idx] = Number(digits[idx])
  }

  var sum1 = numbers[0] + numbers[2] + numbers[4] + numbers[6] + numbers[8] + numbers[10]
  var sum2 = numbers[1] + numbers[3] + numbers[5] + numbers[7] + numbers[9] + numbers[11]

  var checkDigit = ((sum2 * 3) + sum1) % 10

  if (checkDigit) {
      checkDigit = 10 - checkDigit
  }
  return checkDigit == numbers[12]
}

Gdsn.prototype.validateGtin = function (gtin) {
  if (!gtin || gtin.length != 14) return false

  var digits = gtin.split('')
  var numbers = new Array(14)
  for (var idx = 0; idx < 14; idx++) {
    numbers[idx] = Number(digits[idx])
  }

  var sum1 = numbers[0] + numbers[2] + numbers[4] + numbers[6] + numbers[8] + numbers[10] + numbers[12]
  var sum2 = numbers[1] + numbers[3] + numbers[5] + numbers[7] + numbers[9] + numbers[11]

  var checkDigit = ((sum1 * 3) + sum2) % 10

  if (checkDigit) {
      checkDigit = 10 - checkDigit
  }
  return checkDigit == numbers[13]
}


//// new cheerio dom approach, like jquery ////
// compare: 
// cheerio: var type = $('DocumentIdentification Type').text()
// xpath:   var type = this.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="Type"]')
// however, the cheerio version must not have namespace prefixes! so we use the clean_xml util first

Gdsn.prototype.msg_string_to_msg_info = function(xml, cb) {
  log('gdsn msg_string_to_msg_info called with xml length ' + xml.length)
  var self = this
  setImmediate(function () {
    try {
      var msg_info = xml_utils.get_message_info(xml, this.config)
      log('msg_info msg_id   : ' + msg_info.msg_id)
      log('msg_info version  : ' + msg_info.version)
      log('msg_info type     : ' + msg_info.msg_type)
      log('msg_info status   : ' + msg_info.status)
      log('msg_info sender   : ' + msg_info.sender)
      log('msg_info receiver : ' + msg_info.receiver)
      log('msg_info provider : ' + msg_info.provider)
      log('msg_info recipient: ' + msg_info.recipient)
      log('msg_info xml size : ' + (msg_info.xml && msg_info.xml.length))
      log('msg_info parties  : ' + (msg_info.parties && msg_info.parties.join(' ')))
      log('msg_info gtins    : ' + (msg_info.gtins && msg_info.gtins.join(' ')))


/*
      if (msg_info.msg_type == 'catalogueItemNotification') {

        if (!msg_info.source_dp) msg_info.source_dp = this.config.homeDataPoolGln

        // there are 4 subtypes of CIN, 2 _from_ homde DP...
        if (msg_info.sender == this.config.homeDataPoolGln) { // from home DP
          if (msg_info.receiver == msg_info.recipient) {
            console.log('>>> subscribed item forwarded from home DP to local TP')
          }
          else {
            console.log('>>> subscribed item forwarded from home DP to other DP for remote TP')
          }
        }
        // ...and 2 more _to_ home DP, these are repostable to DP
        else if (msg_info.receiver == this.config.homeDataPoolGln) { // to home DP
          if (msg_info.sender == msg_info.provider) { // from local TP
            if (msg_info.provider == msg_info.recipient) { // 3. from TP (private draft item)
              console.log('>>> private draft item from local TP')
            }
            else if (this.config.homeDataPoolGln == msg_info.recipient) {
              console.log('>>> item registration/update attempt from local TP')
            }
          }
          else { // from other dp
            console.log('>>> subscribed item received from other DP for local TP')
          }
        }
      } // end CIN inspection
      */

      cb(null, msg_info)
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.item_string_to_item_info = function(xml, cb) {
  log('gdsn item_string_to_item_info called with raw xml length ' + xml.length)
  var self = this
  setImmediate(function () {
    try {
      var item_info = xml_utils.get_item_info(xml)

      log('new item_info msg_id: ' + item_info.msg_id)

      /*
      var home_dp = self.config.homeDataPoolGln

      if (item_info.sender == home_dp) { // from home DP
        if (item_info.receiver == item_info.recipient) {
          log('>>> subscribed item forwarded from home DP to local TP')
        }
        else {
          log('>>> subscribed item forwarded from home DP to other DP for remote TP')
        }
      }
      // ...and 2 more _to_ home DP, these are repostable to DP
      else if (item_info.receiver == home_dp) { // to home DP
        if (item_info.sender == item_info.provider) { // from local TP
          if (item_info.provider == item_info.recipient) { // 3. from TP (private draft item)
            log('>>> private draft item from local TP')
          }
          else if (home_dp == item_info.recipient) {
            log('>>> item registration/update attempt from local TP')
          }
        }
        else { // from other dp
          log('>>> subscribed item received from other DP for local TP')
        }
      }
      */

      cb(null, item_info)
    }
    catch (err) {
      cb(err)
    }
  })
}

Gdsn.prototype.party_string_to_party_info = function(xml, msg_info) {
  log('party_string_to_party_info called with xml length ' + xml.length)
  var trimmed_xml   = xml_utils.trim(xml)
  var clean_xml     = xml_utils.clean(trimmed_xml)
  var party_info    = new PartyInfo(clean_xml, this.config)
  party_info.xml    = trimmed_xml
  party_info.msg_id = msg_info.msg_id
  return party_info
}

