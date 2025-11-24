/**
 * BitField class for extracting bits from AIS payload
 */
class BitField {
  constructor(bits) {
    this.bits = bits;
    this.length = bits.length;
  }

  /**
   * Extract unsigned integer from bit range
   * @param {number} start - Start bit position
   * @param {number} length - Number of bits to extract
   * @returns {number} Extracted unsigned integer
   */
  getUnsignedInt(start, length) {
    if (start + length > this.length) {
      return null;
    }
    const bitString = this.bits.substr(start, length);
    return parseInt(bitString, 2);
  }

  /**
   * Extract signed integer from bit range (two's complement)
   * @param {number} start - Start bit position
   * @param {number} length - Number of bits to extract
   * @returns {number} Extracted signed integer
   */
  getSignedInt(start, length) {
    const value = this.getUnsignedInt(start, length);
    if (value === null) return null;
    
    const signBit = 1 << (length - 1);
    if (value & signBit) {
      return value - (1 << length);
    }
    return value;
  }

  /**
   * Extract string from bit range (6-bit ASCII)
   * @param {number} start - Start bit position
   * @param {number} length - Number of bits to extract
   * @returns {string} Extracted string
   */
  getString(start, length) {
    if (start + length > this.length) {
      return null;
    }
    
    let result = '';
    for (let i = 0; i < length; i += 6) {
      const charCode = this.getUnsignedInt(start + i, 6);
      if (charCode === null) break;
      
      // Convert 6-bit ASCII to regular ASCII
      let char;
      if (charCode < 32) {
        char = String.fromCharCode(charCode + 64);
      } else {
        char = String.fromCharCode(charCode);
      }
      result += char;
    }
    
    return result.replace(/@/g, ' ').trim();
  }

  /**
   * Extract boolean from single bit
   * @param {number} start - Bit position
   * @returns {boolean} Extracted boolean
   */
  getBoolean(start) {
    if (start >= this.length) {
      return null;
    }
    return this.bits[start] === '1';
  }
}

export default BitField;
