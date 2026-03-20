import "react-native-get-random-values";
import "@ethersproject/shims";
import { Buffer } from "buffer";

// Needed by @solana/web3.js in React Native.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.Buffer = (global as any).Buffer ?? Buffer;

// Hermes on older RN/Android can be missing these. @solana/web3.js expects them.
// Minimal UTF-8-only polyfill (sufficient for web3.js usage).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = global as any;

function utf8Encode(input: string): Uint8Array {
  const bytes: number[] = [];
  let i = 0;
  while (i < input.length) {
    let codePoint = input.codePointAt(i) ?? 0;
    i += codePoint > 0xffff ? 2 : 1;

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3f));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3f));
      bytes.push(0x80 | (codePoint & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}

function utf8Decode(bytes: Uint8Array): string {
  const chars: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i++] ?? 0;
    if ((b0 & 0x80) === 0) {
      chars.push(b0);
      continue;
    }
    if ((b0 & 0xe0) === 0xc0) {
      const b1 = bytes[i++] ?? 0;
      const cp = ((b0 & 0x1f) << 6) | (b1 & 0x3f);
      chars.push(cp);
      continue;
    }
    if ((b0 & 0xf0) === 0xe0) {
      const b1 = bytes[i++] ?? 0;
      const b2 = bytes[i++] ?? 0;
      const cp = ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f);
      chars.push(cp);
      continue;
    }
    // 4-byte
    const b1 = bytes[i++] ?? 0;
    const b2 = bytes[i++] ?? 0;
    const b3 = bytes[i++] ?? 0;
    let cp =
      ((b0 & 0x07) << 18) |
      ((b1 & 0x3f) << 12) |
      ((b2 & 0x3f) << 6) |
      (b3 & 0x3f);
    cp -= 0x10000;
    chars.push(0xd800 | (cp >> 10));
    chars.push(0xdc00 | (cp & 0x3ff));
  }
  return String.fromCharCode(...chars);
}

if (typeof g.TextEncoder === "undefined") {
  g.TextEncoder = class TextEncoder {
    encode(input: string = ""): Uint8Array {
      return utf8Encode(String(input));
    }
  };
}

if (typeof g.TextDecoder === "undefined") {
  g.TextDecoder = class TextDecoder {
    private encoding: string;
    constructor(encoding: string = "utf-8") {
      const enc = String(encoding).toLowerCase();
      if (enc !== "utf-8" && enc !== "utf8") {
        throw new Error(`TextDecoder only supports utf-8 (got ${encoding})`);
      }
      this.encoding = enc;
    }
    decode(
      input?:
        | ArrayBuffer
        | ArrayBufferView
        | Uint8Array
        | null
        | undefined
    ): string {
      if (!input) return "";
      if (input instanceof Uint8Array) return utf8Decode(input);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyInput: any = input as any;
      if (anyInput?.buffer) {
        return utf8Decode(new Uint8Array(anyInput.buffer, anyInput.byteOffset ?? 0, anyInput.byteLength ?? anyInput.length ?? 0));
      }
      return utf8Decode(new Uint8Array(input as ArrayBuffer));
    }
  };
}
