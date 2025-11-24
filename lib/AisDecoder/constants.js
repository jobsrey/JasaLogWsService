/**
 * AIS Constants and Lookup Tables
 */

const NAVIGATION_STATUS = {
  0: 'Under way using engine',
  1: 'At anchor',
  2: 'Not under command',
  3: 'Restricted manoeuverability',
  4: 'Constrained by her draught',
  5: 'Moored',
  6: 'Aground',
  7: 'Engaged in fishing',
  8: 'Under way sailing',
  9: 'Reserved for future amendment',
  10: 'Reserved for future amendment',
  11: 'Power-driven vessel towing astern',
  12: 'Power-driven vessel pushing ahead',
  13: 'Reserved for future use',
  14: 'AIS-SART (active)',
  15: 'Undefined'
};

const SHIP_TYPE = {
  0: 'Not available',
  20: 'Wing in ground (WIG)',
  29: 'WIG, Hazardous category D',
  30: 'Fishing',
  31: 'Towing',
  32: 'Towing: length exceeds 200m',
  33: 'Dredging or underwater ops',
  34: 'Diving ops',
  35: 'Military ops',
  36: 'Sailing',
  37: 'Pleasure Craft',
  40: 'High speed craft (HSC)',
  50: 'Pilot Vessel',
  51: 'Search and Rescue vessel',
  52: 'Tug',
  53: 'Port Tender',
  54: 'Anti-pollution equipment',
  55: 'Law Enforcement',
  58: 'Medical Transport',
  59: 'Noncombatant ship',
  60: 'Passenger',
  69: 'Passenger, Hazardous category D',
  70: 'Cargo',
  79: 'Cargo, Hazardous category D',
  80: 'Tanker',
  89: 'Tanker, Hazardous category D',
  90: 'Other Type',
  99: 'Other Type, Hazardous category D'
};

const EPFD_TYPE = {
  0: 'Undefined',
  1: 'GPS',
  2: 'GLONASS',
  3: 'Combined GPS/GLONASS',
  4: 'Loran-C',
  5: 'Chayka',
  6: 'Integrated navigation system',
  7: 'Surveyed',
  8: 'Galileo',
  15: 'Internal GNSS'
};

const AID_TYPE = {
  0: 'Not specified',
  1: 'Reference point',
  2: 'RACON',
  3: 'Fixed structure off shore',
  4: 'Spare',
  5: 'Light, without sectors',
  6: 'Light, with sectors',
  7: 'Leading Light Front',
  8: 'Leading Light Rear',
  9: 'Beacon, Cardinal N',
  10: 'Beacon, Cardinal E',
  11: 'Beacon, Cardinal S',
  12: 'Beacon, Cardinal W',
  13: 'Beacon, Port hand',
  14: 'Beacon, Starboard hand',
  15: 'Beacon, Preferred Channel port hand',
  16: 'Beacon, Preferred Channel starboard hand',
  17: 'Beacon, Isolated danger',
  18: 'Beacon, Safe water',
  19: 'Beacon, Special mark',
  20: 'Beacon, Light Vessel / LANBY / Rigs',
  30: 'Default, Type of Aid to Navigation not specified'
};

export {
  NAVIGATION_STATUS,
  SHIP_TYPE,
  EPFD_TYPE,
  AID_TYPE
};
