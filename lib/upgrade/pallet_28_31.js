module.exports = function (s, mat) {
  if (!s) return s
  var keys = { 
    "1":  {code:"27", material: "WOOD_SOFTWOOD" },
    "2":  {code:"27", material: "METAL_ALUMINUM"},
    "3":  {code:"27"                            },
    "4":  {code:"27", material: "WOOD_HARDWOOD" },
    "5":  {code:"27", material: "METAL_OTHER"   },
    "6":  {code:"50"                            },
    "7":  {code:"27", material: "STEEL"         },
    "8":  {code:"27", material: "WOOD_OTHER"    },
    "15": {code:"11"                            },
    "16": {code:"12"                            },
    "17": {code:"50"                            },
    "18": {code:"50"                            },
    "19": {code:"50"                            },
    "20": {code:"50"                            },
    "21": {code:"11"                            },
    "22": {code:"13"                            },
    "23": {code:"11"                            },
    "24": {code:"12"                            },
    "26": {code:"50"                            }
  }
  if (mat) return (keys[s] && keys[s].material) || ''
  return (keys[s] && keys[s].code) || s
}
