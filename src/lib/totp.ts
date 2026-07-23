import CryptoJS from 'crypto-js';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length: number = 20): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += BASE32_CHARS[bytes[i] % 32];
  }
  return secret;
}

function base32ToBytes(base32: string): number[] {
  const cleaned = base32.replace(/=+$/, '').toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of cleaned) {
    const value = BASE32_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 5) | value;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return bytes;
}

function generateTOTPWithCounter(secret: string, counter: number, digits: number = 6): string {
  const counterBytes = new Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const key = base32ToBytes(secret);
  const keyHex = key.map(b => b.toString(16).padStart(2, '0')).join('');
  const msgHex = counterBytes.map(b => b.toString(16).padStart(2, '0')).join('');

  const hmac = CryptoJS.HmacSHA1(
    CryptoJS.enc.Hex.parse(msgHex),
    CryptoJS.enc.Hex.parse(keyHex)
  );

  const hash = hmac.toString(CryptoJS.enc.Hex);
  const offset = parseInt(hash.slice(-2), 16) & 0x0f;
  const truncated = parseInt(hash.substr(offset * 2, 8), 16) & 0x7fffffff;

  const code = truncated % Math.pow(10, digits);
  return code.toString().padStart(digits, '0');
}

export function generateTOTP(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  return generateTOTPWithCounter(secret, counter);
}

export function verifyTOTP(secret: string, code: string): boolean {
  const counter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -1; offset <= 1; offset++) {
    if (generateTOTPWithCounter(secret, counter + offset) === code.trim()) return true;
  }
  return false;
}

export function buildOtpauthUrl(issuer: string, email: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
