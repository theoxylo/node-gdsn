// Introduction to GDSN 2.8 Messaging
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
//  8. GDSNResponse
//
// The first 7 types are straightforward: the message may contain several transaction/command/documentCommand structures,
// each containing:
//
//  1. documentCommandHeader@type (e.g. ADD, CHANGE_BY_REFRESH, CORRECT, DELETE)
//     *. value should be the same throughout the message if present multiple times
//
//  2. documentCommandOperand containing some number of "document" instances of the msg type
//     *. document subtype should be the same throughout the message if multiple instances present
//
// For the last type in the list (GDSNResponse), there are 4 subtypes (3 accepted and 1 exception), 
// all are potentially multiple but should not be mixed in the same message:
//
//   1. partyRegistrationResponse (GR response to DP BPR)
//      *. @responseStatus (always "ACCEPTED")
//      *. responseIdentification.uniqueCreatorIdentification (DOC level from orig BPR)
//      *. partyRegistrationInformation.lastChangedDate
//      *. partyRegistrationInformation.registrationDate
//      *. partyRegistrationInformation.removedDate (optional)
//      *. partyReference (GLN of modified party)
//
//   2. catalogueItemRegistrationResponse (GR response to DP CIR)
//      *. @responseStatus (always "ACCEPTED")
//      *. responseIdentification.uniqueCreatorIdentification (DOC level from orig msg)
//      *. catalogueItemRegistrationInformation @lastChangedDate @registrationDate
//      *. catalogueItemReference
//         .gtin
//         .dataSource (provider GLN)
//         .targetMarket.targetMarketCountryCode.countryISOCode (e.g. 840)
//         .targetMarket.targetMarketSubdivisionCode.countrySubDivisionISOCode (e.g. US-CA)
//
//   3. eANUCCResponse (generic DP response to CIP, CIS, CIN, CIC, RFCIN, BPR)
//      *. @responseStatus (always "ACCEPTED")
//      *. documentReceived.uniqueCreatorIdentification (transaction level from orig msg?)
//
//   4. gDSNException - one of the following, each containing some number of "gDSNError" and other elements:
//      *. messageException.gDSNError.errorCode
//      *. messageException.gDSNError.errorDescription
//      *. messageException.gDSNError.errorDateTime
//      *. transactionException.*.gDSNError (same as above, only nested for command/document/attribute hierarchy)
//

module.exports = messageTypes = [
{ name: 'bpr'
    , msg_type: 'basicPartyRegistration'
    , party_gln: 'gln of party being added or updated'
    , direction: 'both'
},

{ name: 'cir'
    , msg_type: 'catalogueItemRegistration'
    , direction: 'outbound'
    , gtin:
    , provider:
    , tm:
    , tm_sub:
    , command:
},

{ name: 'cip'
    , msg_type: 'catalogueItemPublication'
    , direction: 'inbound'
    , gtin:
    , provider:
    , tm:
    , tm_sub:
    , recipient:
    , command:
},

{ name: 'cis'
    , msg_type: 'catalogueItemSubscription'
    , direction: 'both'
    , gtin:
    , provider:
    , tm:
    , gpc:
    , recipient:
    , command:
},

{ name: 'cin'
    , msg_type: 'catalogueItemNotification'
    , direction: 'both'
    , gtin:
    , provider:
    , tm:
    , tm_sub:
    , command:
    , recipient
},

{ name: 'cic'
    , msg_type: 'catalogueItemConfirmation'
    , direction: 'both'
},

{ name: 'rfcin'
    , msg_type: 'requestForCatalogueItemNotification'
    , direction: 'both'
},

{ name: 'bprr'
    , msg_type: 'GDSNResponse'
    , direction: 'inbound'
},

{ name: 'cirr'
    , msg_type: 'GDSNResponse'
    , direction: 'inbound'
},

{ name: 'accepted'
    , msg_type: 'GDSNResponse'
    , direction: 'both'
},

{ name: 'error'
    , msg_type: 'GDSNResponse'
    , direction: 'both'
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

