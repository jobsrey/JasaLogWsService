import BitField from './bitfield.js';
import { NAVIGATION_STATUS, SHIP_TYPE, EPFD_TYPE, AID_TYPE } from './constants.js';
import { getCountryFromMMSI } from './country.js';

/**
 * Add country information to decoded message based on MMSI
 * @param {object} data - Decoded message data
 * @returns {object} Data with country information added
 */
function addCountryInfo(data) {
  if (data.mmsi) {
    const country = getCountryFromMMSI(data.mmsi);
    if (country) {
      data.country = country.name;
      data.countryCode = country.code;
    }
  }
  return data;
}

/**
 * Decode Message Type 1, 2, 3: Position Report Class A
 */
function decodeMessage123(bits) {
  const bf = new BitField(bits);
  
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    status: bf.getUnsignedInt(38, 4),
    statusText: NAVIGATION_STATUS[bf.getUnsignedInt(38, 4)],
    turn: bf.getSignedInt(42, 8),
    speed: bf.getUnsignedInt(50, 10) / 10.0,
    accuracy: bf.getBoolean(60),
    lon: bf.getSignedInt(61, 28) / 600000.0,
    lat: bf.getSignedInt(89, 27) / 600000.0,
    course: bf.getUnsignedInt(116, 12) / 10.0,
    heading: bf.getUnsignedInt(128, 9),
    second: bf.getUnsignedInt(137, 6),
    maneuver: bf.getUnsignedInt(143, 2),
    raim: bf.getBoolean(148),
    radio: bf.getUnsignedInt(149, 19)
  };
  
  if (data.speed === 102.3) data.speed = null;
  if (data.course === 360.0) data.course = null;
  if (data.heading === 511) data.heading = null;
  if (data.lon === 181) data.lon = null;
  if (data.lat === 91) data.lat = null;
  
  return addCountryInfo(data);
}

/**
 * Decode Message Type 4: Base Station Report
 */
function decodeMessage4(bits) {
  const bf = new BitField(bits);
  
  return addCountryInfo({
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    year: bf.getUnsignedInt(38, 14),
    month: bf.getUnsignedInt(52, 4),
    day: bf.getUnsignedInt(56, 5),
    hour: bf.getUnsignedInt(61, 5),
    minute: bf.getUnsignedInt(66, 6),
    second: bf.getUnsignedInt(72, 6),
    accuracy: bf.getBoolean(78),
    lon: bf.getSignedInt(79, 28) / 600000.0,
    lat: bf.getSignedInt(107, 27) / 600000.0,
    epfd: bf.getUnsignedInt(134, 4),
    epfdText: EPFD_TYPE[bf.getUnsignedInt(134, 4)],
    raim: bf.getBoolean(148),
    radio: bf.getUnsignedInt(149, 19)
  });
}

/**
 * Decode Message Type 5: Static and Voyage Related Data
 */
function decodeMessage5(bits) {
  const bf = new BitField(bits);
  
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    aisVersion: bf.getUnsignedInt(38, 2),
    imo: bf.getUnsignedInt(40, 30),
    callsign: bf.getString(70, 42),
    shipname: bf.getString(112, 120),
    shiptype: bf.getUnsignedInt(232, 8),
    shiptypeText: SHIP_TYPE[bf.getUnsignedInt(232, 8)] || 'Unknown',
    to_bow: bf.getUnsignedInt(240, 9),
    to_stern: bf.getUnsignedInt(249, 9),
    to_port: bf.getUnsignedInt(258, 6),
    to_starboard: bf.getUnsignedInt(264, 6),
    epfd: bf.getUnsignedInt(270, 4),
    epfdText: EPFD_TYPE[bf.getUnsignedInt(270, 4)],
    eta_month: bf.getUnsignedInt(274, 4),
    eta_day: bf.getUnsignedInt(278, 5),
    eta_hour: bf.getUnsignedInt(283, 5),
    eta_minute: bf.getUnsignedInt(288, 6),
    draught: bf.getUnsignedInt(294, 8) / 10.0,
    destination: bf.getString(302, 120),
    dte: bf.getBoolean(422)
  };
  
  data.length = data.to_bow + data.to_stern;
  data.width = data.to_port + data.to_starboard;
  
  return addCountryInfo(data);
}

/**
 * Decode Message Type 18: Standard Class B CS Position Report
 */
function decodeMessage18(bits) {
  const bf = new BitField(bits);
  
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    speed: bf.getUnsignedInt(46, 10) / 10.0,
    accuracy: bf.getBoolean(56),
    lon: bf.getSignedInt(57, 28) / 600000.0,
    lat: bf.getSignedInt(85, 27) / 600000.0,
    course: bf.getUnsignedInt(112, 12) / 10.0,
    heading: bf.getUnsignedInt(124, 9),
    second: bf.getUnsignedInt(133, 6),
    cs: bf.getBoolean(141),
    display: bf.getBoolean(142),
    dsc: bf.getBoolean(143),
    band: bf.getBoolean(144),
    msg22: bf.getBoolean(145),
    assigned: bf.getBoolean(146),
    raim: bf.getBoolean(147),
    radio: bf.getUnsignedInt(148, 20)
  };
  
  if (data.speed === 102.3) data.speed = null;
  if (data.course === 360.0) data.course = null;
  if (data.heading === 511) data.heading = null;
  
  return addCountryInfo(data);
}

/**
 * Decode Message Type 19: Extended Class B CS Position Report
 */
function decodeMessage19(bits) {
  const bf = new BitField(bits);
  
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    speed: bf.getUnsignedInt(46, 10) / 10.0,
    accuracy: bf.getBoolean(56),
    lon: bf.getSignedInt(57, 28) / 600000.0,
    lat: bf.getSignedInt(85, 27) / 600000.0,
    course: bf.getUnsignedInt(112, 12) / 10.0,
    heading: bf.getUnsignedInt(124, 9),
    second: bf.getUnsignedInt(133, 6),
    shipname: bf.getString(143, 120),
    shiptype: bf.getUnsignedInt(263, 8),
    shiptypeText: SHIP_TYPE[bf.getUnsignedInt(263, 8)] || 'Unknown',
    to_bow: bf.getUnsignedInt(271, 9),
    to_stern: bf.getUnsignedInt(280, 9),
    to_port: bf.getUnsignedInt(289, 6),
    to_starboard: bf.getUnsignedInt(295, 6),
    epfd: bf.getUnsignedInt(301, 4),
    epfdText: EPFD_TYPE[bf.getUnsignedInt(301, 4)],
    raim: bf.getBoolean(305),
    dte: bf.getBoolean(306),
    assigned: bf.getBoolean(307)
  };
  
  data.length = data.to_bow + data.to_stern;
  data.width = data.to_port + data.to_starboard;
  
  if (data.speed === 102.3) data.speed = null;
  if (data.course === 360.0) data.course = null;
  if (data.heading === 511) data.heading = null;
  
  return addCountryInfo(data);
}

/**
 * Decode Message Type 21: Aid-to-Navigation Report
 */
function decodeMessage21(bits) {
  const bf = new BitField(bits);
  
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    aid_type: bf.getUnsignedInt(38, 5),
    aid_type_text: AID_TYPE[bf.getUnsignedInt(38, 5)] || 'Unknown',
    name: bf.getString(43, 120),
    accuracy: bf.getBoolean(163),
    lon: bf.getSignedInt(164, 28) / 600000.0,
    lat: bf.getSignedInt(192, 27) / 600000.0,
    to_bow: bf.getUnsignedInt(219, 9),
    to_stern: bf.getUnsignedInt(228, 9),
    to_port: bf.getUnsignedInt(237, 6),
    to_starboard: bf.getUnsignedInt(243, 6),
    epfd: bf.getUnsignedInt(249, 4),
    epfdText: EPFD_TYPE[bf.getUnsignedInt(249, 4)],
    second: bf.getUnsignedInt(253, 6),
    off_position: bf.getBoolean(259),
    raim: bf.getBoolean(268),
    virtual_aid: bf.getBoolean(269),
    assigned: bf.getBoolean(270)
  };
  
  if (bits.length > 272) {
    data.name_extension = bf.getString(272, bits.length - 272);
  }
  
  data.length = data.to_bow + data.to_stern;
  data.width = data.to_port + data.to_starboard;
  
  return addCountryInfo(data);
}

/**
 * Decode Message Type 24: Static Data Report
 */
function decodeMessage24(bits) {
  const bf = new BitField(bits);
  
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    partno: bf.getUnsignedInt(38, 2)
  };
  
  if (data.partno === 0) {
    data.shipname = bf.getString(40, 120);
  } else if (data.partno === 1) {
    data.shiptype = bf.getUnsignedInt(40, 8);
    data.shiptypeText = SHIP_TYPE[data.shiptype] || 'Unknown';
    data.vendorid = bf.getString(48, 18);
    data.model = bf.getUnsignedInt(66, 4);
    data.serial = bf.getUnsignedInt(70, 20);
    data.callsign = bf.getString(90, 42);
    
    if (bf.getUnsignedInt(132, 30) !== 0) {
      data.mothership_mmsi = bf.getUnsignedInt(132, 30);
    } else {
      data.to_bow = bf.getUnsignedInt(132, 9);
      data.to_stern = bf.getUnsignedInt(141, 9);
      data.to_port = bf.getUnsignedInt(150, 6);
      data.to_starboard = bf.getUnsignedInt(156, 6);
      data.length = data.to_bow + data.to_stern;
      data.width = data.to_port + data.to_starboard;
    }
  }
  
  return addCountryInfo(data);
}

/**
 * Decode Message Type 27: Long Range AIS Broadcast
 */
function decodeMessage27(bits) {
  const bf = new BitField(bits);
  
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    accuracy: bf.getBoolean(38),
    raim: bf.getBoolean(39),
    status: bf.getUnsignedInt(40, 4),
    statusText: NAVIGATION_STATUS[bf.getUnsignedInt(40, 4)],
    lon: bf.getSignedInt(44, 18) / 600.0,
    lat: bf.getSignedInt(62, 17) / 600.0,
    speed: bf.getUnsignedInt(79, 6),
    course: bf.getUnsignedInt(85, 9),
    gnss: bf.getBoolean(94)
  };
  
  if (data.speed === 63) data.speed = null;
  if (data.course === 511) data.course = null;
  
  return addCountryInfo(data);
}

// Generic decoders for less common message types
function decodeMessage6(bits) {
  const bf = new BitField(bits);
  return addCountryInfo({
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    seqno: bf.getUnsignedInt(38, 2),
    dest_mmsi: bf.getUnsignedInt(40, 30),
    retransmit: bf.getBoolean(70),
    dac: bf.getUnsignedInt(72, 10),
    fid: bf.getUnsignedInt(82, 6),
    data: bits.substr(88)
  });
}

function decodeMessage7(bits) {
  const bf = new BitField(bits);
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    acks: []
  };
  
  for (let i = 0; i < 4; i++) {
    const offset = 40 + (i * 32);
    if (offset + 32 <= bits.length) {
      data.acks.push({
        mmsi: bf.getUnsignedInt(offset, 30),
        seqno: bf.getUnsignedInt(offset + 30, 2)
      });
    }
  }
  
  return data;
}

function decodeMessage8(bits) {
  const bf = new BitField(bits);
  return {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    dac: bf.getUnsignedInt(40, 10),
    fid: bf.getUnsignedInt(50, 6),
    data: bits.substr(56)
  };
}

function decodeMessage9(bits) {
  const bf = new BitField(bits);
  return {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    alt: bf.getUnsignedInt(38, 12),
    speed: bf.getUnsignedInt(50, 10),
    accuracy: bf.getBoolean(60),
    lon: bf.getSignedInt(61, 28) / 600000.0,
    lat: bf.getSignedInt(89, 27) / 600000.0,
    course: bf.getUnsignedInt(116, 12) / 10.0,
    second: bf.getUnsignedInt(128, 6),
    dte: bf.getBoolean(142),
    assigned: bf.getBoolean(146),
    raim: bf.getBoolean(147),
    radio: bf.getUnsignedInt(148, 20)
  };
}

function decodeMessage10(bits) {
  const bf = new BitField(bits);
  return {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    dest_mmsi: bf.getUnsignedInt(40, 30)
  };
}

function decodeMessage12(bits) {
  const bf = new BitField(bits);
  return {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    seqno: bf.getUnsignedInt(38, 2),
    dest_mmsi: bf.getUnsignedInt(40, 30),
    retransmit: bf.getBoolean(70),
    text: bf.getString(72, bits.length - 72)
  };
}

function decodeMessage14(bits) {
  const bf = new BitField(bits);
  return {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    text: bf.getString(40, bits.length - 40)
  };
}

function decodeMessage15(bits) {
  const bf = new BitField(bits);
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    interrogations: []
  };
  
  if (bits.length >= 88) {
    data.interrogations.push({
      mmsi: bf.getUnsignedInt(40, 30),
      type1: bf.getUnsignedInt(70, 6),
      offset1: bf.getUnsignedInt(76, 12)
    });
  }
  
  return data;
}

function decodeMessage20(bits) {
  const bf = new BitField(bits);
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    reservations: []
  };
  
  for (let i = 0; i < 4; i++) {
    const offset = 40 + (i * 30);
    if (offset + 30 <= bits.length) {
      data.reservations.push({
        offset: bf.getUnsignedInt(offset, 12),
        number: bf.getUnsignedInt(offset + 12, 4),
        timeout: bf.getUnsignedInt(offset + 16, 3),
        increment: bf.getUnsignedInt(offset + 19, 11)
      });
    }
  }
  
  return data;
}

function decodeMessage22(bits) {
  const bf = new BitField(bits);
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    channel_a: bf.getUnsignedInt(40, 12),
    channel_b: bf.getUnsignedInt(52, 12),
    txrx: bf.getUnsignedInt(64, 4),
    power: bf.getBoolean(68),
    addressed: bf.getBoolean(139)
  };
  
  if (data.addressed) {
    data.dest_mmsi1 = bf.getUnsignedInt(69, 30);
    data.dest_mmsi2 = bf.getUnsignedInt(104, 30);
  } else {
    data.ne_lon = bf.getSignedInt(69, 18) / 600.0;
    data.ne_lat = bf.getSignedInt(87, 17) / 600.0;
    data.sw_lon = bf.getSignedInt(104, 18) / 600.0;
    data.sw_lat = bf.getSignedInt(122, 17) / 600.0;
  }
  
  return data;
}

function decodeMessage23(bits) {
  const bf = new BitField(bits);
  return {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    ne_lon: bf.getSignedInt(40, 18) / 600.0,
    ne_lat: bf.getSignedInt(58, 17) / 600.0,
    sw_lon: bf.getSignedInt(75, 18) / 600.0,
    sw_lat: bf.getSignedInt(93, 17) / 600.0,
    station_type: bf.getUnsignedInt(110, 4),
    ship_type: bf.getUnsignedInt(114, 8),
    txrx: bf.getUnsignedInt(144, 2),
    interval: bf.getUnsignedInt(146, 4),
    quiet: bf.getUnsignedInt(150, 4)
  };
}

function decodeMessage25(bits) {
  const bf = new BitField(bits);
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    addressed: bf.getBoolean(38),
    structured: bf.getBoolean(39)
  };
  
  if (data.addressed) {
    data.dest_mmsi = bf.getUnsignedInt(40, 30);
    if (data.structured) {
      data.dac = bf.getUnsignedInt(70, 10);
      data.fid = bf.getUnsignedInt(80, 6);
      data.data = bits.substr(86);
    } else {
      data.data = bits.substr(70);
    }
  } else {
    if (data.structured) {
      data.dac = bf.getUnsignedInt(40, 10);
      data.fid = bf.getUnsignedInt(50, 6);
      data.data = bits.substr(56);
    } else {
      data.data = bits.substr(40);
    }
  }
  
  return data;
}

function decodeMessage26(bits) {
  const bf = new BitField(bits);
  const data = {
    type: bf.getUnsignedInt(0, 6),
    repeat: bf.getUnsignedInt(6, 2),
    mmsi: bf.getUnsignedInt(8, 30),
    addressed: bf.getBoolean(38),
    structured: bf.getBoolean(39)
  };
  
  if (data.addressed) {
    data.dest_mmsi = bf.getUnsignedInt(40, 30);
  }
  
  return data;
}

export default {
  decodeMessage123,
  decodeMessage4,
  decodeMessage5,
  decodeMessage6,
  decodeMessage7,
  decodeMessage8,
  decodeMessage9,
  decodeMessage10,
  decodeMessage11: decodeMessage4,
  decodeMessage12,
  decodeMessage13: decodeMessage7,
  decodeMessage14,
  decodeMessage15,
  decodeMessage18,
  decodeMessage19,
  decodeMessage20,
  decodeMessage21,
  decodeMessage22,
  decodeMessage23,
  decodeMessage24,
  decodeMessage25,
  decodeMessage26,
  decodeMessage27
};
