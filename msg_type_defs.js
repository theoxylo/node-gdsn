//// documentation, not yet used for anything ////
module.exports = messageTypes = [
{
    name: 'cin_from_local_tp',
    direction: 'inbound',
    description: 'can contain only one publication (item hierarchy)',
    doctype: 'catalogueItemNotification',
    created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
    sender: 'gln of local DSTP',
    receiver: 'gln of home data pool',
    dataRecipient: 'gln of home data pool',
    infoProvider: 'gln of DSTP (local party)',
    source_dp: 'gln of home data pool',
    root_gtins: 'array of gtins for each hierarchy root trade item',
    gtins: 'array of gtins for all trade items'
},
{
    name: 'cin_from_other_dp',
    direction: 'inbound',
    description: 'can contain many publications (item hierarchies) from a single DSTP, sent via partner SDP',
    doctype: 'catalogueItemNotification',
    created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
    sender: 'gln of other data pool',
    receiver: 'gln of home data pool',
    dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
    infoProvider: 'gln of DSTP (remote publishing party), assume only 1 per message',
    source_dp: 'gln of other data pool',
    root_gtins: 'array of gtins for each hierarchy root trade item',
    gtins: 'array of gtins for all trade items'
},
{
    name: 'cin_to_local_tp_for_remote_ds',
    direction: 'outbound',
    description: 'can contain many publications (item hierarchies) from a single DSTP',
    doctype: 'catalogueItemNotification',
    created: 'message timestamp, assume we can use this as trade item timestamp for update trigger',
    sender: 'gln of home data pool',
    receiver: 'gln of local party',
    dataRecipient: 'gln of DRTP (local subscribing party), assume only 1 per message',
    infoProvider: 'gln of DSTP (remote publishing party), assume only 1 per message',
    source_dp: 'gln of other data pool',
    root_gtins: 'array of gtins for each hierarchy root trade item',
    gtins: 'array of gtins for all trade items'
},
{
    name: 'cin_to_local_tp_for_local_ds',
    direction: 'outbound',
    description: 'can contain only one publication (item hierarchy) from a local DSTP',
    doctype: 'catalogueItemNotification',
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

