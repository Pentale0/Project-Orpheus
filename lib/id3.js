import fsp from 'node:fs/promises';

const HEADER_BYTES = 1024 * 1024;

const FRAME_IDS = {
  v2: { title: 'TT2', artist: 'TP1', album: 'TAL', track: 'TRK', year: 'TYE', genre: 'TCO', picture: 'PIC' },
  v3: { title: 'TIT2', artist: 'TPE1', album: 'TALB', track: 'TRCK', year: 'TYER', genre: 'TCON', picture: 'APIC' },
  v4: { title: 'TIT2', artist: 'TPE1', album: 'TALB', track: 'TRCK', year: 'TDRC', genre: 'TCON', picture: 'APIC' }
};

function syncsafe(buf, off) {
  return ((buf[off] & 0x7f) << 21) | ((buf[off + 1] & 0x7f) << 14) | ((buf[off + 2] & 0x7f) << 7) | (buf[off + 3] & 0x7f);
}

function decodeText(body) {
  if (!body || !body.length) return '';
  const enc = body[0];
  let data = body.subarray(1);
  let label = 'latin1';
  if (enc === 1) {
    if (data[0] === 0xff && data[1] === 0xfe) { label = 'utf16le'; data = data.subarray(2); }
    else if (data[0] === 0xfe && data[1] === 0xff) { label = 'utf16be'; data = data.subarray(2); }
    else label = 'utf16le';
  } else if (enc === 2) label = 'utf16be';
  else if (enc === 3) label = 'utf8';
  return Buffer.from(data).toString(label).split('\u0000')[0].trim();
}

function decodePicture(body, major) {
  if (!body || body.length < 4) return null;
  let p = 1;
  let mime = '';
  if (major === 2) {
    const ext = body.subarray(1, 4).toString('latin1').toUpperCase();
    mime = ext === 'PNG' ? 'image/png' : 'image/jpeg';
    p = 4;
  } else {
    while (p < body.length && body[p] !== 0) { mime += String.fromCharCode(body[p]); p++; }
    p++;
  }
  p++;
  if (major >= 3) {
    const enc = body[0];
    if (enc === 0 || enc === 3) {
      while (p < body.length && body[p] !== 0) p++;
      p++;
    } else {
      while (p + 1 < body.length && !(body[p] === 0 && body[p + 1] === 0)) p += 2;
      p += 2;
    }
  }
  if (!/^image\//.test(mime)) mime = mime === 'jpg' ? 'image/jpeg' : 'image/png';
  if (mime === 'image/jpg') mime = 'image/jpeg';
  const data = body.subarray(p);
  if (data.length < 128) return null;
  return { mime, data: Buffer.from(data) };
}

export function parseId3(buf) {
  const out = { tags: {}, picture: null, audioStart: 0 };
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return out;
  const major = buf[3];
  const flags = buf[5];
  const size = major === 4 ? syncsafe(buf, 6) : ((buf[6] << 16) | (buf[7] << 8) | buf[8]);
  out.audioStart = 10 + size;
  if (major < 2 || major > 4) return out;

  const ids = FRAME_IDS[major === 2 ? 'v2' : major === 3 ? 'v3' : 'v4'];
  const idSize = major === 2 ? 3 : 4;
  const headSize = major === 2 ? 6 : 10;
  let p = 10;
  if (flags & 0x40) {
    if (major === 4) p += syncsafe(buf, p);
    else p += buf.readUInt32BE(p) + 4;
  }
  const end = Math.min(10 + size, buf.length);
  while (p + headSize <= end) {
    let id = buf.subarray(p, p + idSize).toString('latin1');
    if (!/^[A-Z0-9]+$/.test(id)) break;
    let frameSize;
    if (major === 2) frameSize = (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5];
    else if (major === 3) frameSize = buf.readUInt32BE(p + 4);
    else frameSize = syncsafe(buf, p + 4);
    const body = buf.subarray(p + headSize, p + headSize + frameSize);
    p += headSize + frameSize;
    if (frameSize <= 0) continue;
    try {
      if (id === ids.title) out.tags.title = decodeText(body);
      else if (id === ids.artist) out.tags.artist = decodeText(body);
      else if (id === ids.album) out.tags.album = decodeText(body);
      else if (id === ids.track) out.tags.track = decodeText(body).split('/')[0];
      else if (id === ids.year) out.tags.year = decodeText(body).slice(0, 4);
      else if (id === ids.genre) out.tags.genre = decodeText(body);
      else if (id === ids.picture && !out.picture) out.picture = decodePicture(body, major);
    } catch {
      /* broken frame, keep going */
    }
  }
  return out;
}

const BITRATES = {
  '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-23': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
};
const RATES = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 2.5: [11025, 12000, 8000] };
const SAMPLES = { 1: 384, 2: 1152, 3: 1152 };

function frameHeaderAt(buf, off) {
  if (off + 4 > buf.length) return null;
  if (buf[off] !== 0xff || (buf[off + 1] & 0xe0) !== 0xe0) return null;
  const versionBits = (buf[off + 1] >> 3) & 0x03;
  if (versionBits === 1) return null;
  const layerBits = (buf[off + 1] >> 1) & 0x03;
  if (layerBits === 0) return null;
  const version = versionBits === 3 ? 1 : versionBits === 2 ? 2 : 2.5;
  const layer = 4 - layerBits;
  const bitrateIndex = (buf[off + 2] >> 4) & 0x0f;
  const rateIndex = (buf[off + 2] >> 2) & 0x03;
  if (bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const table = version === 1 ? `1-${layer}` : layer === 1 ? '2-1' : '2-23';
  const bitrate = BITRATES[table][bitrateIndex] * 1000;
  const sampleRate = RATES[version][rateIndex];
  const padding = (buf[off + 2] >> 1) & 0x01;
  const channelMode = (buf[off + 3] >> 6) & 0x03;
  const spf = layer === 1 ? 384 : layer === 3 && version !== 1 ? 576 : 1152;
  let frameSize;
  if (layer === 1) frameSize = (Math.floor((12 * bitrate) / sampleRate) + padding) * 4;
  else if (layer === 3 && version !== 1) frameSize = Math.floor((72 * bitrate) / sampleRate) + padding;
  else frameSize = Math.floor((144 * bitrate) / sampleRate) + padding;
  return { version, layer, bitrate, sampleRate, channelMode, spf, frameSize };
}

function findFrame(buf, from) {
  const limit = Math.min(buf.length - 4, from + 512 * 1024);
  for (let i = from; i < limit; i++) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const head = frameHeaderAt(buf, i);
      if (head) return { head, at: i };
    }
  }
  return null;
}

function vbrFrames(buf, head, at) {
  const sideInfo = head.version === 1 ? (head.channelMode === 3 ? 17 : 32) : head.channelMode === 3 ? 9 : 17;
  const xingAt = at + 4 + sideInfo;
  const tag = buf.subarray(xingAt, xingAt + 4).toString('latin1');
  if (tag === 'Xing' || tag === 'Info') {
    const flags = buf.readUInt32BE(xingAt + 4);
    if (flags & 0x01) return buf.readUInt32BE(xingAt + 8);
  }
  const vbriAt = at + 4 + 32;
  if (buf.subarray(vbriAt, vbriAt + 4).toString('latin1') === 'VBRI') return buf.readUInt32BE(vbriAt + 14);
  return 0;
}

export function mp3Duration(buf, audioStart, fileSize) {
  const found = findFrame(buf, Math.min(audioStart, buf.length - 4));
  if (!found) return 0;
  const { head, at } = found;
  const frames = vbrFrames(buf, head, at);
  if (frames > 0) return Math.round((frames * head.spf) / head.sampleRate);

  let framesSeen = 0;
  let bytesSeen = 0;
  let p = at;
  while (p + 4 <= buf.length) {
    const h = frameHeaderAt(buf, p);
    if (!h) break;
    framesSeen++;
    bytesSeen += h.frameSize;
    p += h.frameSize;
  }
  if (framesSeen > 8) {
    const audioBytes = fileSize - at;
    const ratio = audioBytes / Math.max(1, bytesSeen);
    const total = Math.round(framesSeen * ratio);
    return Math.round((total * head.spf) / head.sampleRate);
  }
  if (head.bitrate > 0) return Math.round(((fileSize - at) * 8) / head.bitrate);
  return 0;
}

export function parseFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const cleaned = base.replace(/\((?:official\s+)?(?:audio|video|lyrics?|lyric\s+video|official\s+audio|official\s+video|hd|hq|remaster(?:ed)?|\d{4}\s*remaster)[^)]*\)/gi, '').trim();
  const stem = cleaned || base;
  const m = stem.match(/^(.+?)\s+-\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: '', title: stem };
}

function cleanTag(value) {
  if (!value) return '';
  return value.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

export async function readTrackTags(filePath, fileSize) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const length = Math.min(HEADER_BYTES, fileSize);
    const buf = Buffer.alloc(length);
    await handle.read(buf, 0, length, 0);
    const { tags, picture, audioStart } = parseId3(buf);
    const duration = audioStart >= length ? 0 : mp3Duration(buf, audioStart, fileSize);
    return {
      title: cleanTag(tags.title),
      artist: cleanTag(tags.artist),
      album: cleanTag(tags.album),
      genre: cleanTag(tags.genre),
      year: cleanTag(tags.year),
      track: Number.parseInt(tags.track, 10) || 0,
      duration,
      picture
    };
  } finally {
    await handle.close();
  }
}