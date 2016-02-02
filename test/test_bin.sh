#!/bin/sh

cd `dirname "$0"`

node ../bin/clean_xml.js  gdsn3/cin_from_other_dp.xml

#node ../bin/cin_forward.js 1100001011285 gdsn3/cin_from_other_dp.xml

#node ../bin/cin_respond.js 1100001011285 gdsn3/cin_from_other_dp.xml

#node ../bin/extract_trade_items_from_dom.js gdsn3/cin_from_other_dp.xml

node ../bin/extract_trade_items_from_stream.js gdsn3/cin_from_other_dp.xml

node ../bin/extract_parties_from_stream.js gdsn3/rpdd-gr.xml

node ../bin/validate_gln.js 1100001011285

node ../bin/validate_gtin.js 00048556054023

