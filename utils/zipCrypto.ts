/**
 * ZipCrypto implementation according to PKWARE APPNOTE.TXT specification.
 * Creates standard password-protected ZIP files that can be opened and extracted
 * natively by Windows Explorer, macOS Finder, iOS, Android, 7-Zip, WinRAR, WinZip.
 */

const crcTable = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function calcCrc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ (-1)) >>> 0;
}

class ZipCryptoCipher {
  private key0: number = 305419896;
  private key1: number = 591751049;
  private key2: number = 878082192;

  constructor(password: string) {
    for (let i = 0; i < password.length; i++) {
      this.updateKeys(password.charCodeAt(i));
    }
  }

  private updateKeys(byte: number) {
    const c = (this.key0 ^ byte) & 0xFF;
    this.key0 = crcTable[c] ^ (this.key0 >>> 8);
    this.key1 = (Math.imul(this.key1 + (this.key0 & 0xFF), 134775813) + 1) | 0;
    const b = (this.key1 >>> 24) & 0xFF;
    this.key2 = crcTable[(this.key2 ^ b) & 0xFF] ^ (this.key2 >>> 8);
  }

  public encryptByte(byte: number): number {
    const temp = (this.key2 | 2) & 0xFFFF;
    const k = (Math.imul(temp, temp ^ 1) >>> 8) & 0xFF;
    this.updateKeys(byte);
    return byte ^ k;
  }
}

/**
 * Creates a standard password-protected ZIP archive containing a single file.
 * Compatible with all operating systems and zip software.
 */
export function createPasswordProtectedZip(
  fileName: string,
  content: string | Uint8Array,
  password: string = 'password1610'
): Blob {
  const fileBytes = typeof content === 'string'
    ? new TextEncoder().encode(content)
    : content;

  const crc = calcCrc32(fileBytes);
  const cipher = new ZipCryptoCipher(password);

  // 12-byte encryption header
  const encHeader = new Uint8Array(12);
  for (let i = 0; i < 11; i++) {
    encHeader[i] = Math.floor(Math.random() * 256);
  }
  // 12th byte is the MSB of the CRC32 for verification
  encHeader[11] = (crc >>> 24) & 0xFF;

  // Encrypt header + content
  const encData = new Uint8Array(12 + fileBytes.length);
  for (let i = 0; i < 12; i++) {
    encData[i] = cipher.encryptByte(encHeader[i]);
  }
  for (let i = 0; i < fileBytes.length; i++) {
    encData[12 + i] = cipher.encryptByte(fileBytes[i]);
  }

  const nameBytes = new TextEncoder().encode(fileName);
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (Math.floor(now.getSeconds() / 2))) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  // 1. Local File Header
  const localHeader = new Uint8Array(30 + nameBytes.length);
  const lhView = new DataView(localHeader.buffer);
  lhView.setUint32(0, 0x04034b50, true); // signature
  lhView.setUint16(4, 20, true);         // version needed: 2.0
  lhView.setUint16(6, 1, true);          // flag: 1 = encrypted
  lhView.setUint16(8, 0, true);          // compression: 0 = stored
  lhView.setUint16(10, dosTime, true);   // mod time
  lhView.setUint16(12, dosDate, true);   // mod date
  lhView.setUint32(14, crc, true);       // crc32
  lhView.setUint32(18, encData.length, true);     // compressed size (includes 12-byte header)
  lhView.setUint32(22, fileBytes.length, true);  // uncompressed size
  lhView.setUint16(26, nameBytes.length, true);  // filename length
  lhView.setUint16(28, 0, true);                 // extra field length
  localHeader.set(nameBytes, 30);

  // 2. Central Directory Header
  const cdOffset = localHeader.length + encData.length;
  const cdHeader = new Uint8Array(46 + nameBytes.length);
  const cdView = new DataView(cdHeader.buffer);
  cdView.setUint32(0, 0x02014b50, true); // signature
  cdView.setUint16(4, 20, true);         // version made by
  cdView.setUint16(6, 20, true);         // version needed
  cdView.setUint16(8, 1, true);          // flag: encrypted
  cdView.setUint16(10, 0, true);         // method: stored
  cdView.setUint16(12, dosTime, true);
  cdView.setUint16(14, dosDate, true);
  cdView.setUint32(16, crc, true);
  cdView.setUint32(20, encData.length, true);
  cdView.setUint32(24, fileBytes.length, true);
  cdView.setUint16(28, nameBytes.length, true);
  cdView.setUint16(30, 0, true);         // extra field length
  cdView.setUint16(32, 0, true);         // comment length
  cdView.setUint16(34, 0, true);         // disk start
  cdView.setUint16(36, 0, true);         // internal attrs
  cdView.setUint32(38, 0, true);         // external attrs
  cdView.setUint32(42, 0, true);         // relative offset of local header (0)
  cdHeader.set(nameBytes, 46);

  // 3. End of Central Directory (EOCD)
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true); // signature
  eocdView.setUint16(4, 0, true);          // disk number
  eocdView.setUint16(6, 0, true);          // start disk
  eocdView.setUint16(8, 1, true);          // entries on this disk
  eocdView.setUint16(10, 1, true);         // total entries
  eocdView.setUint32(12, cdHeader.length, true); // central dir size
  eocdView.setUint32(16, cdOffset, true);        // central dir offset
  eocdView.setUint16(20, 0, true);               // comment length

  return new Blob([localHeader, encData, cdHeader, eocd], { type: 'application/zip' });
}
