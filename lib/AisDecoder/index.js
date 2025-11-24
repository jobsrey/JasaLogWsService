import { payloadToBits, parseNMEA } from './payload.js';
import decoders from './decoders.js';

/**
 * Main AIS Decoder Class
 */
class AISDecoder {
  constructor() {
    this.multilineBuffer = {};
  }

  /**
   * Decode a single AIS message
   * @param {string} sentence - NMEA sentence or raw payload
   * @returns {object} Decoded AIS message
   */
  decode(sentence) {
    try {
      // Check if it's a NMEA sentence or raw payload
      let payload, fillBits = 0;
      
      if (sentence.startsWith('!') || sentence.startsWith('$')) {
        const parsed = parseNMEA(sentence);
        
        // Handle multi-line messages
        if (parsed.fragmentCount > 1) {
          return this.handleMultiline(parsed);
        }
        
        payload = parsed.payload;
        fillBits = parsed.fillBits;
      } else {
        // Assume it's a raw payload
        payload = sentence.trim();
      }
      
      // Convert payload to bits
      let bits = payloadToBits(payload);
      
      // Remove fill bits
      if (fillBits > 0) {
        bits = bits.substr(0, bits.length - fillBits);
      }
      
      // Get message type
      const messageType = parseInt(bits.substr(0, 6), 2);
      
      // Decode based on message type
      return this.decodeByType(messageType, bits);
      
    } catch (error) {
      return {
        error: true,
        message: error.message,
        raw: sentence
      };
    }
  }

  /**
   * Handle multi-line AIS messages
   * @param {object} parsed - Parsed NMEA data
   * @returns {object|null} Decoded message or null if incomplete
   */
  handleMultiline(parsed) {
    const { messageId, fragmentNumber, fragmentCount, payload, fillBits } = parsed;
    
    // Initialize buffer for this message ID
    if (!this.multilineBuffer[messageId]) {
      this.multilineBuffer[messageId] = {
        fragments: {},
        fragmentCount: fragmentCount,
        fillBits: fillBits
      };
    }
    
    // Store fragment
    this.multilineBuffer[messageId].fragments[fragmentNumber] = payload;
    
    // Check if all fragments received
    const buffer = this.multilineBuffer[messageId];
    if (Object.keys(buffer.fragments).length === buffer.fragmentCount) {
      // Combine all fragments
      let combinedPayload = '';
      for (let i = 1; i <= buffer.fragmentCount; i++) {
        if (!buffer.fragments[i]) {
          return {
            error: true,
            message: 'Missing fragment',
            messageId: messageId,
            received: Object.keys(buffer.fragments).length,
            expected: buffer.fragmentCount
          };
        }
        combinedPayload += buffer.fragments[i];
      }
      
      // Clean up buffer
      delete this.multilineBuffer[messageId];
      
      // Convert to bits and decode
      let bits = payloadToBits(combinedPayload);
      if (buffer.fillBits > 0) {
        bits = bits.substr(0, bits.length - buffer.fillBits);
      }
      
      const messageType = parseInt(bits.substr(0, 6), 2);
      return this.decodeByType(messageType, bits);
    }
    
    // Return partial status
    return {
      partial: true,
      messageId: messageId,
      received: Object.keys(buffer.fragments).length,
      expected: buffer.fragmentCount
    };
  }

  /**
   * Decode message by type
   * @param {number} type - Message type
   * @param {string} bits - Binary string
   * @returns {object} Decoded message
   */
  decodeByType(type, bits) {
    let decoded;
    
    switch (type) {
      case 1:
      case 2:
      case 3:
        decoded = decoders.decodeMessage123(bits);
        break;
      case 4:
        decoded = decoders.decodeMessage4(bits);
        break;
      case 5:
        decoded = decoders.decodeMessage5(bits);
        break;
      case 6:
        decoded = decoders.decodeMessage6(bits);
        break;
      case 7:
        decoded = decoders.decodeMessage7(bits);
        break;
      case 8:
        decoded = decoders.decodeMessage8(bits);
        break;
      case 9:
        decoded = decoders.decodeMessage9(bits);
        break;
      case 10:
        decoded = decoders.decodeMessage10(bits);
        break;
      case 11:
        decoded = decoders.decodeMessage11(bits);
        break;
      case 12:
        decoded = decoders.decodeMessage12(bits);
        break;
      case 13:
        decoded = decoders.decodeMessage13(bits);
        break;
      case 14:
        decoded = decoders.decodeMessage14(bits);
        break;
      case 15:
        decoded = decoders.decodeMessage15(bits);
        break;
      case 18:
        decoded = decoders.decodeMessage18(bits);
        break;
      case 19:
        decoded = decoders.decodeMessage19(bits);
        break;
      case 20:
        decoded = decoders.decodeMessage20(bits);
        break;
      case 21:
        decoded = decoders.decodeMessage21(bits);
        break;
      case 22:
        decoded = decoders.decodeMessage22(bits);
        break;
      case 23:
        decoded = decoders.decodeMessage23(bits);
        break;
      case 24:
        decoded = decoders.decodeMessage24(bits);
        break;
      case 25:
        decoded = decoders.decodeMessage25(bits);
        break;
      case 26:
        decoded = decoders.decodeMessage26(bits);
        break;
      case 27:
        decoded = decoders.decodeMessage27(bits);
        break;
      default:
        decoded = {
          type: type,
          error: true,
          message: `Unsupported message type: ${type}`,
          bits: bits
        };
    }
    
    return decoded;
  }

  /**
   * Clear multiline buffer for a specific message ID or all
   * @param {string} messageId - Optional message ID to clear
   */
  clearBuffer(messageId = null) {
    if (messageId) {
      delete this.multilineBuffer[messageId];
    } else {
      this.multilineBuffer = {};
    }
  }

  /**
   * Get current multiline buffer status
   * @returns {object} Buffer status
   */
  getBufferStatus() {
    const status = {};
    for (const [id, buffer] of Object.entries(this.multilineBuffer)) {
      status[id] = {
        received: Object.keys(buffer.fragments).length,
        expected: buffer.fragmentCount
      };
    }
    return status;
  }
}

/**
 * Convenience function to decode a single message
 * @param {string} sentence - NMEA sentence or raw payload
 * @returns {object} Decoded AIS message
 */
function decode(sentence) {
  const decoder = new AISDecoder();
  return decoder.decode(sentence);
}

/**
 * Decode multiple messages
 * @param {array} sentences - Array of NMEA sentences
 * @returns {array} Array of decoded messages
 */
function decodeMultiple(sentences) {
  const decoder = new AISDecoder();
  return sentences.map(sentence => decoder.decode(sentence));
}

export default AISDecoder;
export {
  decode,
  decodeMultiple
};
