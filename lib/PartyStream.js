var fs               = require('fs')
var HeaderTransform  = require('./HeaderTransform')
var ElementTransform = require('./ElementTransform')

module.exports = PartyStream

function PartyStream(gdsn) {
  if (!(this instanceof PartyStream)) {
    return new PartyStream(gdsn)
  }
  console.log('Creating new instance of PartyStream service')
  this._gdsn = gdsn
}

PartyStream.prototype.getPartiesFromFile = function (filename, cb) {
  console.log('Reading party file ' + filename)
  var is = fs.createReadStream(filename, {encoding: 'utf8'})
  this.getPartiesFromStream(is, cb)
}

PartyStream.prototype.getPartiesFromStream = function (is, cb) {
  var parties = []
  this.getEachPartyFromStream(is, function (err, party) {
    if (err) return cb(err)
    if (!party) return cb(null, parties)
    parties.push(party)
  })
}

PartyStream.prototype.getEachPartyFromStream = function (is, cb) {

  var msgInfo  = new HeaderTransform(this._gdsn.getMessageInfoFromString)
  var elements = new ElementTransform('registryPartyDataDumpDetail')

  var gdsn = this._gdsn

  var header_info_result = false

  msgInfo.on('header_info', function (err, header_info) {
    if (err) return cb(err)
    console.log('found RPDD info: ' + JSON.stringify(header_info))
    header_info_result = header_info

    // once we have the header_info, we can start our party stream
    elements.on('element_xml', function (xml) {
      console.log('party element xml length: ' + xml.length)
      var party_info = gdsn.getPartyInfo(xml, header_info)
      console.log('found party: ' + party_info.gln)
      cb(null, party_info)
    })
    elements.on('end', function () {
      cb(null, null) // all done
    })
    elements.on('error', function (err) {
      cb(err)
    })
  })
  msgInfo.on('end', function () {
    console.log('msgInfo -> end')
    if (!header_info_result) cb (new Error('required message header info not found'))
  })
  msgInfo.on('error', function (err) {
    console.log('msgInfo -> err: ' + err)
    //cb(err)
  })

  is.pipe(msgInfo).pipe(elements).resume()
}

