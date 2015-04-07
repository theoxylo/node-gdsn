var fs            = require('fs')
var _             = require('underscore')
var cheerio       = require('cheerio')
var ItemStream    = require('./lib/ItemStream.js')
var PartyStream   = require('./lib/PartyStream.js')
var TradeItemInfo = require('./lib/TradeItemInfo.js')
var MessageInfo   = require('./lib/MessageInfo.js')
var PartyInfo     = require('./lib/PartyInfo.js')
var xpath_dom     = require('./lib/xpath_dom.js')

var log = console.log

var Gdsn = module.exports = function (config) {

  if (!(this instanceof Gdsn)) return new Gdsn(config)

  config = config || {clean_newline: true}
  log = config.log || log // config arg may have its own version of log
  if (!config.templatePath)    config.templatePath    = __dirname + '/templates'
  if (!config.homeDataPoolGln) config.homeDataPoolGln = '0000000000000'
  if (!config.outbox_dir)      config.outbox_dir      = config.out_dir || __dirname + '/outbox'

  if (!Gdsn.validateGln(config.homeDataPoolGln)) {
    log('Error: invalid home data pool GLN: ' + config.homeDataPoolGln)
    process.exit(1)
  }

  // pre-load xml message templates
  this.loadTemplatesSync(config.templatePath)

  this.config = config
  config.gdsn = this

  this.dom = xpath_dom

  this.itemStream = new ItemStream(this)
  this.partyStream = new PartyStream(this)
}

// stream extract methods

Gdsn.prototype.getEachTradeItemFromStream = function (is, cb) {
  this.itemStream.getEachTradeItem(is, cb)
}

Gdsn.prototype.getEachPartyFromStream = function (is, cb) {
  this.partyStream.getEachParty(is, cb)
}

// legacy dom approach for extracting item and party info:

Gdsn.prototype.getTradeItemInfo = function (xml, msg_info) {
  return this.dom.getTradeItemInfo(xml, msg_info) // <tradeItem/>
}

Gdsn.prototype.getPartyInfo = function (xml, msg_info) {
  return this.dom.getPartyInfo(xml, msg_info) // <party/>
}

///////////////////////// utilities:

Gdsn.validateGln = Gdsn.prototype.validateGln = function (gln) {
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

Gdsn.validateGtin = Gdsn.prototype.validateGtin = function (gtin) {
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
  log('gtin check-digit: ' + checkDigit)
  return checkDigit == numbers[13]
}


//// new cheerio dom approach, like jquery ////
// compare: 
// cheerio: var type = $('DocumentIdentification Type').text()
// xpath:   var type = this.getNodeData($msg, '//*[local-name()="DocumentIdentification"]/*[local-name()="Type"]')
// however, the cheerio version must not have namespace prefixes! so we clean the xml first

Gdsn.prototype.log_msg_info = function (msg_info) {
  log('msg_info msg_id   : ' + msg_info.msg_id)
  log('msg_info version  : ' + msg_info.version)
  log('msg_info type     : ' + msg_info.msg_type)
  log('msg_info note     : ' + msg_info.note)
  log('msg_info status   : ' + msg_info.status)
  log('msg_info sender   : ' + msg_info.sender)
  log('msg_info receiver : ' + msg_info.receiver)
  log('msg_info provider : ' + msg_info.provider)
  log('msg_info recipient: ' + msg_info.recipient)
  log('msg_info xml size : ' + msg_info.xml.length)
  log('msg_info party cnt: ' + msg_info.party.length)
  log('msg_info item cnt : ' + msg_info.item.length)
  log('msg_info pub count: ' + msg_info.pub.length)
  log('msg_info sub count: ' + msg_info.sub.length)
  log('msg_info gtin     : ' + msg_info.gtin)
  log('msg_info gtins    : ' + msg_info.gtins.join(' '))
  log('msg_info doc_count: ' + msg_info.doc_count)
  log('msg_info trx      : ' + msg_info.trx.join(','))
}

Gdsn.prototype.get_msg_info = function (xml) {
  log('gdsn get_msg_info called with xml length ' + xml.length)
  // synchronous parse of gdsn 2.8 or 3.1 xml for priority data
  return new MessageInfo(Gdsn.trim_xml(xml), this.config) 
}

Gdsn.prototype.get_party_info = function (xml, msg_info) {
  return new PartyInfo(Gdsn.trim_xml(xml), msg_info)
}

Gdsn.prototype.loadTemplatesSync = function (path) {
  this.templates = {}
  this.templates.response  = fs.readFileSync(path + '/gdsn3/GS1Response.xml')
  this.templates.bpr_to_gr = fs.readFileSync(path + '/gdsn3/BPR.xml')
  this.templates.cis_to_gr = fs.readFileSync(path + '/gdsn3/CIS.xml')
  this.templates.rci_to_gr = fs.readFileSync(path + '/gdsn3/RCI.xml')
  this.templates.cin_out   = fs.readFileSync(path + '/gdsn3/CIN.xml')
  log('All gdsn templates read without errors')
}

// note that the req_msg_info argument is for the message we are responding to!
// after we generate the response XML, it can have its own req_msg_info instance
Gdsn.prototype.populateResponseToSender = function (config, req_msg_info) {
  var $ = cheerio.load(this.templates.response, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })
  var resp_id = 'RESP_' + req_msg_info.msg_id // only as unique as the original msg id to handle resubmits with history

  if (config.homeDataPoolGln != req_msg_info.receiver) throw Error('********** WARN: responding to non-DP message: ' + req_msg_info)

  $('sh\\:Sender   > sh\\:Identifier').text(req_msg_info.receiver)
  $('sh\\:Receiver > sh\\:Identifier').text(req_msg_info.sender)
  $('sh\\:DocumentIdentification > sh\\:InstanceIdentifier').text(resp_id)
  $('sh\\:DocumentIdentification > sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)

  $('sh\\:Scope > sh\\:InstanceIdentifier').text(resp_id)
  $('sh\\:Scope > sh\\:CorrelationInformation > sh\\:RequestingDocumentCreationDateTime').text((new Date(req_msg_info.created_ts || 1)).toISOString())
  $('sh\\:Scope > sh\\:CorrelationInformation > sh\\:RequestingDocumentInstanceIdentifier').text(req_msg_info.msg_id)


  $('gS1Response > originatingMessageIdentifier > entityIdentification').text(req_msg_info.msg_id)
  $('gS1Response > receiver').text(req_msg_info.receiver) // original receiver, sender of this reponse, should aways be dp
  $('gS1Response > sender')  .text(req_msg_info.sender)   // original sender, receiver of this response, should be local TP, GR, or other DP

  // remove trx success/error and start with message exception
  var $trx_resp = $('gS1Response > transactionResponse').remove()

  if (req_msg_info.status == 'ERROR' || !req_msg_info.trx || !req_msg_info.trx.length) { // populate simple message exception response
    $('messageException > gS1Error > errorDateTime').text(new Date().toISOString())
    $('messageException > gS1Error > errorDescription').text(req_msg_info.exception || 'generic exception')
    $('transactionResponse, transactionException').remove() // remove unused transaction level response/exception template nodes
  }
  else {
    $('gS1Response > gS1Exception').remove()                        // remove unused exception template
    req_msg_info.trx.forEach(function (trx_id) {                        // to generate list of transactionResponse elements
      var $trx = $trx_resp.clone()
      $('transactionIdentifier > entityIdentification', $trx).text(trx_id)
      $('gS1Response').append($trx)
    })
  }

  $('contentOwner > gln').text(req_msg_info.receiver) // the response is owned by the original msg receiver

  return $.html()
}


// the original BPR must be sent by the trading party to their own data pool, 
// then a BPR to GR is generated. Only one party per message is supported.
Gdsn.prototype.populateBprToGr = function (config, tp_msg_info) {

  log('populateBprToGr from party bpr with msg_id: ' + tp_msg_info)
  var $ = cheerio.load(this.templates.bpr_to_gr, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // instance ID, note that GR requires a unique message ID each time
  // so something like 'BPR_to_GR_1425055673689_1100001011292_ADD'
  var msg_id = 'BPR_' + Date.now() + '_' + tp_msg_info.sender + '_' + tp_msg_info.status

  $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
  $('sh\\:Receiver > sh\\:Identifier').text(config.gdsn_gr_gln)
  $('sh\\:InstanceIdentifier').text(msg_id)
  $('sh\\:CreationDateAndTime, creationDateTime, lastUpdateDateTime, processCapabilityEffectiveStartDateTime')
   .text(new Date().toISOString()) // when this message is created by DP (right now)

  // all 3 entity ids will have the same owner, also used as data pool
  $('partyDataPool, transmittingDataPool, registeringParty').text(config.homeDataPoolGln) // the data pool
  $('transactionIdentification > entityIdentification').text(msg_id + '_trx1')
  $('documentCommandIdentification > entityIdentification').text(msg_id + '_trx1_cmd1')
  $('basicPartyRegistrationIdentification > entityIdentification').text(msg_id + '_trx1_cmd1_doc1')

  if (tp_msg_info.status != 'ADD') {
    $('documentCommand > documentCommandHeader').attr('type', tp_msg_info.status)
  }

  var party = tp_msg_info.party[0]

  if (party) {
    $('informationProviderOfParty > gln').text(party.gln)
    $('partyInRole > partyName')        .text(party.name)
    $('partyInRole > partyRoleCode')    .text(party.role)

    $('partyAddress > city')            .text(party.city)
    $('partyAddress > countryCode')     .text(party.tm)
    $('partyAddress > name')            .text(party.name)
    $('partyAddress > postalCode')      .text(party.zip)
    $('partyAddress > state')           .text(party.state)
    $('partyAddress > streetAddressOne').text(party.address1)
    $('partyAddress > streetAddressTwo').text(party.address2)

    if (party.contact_name) {
      $('partyContact > personName').text(party.contact_name)

      if (party.contact_email) $('partyContact > communicationChannel > communicationChannelCode:contains(EMAIL)').next().text(party.contact_email)
      else $('communicationChannelCode:contains(EMAIL)').parent().remove()

      if (party.contact_telephone) $('partyContact > communicationChannel > communicationChannelCode:contains(TELEPHONE)').next().text(party.contact_telephone)
      else $('communicationChannelCode:contains(TELEPHONE)').parent().remove()
    }
    else $('partyContact > personName').remove()
  }

  $('contentOwner > gln').text(config.homeDataPoolGln) // works with current GR

  return $.html()
}

Gdsn.prototype.populateCisToGr= function (config, tp_msg_info) {
    log('populateCisToGr')
    var $ = cheerio.load(this.templates.cis_to_gr, { 
      _:0
      , normalizeWhitespace: true
      , xmlMode: true
    })

    // SINGLE doc support:
    var sub_info = tp_msg_info.sub && tp_msg_info.sub[0]
    if (!sub_info) return ''

    // new values for this message
    var msg_id = 'CIS_to_GR_' + Date.now() + '_' + sub_info.recipient


    $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
    $('sh\\:Receiver > sh\\:Identifier').text(config.gdsn_gr_gln)
    $('sh\\:InstanceIdentifier').text(msg_id)

    $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)

    // original values from tp: trx/cmd/doc id and owner glns, created ts
    // assume naming convention based on original msg_id and only support single doc
    $('transactionIdentification > entityIdentification').text(msg_id + '_trx1')

    $('documentCommandIdentification > entityIdentification').text(msg_id + '_trx1_cmd1')

    $('documentCommand > documentCommandHeader').attr('type', tp_msg_info.status) // set // ADD, DELETE

    $('creationDateTime').text(new Date(tp_msg_info.created_ts || Date.now()).toISOString()) // use create date from original CIS from tp
    $('catalogueItemSubscriptionIdentification > entityIdentification').text(msg_id + '_trx1_cmd1_doc1')
    $('dataRecipient').text(sub_info.recipient)

    //optional subscription criteria:
    if (sub_info.provider) $('dataSource').text(sub_info.provider)
    else $('dataSource').remove()

    if (sub_info.gpc) $('gpcCategoryCode').text(sub_info.gpc)
    else $('gpcCategoryCode').remove()

    if (sub_info.gtin) $('gtin').text(sub_info.gtin)
    else $('gtin').remove()

    if (sub_info.tm) $('targetMarketCountryCode').text(sub_info.tm)
    else $('targetMarket').remove()

    if (sub_info.recipient_dp) $('recipientDataPool').text(sub_info.recipient_dp)
    else $('recipientDataPool').remove()

    $('contentOwner > gln').text(tp_msg_info.recipient)

    return $.html()
}

Gdsn.prototype.populateRciToGr = function (config, msg_info) {
  log('populateRciToGr')

  if (msg_info.msg_type != 'catalogueItemNotification'
    || msg_info.sender != msg_info.provider) 
      return 'rci can only be generated from local tp cin message, for now'

  var $ = cheerio.load(this.templates.rci_to_gr, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // new values for this message
  $('sh\\:Sender > sh\\:Identifier').text(config.homeDataPoolGln)
  $('sh\\:Receiver > sh\\:Identifier').text(config.gdsn_gr_gln)
  // GR requires unique msg id, so use ts
  var new_msg_id = 'RCI_' + Date.now() + '_' + msg_info.provider + '_' + msg_info.gtin + '_' + msg_info.tm
  if (msg_info.tm_sub && msg_info.tm_sub != 'na') new_msg_id += '_' + msg_info.tm_sub
  $('sh\\:InstanceIdentifier').text(new_msg_id)
  $('sh\\:CreationDateAndTime').text(new Date().toISOString()) // when this message is created by DP (right now)


  // new message values for dp: trx/cmd/doc id and owner glns, created ts
  // assume naming convention based on new_msg_id and only support single doc
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_trx1')
  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1')
  $('documentCommand > documentCommandHeader').attr('type', msg_info.status) // set // ADD, DELETE

  // SINGLE doc support:
  $('creationDateTime').text(new Date(msg_info.created_ts || 1).toISOString())
  $('registryCatalogueItemIdentification > entityIdentification').text(new_msg_id + '_trx1_cmd1_doc1')

  $('gpcCategoryCode').text(msg_info.gpc)
  $('sourceDataPool').text(config.homeDataPoolGln)

  $('catalogueItemReference > dataSource').text(msg_info.provider)
  $('catalogueItemReference > gtin').text(msg_info.gtin)
  $('catalogueItemReference > targetMarketCountryCode').text(msg_info.tm)

  if (msg_info.tm_sub && msg_info.tm_sub != 'na') $('catalogueItemReference > targetMarket > targetMarketSubdivisionCode').text(msg_info.tm_sub)
  else $('catalogueItemReference > targetMarket > targetMarketSubdivisionCode').remove()

  $('catalogueItemDates > lastChangedDateTime').text(new Date().toISOString())
  $('catalogueItemDates > registrationDateTime').text(new Date().toISOString())

  $('contentOwner > gln').text(msg_info.provider)

  return $.html()
}

// generate catalogueItem hierarchy:
// 1. catalogueItem element
// 2. add tradeItem using item.xml
// 3. add a catalogueItemChildItemLink for each child with catalogueItem, repeat!
/* 
  $ci:
    <catalogueItem> // for each trade item create a catalog item
      <dataRecipient>recipient</dataRecipient> // subscriber, could be local or on some other dp
      <sourceDataPool>sender</sourceDataPool>
      <catalogueItemState> <catalogueItemStateCode>REGISTERED</catalogueItemStateCode> </catalogueItemState>
      <!--tradeItem-->
      <!--catalogueItemChildItemLink-->
    </catalogueItem>
    
  $link:
      <catalogueItemChildItemLink>
          <quantity>TOKEN</quantity>
          <!--catalogueItem-->
      </catalogueItemChildItemLink>
      
  Now we must adjust the above structure based on each trade item child info:
    <nextLowerLevelTradeItemInformation>
        <quantityOfChildren>2</quantityOfChildren>
        <totalQuantityOfNextLowerLevelTradeItem>22</totalQuantityOfNextLowerLevelTradeItem>
        <childTradeItem>
            <gtin>00018627703396</gtin>
            <quantityOfNextLowerLevelTradeItem>8</quantityOfNextLowerLevelTradeItem>
        </childTradeItem>
        <childTradeItem>
            <gtin>00018627703389</gtin>
            <quantityOfNextLowerLevelTradeItem>14</quantityOfNextLowerLevelTradeItem>
        </childTradeItem>
    </nextLowerLevelTradeItemInformation>
*/
Gdsn.prototype.create_cin = function (trade_items, receiver, command, reload, docStatus) {
  
  log('create_cin')
  if (!trade_items || !trade_items.length) return ''
  
  var ti = trade_items[0]
  
  var sender    = this.config.homeDataPoolGln
  var provider  = ti.provider
  var recipient = ti.recipient
  var new_msg_id = 'CIN_' + recipient + '_' + provider + '_' + ti.gtin + '_' + ti.tm + '_' + ti.tm_sub || 'na' // maxlength 80
  var dateTime = new Date().toISOString()

  var $ = cheerio.load(this.templates.cin_out, { 
    _:0
    , normalizeWhitespace: true
    , xmlMode: true
  })

  // new values for this message
  $('sh\\:Sender > sh\\:Identifier').text(sender)
  $('sh\\:Receiver > sh\\:Identifier').text(receiver)

  $('sh\\:InstanceIdentifier').text(new_msg_id)
  $('sh\\:CreationDateAndTime').text(dateTime)


  // new message values for dp: trx/cmd/doc id and owner glns, created ts
  // assume naming convention based on new_msg_id and only support single doc
  $('transactionIdentification > entityIdentification').text(new_msg_id + '_t1')
  $('documentCommand > documentCommandHeader').attr('type', command || 'ADD') // e.g ADD/CORRECT/etc
  $('documentCommandIdentification > entityIdentification').text(new_msg_id + '_t1_c1')
  $('catalogueItemNotificationIdentification > entityIdentification').text(new_msg_id + '_t1_c1_d1')

  $('creationDateTime').text(dateTime)
  $('documentStatusCode').text(docStatus || 'ORIGINAL')
  $('isReload').text(Boolean(reload == 'true').toString())
  
  var $ci       = $('catalogueItem')
  //var $position = $($ci[0].parent)
  var $link     = $('catalogueItemChildItemLink', $ci).remove()
  $('dataRecipient', $ci).text(recipient)
  $('sourceDataPool', $ci).text(sender)
  
  // for easy access to items by gtin
  // save each gtin as an index to its xml
  var item_xmls = {} 
  trade_items.forEach(function (item) {
    item_xmls[item.gtin] = item.xml || ('<tradeItem><gtin>' + item.gtin + '</gtin></tradeItem>')
  })

  function create_catalog_item(gtin) {
    log('creating new catalog item with gtin: ' + gtin)
    var $new_ci = $ci.clone()
    $new_ci.append(item_xmls[gtin])
    $('childTradeItem', $new_ci).each (function (idx, child) {
      var child_gtin = $('gtin', child).text()
      log('found child gtin: ' + child_gtin)
      var quantity = $('quantityOfNextLowerLevelTradeItem', child).text()
      log('found child quantity: ' + quantity)
      var $new_link = $link.clone()
      $('quantity', $new_link).text(quantity)
      $new_link.append(create_catalog_item(child_gtin))
      $new_ci.append($new_link)
    })
    return $new_ci.toString()
  }
  $ci.replaceWith(create_catalog_item(ti.gtin))

  $('contentOwner > gln').text(provider)

  return $.html()
}

Gdsn.prototype.populateCicToTp = function (config, msg_info) {
  return null // TODO coming soon
}

// removes extra whitespace between tags, but adds a new line for easy diff later
Gdsn.prototype.trim_xml = Gdsn.trim_xml = function (xml) {
  // match xml chunk, trim leading and trailing non-XML (e.g. multipart boundries)
  var match = xml.match(/<[^]*>/) 
  var result = match && match[0]
  if (!result || !result.length) return ''
  result = result.replace(/>\s*</g, '><') // remove extra whitespace between tags
  result = result.replace(/></g, '>\n<')  // add line return between tags
  return result
}

// removes all namespace information
Gdsn.prototype.clean_xml = Gdsn.clean_xml = function (xml) {
  if (!xml || !xml.length) return ''
  xml = xml.replace(/<[^\/>][-_a-zA-Z0-9]*[^:>]:/g, '<')                   // remove open tag ns prefix <abc:tag>
  xml = xml.replace(/<\/[^>][-_a-zA-Z0-9]*[^:>]:/g, '<\/')                 // remove close tag ns prefix </abc:tag>
  xml = xml.replace(/\s*xmlns:[^=\s]*\s*=\s*['"][^'"]*['"]/g, '')          // remove xmlns:abc="123" ns attributes
  xml = xml.replace(/\s*[^:\s]*:schemaLocation\s*=\s*['"][^'"]*['"]/g, '') // remove abc:schemaLocation attributes
  return xml
}
