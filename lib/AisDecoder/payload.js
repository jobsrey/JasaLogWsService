/**
 * Convert AIS 6-bit ASCII payload to binary string
 * @param {string} payload - AIS payload string
 * @returns {string} Binary string representation
 */
function payloadToBits(payload) {
  let bits = '';
  
  for (let i = 0; i < payload.length; i++) {
    let charCode = payload.charCodeAt(i);
    
    // Convert ASCII to 6-bit value
    let value;
    if (charCode >= 48 && charCode <= 87) {
      // 0-9 and special chars
      value = charCode - 48;
    } else if (charCode >= 96 && charCode <= 119) {
      // a-w
      value = charCode - 56;
    } else {
      value = 0;
    }
    
    // Convert to 6-bit binary string
    bits += value.toString(2).padStart(6, '0');
  }
  
  return bits;
}

/**
 * Parse NMEA sentence to extract payload and metadata
 * @param {string} sentence - NMEA sentence
 * @returns {object} Parsed sentence data
 */
function parseNMEA(sentence) {
  // Remove any whitespace
  sentence = sentence.trim();
  
  // Check for NMEA sentence format
  if (!sentence.startsWith('!') && !sentence.startsWith('$')) {
    throw new Error('Invalid NMEA sentence: must start with ! or $');
  }
  
  // Remove checksum if present
  const checksumIndex = sentence.lastIndexOf('*');
  if (checksumIndex > 0) {
    sentence = sentence.substring(0, checksumIndex);
  }
  
  // Split by comma
  const parts = sentence.substring(1).split(',');
  
  if (parts.length < 6) {
    throw new Error('Invalid NMEA sentence: insufficient fields');
  }
  
  const result = {
    type: parts[0], // AIVDM or AIVDO
    fragmentCount: parseInt(parts[1]),
    fragmentNumber: parseInt(parts[2]),
    messageId: parts[3] || null,
    channel: parts[4],
    payload: parts[5],
    fillBits: 0
  };
  
  // Extract fill bits if present
  if (parts.length > 6 && parts[6]) {
    result.fillBits = parseInt(parts[6]);
  }
  
  return result;
}

export {
  payloadToBits,
  parseNMEA
};
