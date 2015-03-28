// Introduction to GDSN Messaging
//
// In each GDSN xml message file, there is a single "message" element (namespace eanucc="urn:ean.ucc:2")
// which contains a mandatory "entityIdentification" element and some number of "any" elements.
//
// The "type" of the xml message document tells us what kind of "any" elements to expect,
// and is specified by the following required header element: DocumentIdentification.Type
// (or StandardBusinessDocument.StandardBusinessDocumentHeader.DocumentIdentification.Type)
//
// Here is the list of message types we are concerned with:
//
//  1. basicPartyRegistration
//  2. catalogueItemRegistration
//  3. catalogueItemPublication
//  4. catalogueItemSubscription
//  5. catalogueItemNotification
//  6. catalogueItemConfirmation
//  7. requestForCatalogueItemNotification
//  8. registryPartyDataDump
//  9. gS1Response (includes partyRegistrationResponse and catalogueItemRegistrationResponse, transactionResponse (ACCEPTED), and gS1Exception)
//
// The first 8 types are straightforward: the message may contain several transaction/command/documentCommand structures,
// each containing:
//
//  1. documentCommandHeader@type (e.g. ADD, CHANGE_BY_REFRESH, CORRECT, DELETE)
//     *. value should be the same throughout the message if present multiple times
//
//  2. documentCommandOperand containing some number of "document" instances of the msg type
//     *. document subtype should be the same throughout the message if multiple instances present
//
// For the last type in the list (gS1Response), there are 4 subtypes (3 accepted and 1 exception), 
// all are potentially multiple but should not be mixed in the same message:
//
//   1. partyRegistrationResponse (GR response to DP BPR)
//      *. msg_info.status == "ACCEPTED"
//      *. responseIdentification.uniqueCreatorIdentification (DOC level from orig BPR)
//      *. partyRegistrationInformation.lastChangedDate
//      *. partyRegistrationInformation.registrationDate
//      *. partyRegistrationInformation.removedDate (optional)
//      *. partyReference (GLN of modified party)
//      *. msg_info.sender = config.gln_gdsn_gr
//
//   2. catalogueItemRegistrationResponse (GR response to DP CIR)
//      *. msg_info.status == "ACCEPTED"
//      *. responseIdentification.uniqueCreatorIdentification (DOC level from orig msg)
//      *. catalogueItemRegistrationInformation @lastChangedDate @registrationDate
//      *. catalogueItemReference
//         .gtin
//         .dataSource (provider GLN)
//         .targetMarket.targetMarketCountryCode.countryISOCode (e.g. 840)
//         .targetMarket.targetMarketSubdivisionCode.countrySubDivisionISOCode (e.g. US-CA)
//
//   3. gS1Response > transactionResponse (generic DP response to CIP, CIS, CIN, CIC, RFCIN, BPR)
//      *. msg_info.status == "ACCEPTED"
//      *. msg_info.transactions == $('transactionResponse > transactionIdentifier > entityIdentification', gS1Response)
//
//   4. gS1Response > gS1Exception: - some number of "gS1Error" and other elements:
//      *. > messageException
//      *. > transactionException > commandException > documentExcecption > attributeException
//        each with optional gS1Error list:
//        *. > gS1Error > errorCode
//        *. > gS1Error > errorDateTime
//        *. > gS1Error > errorDescription
//

module.exports = messageTypes = {
   bpr     : _.find(templates, function () { arguments[0]['name'] == 'bpr'})
  ,cir     : _.find(templates, function () { arguments[0]['name'] == 'cir'})
  ,cip     : _.find(templates, function () { arguments[0]['name'] == 'cip'})
  ,cis     : _.find(templates, function () { arguments[0]['name'] == 'cis'})
  ,cin     : _.find(templates, function () { arguments[0]['name'] == 'cin'})
  ,cic     : _.find(templates, function () { arguments[0]['name'] == 'cic'})
  ,rfcin   : _.find(templates, function () { arguments[0]['name'] == 'rfcin'})
  ,rpdd    : _.find(templates, function () { arguments[0]['name'] == 'rpdd'})
  ,hier    : _.find(templates, function () { arguments[0]['name'] == 'hier'})
  ,error   : _.find(templates, function () { arguments[0]['name'] == 'error'})
  ,accepted: _.find(templates, function () { arguments[0]['name'] == 'accepted'})
}

messageTypes.msg_info = function (msg_type_code) {
    return this[msg_type_code]
}


var templates = [
{ name: 'bpr'
    , msg_type: 'basicPartyRegistration'
    , status  : ['ADD', 'CORRECT', 'CHANGE_BY_REFRESH', 'DELETE']
},

{ name: 'cir'
    , msg_type: 'catalogueItemRegistration'
    , gtin:
    , provider:
    , tm:
    , tm_sub:
    , status  : ['ADD', 'CORRECT']
},

{ name: 'cip'
    , msg_type: 'catalogueItemPublication'
    , gtin:
    , provider:
    , tm:
    , tm_sub:
    , recipient:
    , initial_load:
    , status  : ['ADD', 'DELETE']
},

{ name: 'cis'
    , msg_type: 'catalogueItemSubscription'
    , gtin:
    , provider:
    , tm:
    , gpc:
    , recipient:
    , status  : ['ADD', 'DELETE']
},

{ name: 'cin'
    , gtin:
    , provider:
    , tm:
    , tm_sub:
    , recipient
    , status  : ['ADD', 'CORRECT', 'CHANGE_BY_REFRESH', 'DELETE']
},

{ name: 'cic'
    , msg_type: 'catalogueItemConfirmation'
    , status: ['ACCEPTED', 'REJECTED', 'REVIEW', 'SYNCHRONISED']
},

{ name: 'rfcin'
    , msg_type: 'requestForCatalogueItemNotification'
    , status  : ['ADD']
},

{ name: 'rpdd'
    , msg_type: 'registryPartyDataDump'
    , status  : ['ADD']
},

{ name: 'cih'
    , msg_type: 'catalogueItemHierarchyWithdrawal'
    , status  : ['CORRECT']
},

{ name: 'accepted'
    , msg_type: 'gS1Response'
    , status: ['ACCEPTED']
},

{ name: 'error'
    , msg_type: 'gS1Response'
    , status: ['ERROR']
},

{ name: 'cin_from_local_tp',
    direction: 'inbound',
    description: 'can contain only one publication (item hierarchy)',
    msg_type: 'catalogueItemNotification',
    created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
    sender: 'gln of local DSTP',
    receiver: 'gln of home data pool',
    dataRecipient: 'gln of home data pool',
    infoProvider: 'gln of DSTP (local party)',
    source_dp: 'gln of home data pool',
    root_gtins: 'array of gtins for each hierarchy root trade item',
    gtins: 'array of gtins for all trade items'
},
{ name: 'cin_from_other_dp',
    direction: 'inbound',
    description: 'can contain many publications (item hierarchies) from a single DSTP, sent via partner SDP',
    msg_type: 'catalogueItemNotification',
    created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
    sender: 'gln of other data pool',
    receiver: 'gln of home data pool',
    dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
    infoProvider: 'gln of DSTP (remote publishing party), assume only 1 per message',
    source_dp: 'gln of other data pool',
    root_gtins: 'array of gtins for each hierarchy root trade item',
    gtins: 'array of gtins for all trade items'
},
{ name: 'cin_to_local_tp_for_remote_ds',
    direction: 'outbound',
    description: 'can contain many publications (item hierarchies) from a single DSTP',
    msg_type: 'catalogueItemNotification',
    created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
    sender: 'gln of home data pool',
    receiver: 'gln of local party',
    dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
    infoProvider: 'gln of DSTP (remote publishing party), assume only 1 per message',
    source_dp: 'gln of other data pool',
    root_gtins: 'array of gtins for each hierarchy root trade item',
    gtins: 'array of gtins for all trade items'
},
{ name: 'cin_to_local_tp_for_local_ds',
    direction: 'outbound',
    description: 'can contain only one publication (item hierarchy) from a local DSTP',
    msg_type: 'catalogueItemNotification',
    created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
    sender: 'gln of home data pool',
    receiver: 'gln of local party',
    dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
    infoProvider: 'gln of DSTP (local publishing party), assume only 1 per message',
    source_dp: 'gln of home data pool',
    root_gtins: 'array of gtins for each hierarchy root trade item',
    gtins: 'array of gtins for all trade items'
}
]

