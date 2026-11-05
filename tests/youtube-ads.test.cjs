const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const script = fs.readFileSync(path.join(__dirname, '../Resource/JavaScript/YouTube/YouTube_remove_ads/YouTube_remove_ads_response.js'), 'utf8');
// The shipped Loon IIFE has no module exports. Expose its real predicates in an isolated VM.
const sandbox = {
  console: { log() {} }, Uint8Array, ArrayBuffer, TextEncoder, TextDecoder, URL,
  setTimeout, clearTimeout, $loon: 'test', $argument: {},
  $request: { url: 'https://youtubei.googleapis.com/youtubei/v1/browse', method: 'POST', headers: { 'User-Agent': 'com.google.ios.youtube/test' } },
  $response: { status: 200, headers: {}, body: new Uint8Array() },
  $persistentStore: { read: () => null, write: () => true },
  $done() {}, $notification: { post() {} }, $httpClient: {}
};
vm.runInNewContext(script.replace('try{Ki()}', 'globalThis.predicates={Li,Ir,ni,d,Mi};try{Ki()}'), sandbox);
const { Li, Ir, ni, d } = sandbox.predicates;
const bytes = text => new TextEncoder().encode(text);
const ordinary = bytes('ordinary-video-card');
const advertisement = new Uint8Array(1200);
advertisement.set(bytes('https://www.googleadservices.com/pagead/'));
function card(...fields) {
  const message = {};
  for (const [number, payload] of fields) d.onRead('fixture', message, number, 2, payload);
  return message;
}

test('classifies each instance when the renderer number is shared by ordinary cards and ads', () => {
  assert.equal(Li(card([777, ordinary])), false);
  assert.equal(Li(card([777, advertisement])), true);
  assert.equal(Li(card([777, ordinary])), false);
});

test('finds advertising data after a non-advertising unknown field', () => {
  assert.equal(Li(card([1, ordinary], [2, advertisement])), true);
});

test('recognizes a compact ad command map without treating a plain text mention as an ad', () => {
  assert.equal(ni(bytes('\x0a\x10skip_ad_on_block\x12\x01x')), true);
  assert.equal(ni(bytes('A video about skip_ad_on_block')), false);
  assert.equal(ni(bytes('\x0a\x10skip_ad_on_block\x12\x00')), false);
  assert.equal(ni(bytes('pagead')), false);
  assert.equal(ni(42), false);
});

test('removes the ad while preserving neighboring ordinary feed entries', () => {
  const first = card([777, ordinary]);
  const second = card([777, advertisement]);
  const third = card([778, ordinary]);
  const response = { richItemContents: [first, second, third] };
  assert.equal(Ir(response), true);
  assert.deepEqual(response.richItemContents, [first, third]);
});

function varint(value) {
  const out = [];
  while (value > 127) { out.push((value % 128) | 128); value = Math.floor(value / 128); }
  out.push(value);
  return Buffer.from(out);
}
const field = (number, payload) => Buffer.concat([varint(number * 8 + 2), varint(payload.length), payload]);

test('filters the observed deferred-update path and preserves unrelated protobuf fields', () => {
  const normalCard = field(777, Buffer.from(ordinary));
  const adCard = field(777, Buffer.from(advertisement));
  const items = Buffer.concat([field(1, normalCard), field(1, adCard)]);
  const section = field(1, field(50195462, items));
  const rootUnknown = field(777, Buffer.from('retain-this-unmodeled-field'));
  const wrap = sectionList => Buffer.concat([field(10, field(49399797, field(32, field(1, field(6, sectionList))))), rootUnknown]);
  const input = wrap(section);
  const expected = wrap(field(1, field(50195462, field(1, normalCard))));
  let output;
  const runtime = {
    ...sandbox,
    $response: { status: 200, headers: {}, body: new Uint8Array(input) },
    $done(result) { output = result; }
  };
  vm.runInNewContext(script, runtime);
  assert.ok(output.body instanceof Uint8Array);
  const type = sandbox.predicates.Mi.find(api => runtime.$request.url.includes(api.path)).msgType;
  assert.deepEqual(type.fromBinary(Buffer.from(output.body)), type.fromBinary(expected));
});

test('filters next side-panel ads while preserving normal cards and panel metadata', () => {
  const normalCard = field(777, Buffer.from(ordinary));
  const adCard = field(777, Buffer.from(advertisement));
  const metadata = field(1, Buffer.from('panel-metadata'));
  const unknown = field(777, Buffer.from('next-unmodeled-field'));
  const wrap = cards => Buffer.concat([field(15, field(361588638, Buffer.concat([metadata, ...cards.map(card => field(2, card))]))), unknown]);
  let output;
  vm.runInNewContext(script, {
    ...sandbox,
    $request: { ...sandbox.$request, url: 'https://youtubei.googleapis.com/youtubei/v1/next' },
    $response: { status: 200, headers: {}, body: new Uint8Array(wrap([normalCard, adCard])) },
    $done(result) { output = result; }
  });
  assert.ok(output.body instanceof Uint8Array);
  const type = sandbox.predicates.Mi.find(api => 'https://youtubei.googleapis.com/youtubei/v1/next'.includes(api.path)).msgType;
  assert.deepEqual(type.fromBinary(Buffer.from(output.body)), type.fromBinary(wrap([normalCard])));
});

const requestScript = fs.readFileSync(path.join(__dirname, '../Resource/JavaScript/YouTube/YouTube_remove_ads/YouTube_playback_request.js'), 'utf8');
const scalar = (number, value) => Buffer.concat([varint(number * 8), varint(value)]);
function runPlayerRequest(body, endpoint = 'player', bodyValue = new Uint8Array(body)) {
  let output;
  vm.runInNewContext(requestScript, {
    Uint8Array, ArrayBuffer, console: { log() {} },
    $request: { url: `https://youtubei.googleapis.com/youtubei/v1/${endpoint}`, body: bodyValue, headers: { 'Content-Type': 'application/x-protobuf', 'Content-Length': String(body.length), 'Content-Encoding': 'br', 'X-Preserve': 'yes' } },
    $done(result) { output = result; }
  });
  return output;
}

test('removes player ad parameters and preserves video identity and unrelated wire fields', () => {
  const video = field(2, bytes('video-id'));
  const context = field(1, Buffer.concat([field(9, bytes('ad-signals')), field(77, bytes('context-data'))]));
  const content = Buffer.concat([field(12, bytes('vast')), field(25, bytes('forced-ad')), scalar(50, 0), scalar(51, 7)]);
  const unknown = field(777, bytes('retain-this'));
  const input = Buffer.concat([context, video, field(4, field(1, content)), unknown]);
  const expected = Buffer.concat([field(1, field(77, bytes('context-data'))), video, field(4, field(1, Buffer.concat([scalar(50, 1), scalar(51, 7)]))), unknown]);
  const result = runPlayerRequest(input);
  assert.deepEqual(Buffer.from(result.body), expected);
  assert.equal(result.headers['Content-Length'], undefined);
  assert.equal(result.headers['Content-Encoding'], undefined);
  assert.equal(result.headers['X-Preserve'], 'yes');
  assert.equal(result.headers['Content-Type'], 'application/x-protobuf');
  assert.equal(runPlayerRequest(expected).body, undefined);
});

test('cleans get-watch outer context and nested player without removing neighboring fields', () => {
  const context = Buffer.concat([field(9, bytes('ad-signals')), scalar(17, 4)]);
  const player = Buffer.concat([field(1, context), field(2, bytes('video-id')), field(4, field(1, scalar(50, 0)))]);
  const outer = scalar(700, 9);
  const input = Buffer.concat([field(1, context), field(2, player), outer]);
  const expectedPlayer = Buffer.concat([field(1, scalar(17, 4)), field(2, bytes('video-id')), field(4, field(1, scalar(50, 1)))]);
  const expected = Buffer.concat([field(1, scalar(17, 4)), field(2, expectedPlayer), outer]);
  assert.deepEqual(Buffer.from(runPlayerRequest(input, 'get_watch').body), expected);
});

test('normalizes duplicate no-ad flags and leaves malformed requests untouched', () => {
  const wrap = content => field(4, field(1, content));
  assert.deepEqual(Buffer.from(runPlayerRequest(wrap(Buffer.concat([scalar(50, 1), scalar(50, 0)]))).body), wrap(scalar(50, 1)));
  for (const input of [Buffer.from([10, 3, 1]), Buffer.from([0]), Buffer.from([8, 128]), field(4, Buffer.from([10, 3, 1]))]) {
    const result = runPlayerRequest(input);
    assert.equal(result.body, undefined);
    assert.equal(result.headers, undefined);
  }
});

test('reads ArrayBuffer bodies and respects the bounds of offset binary views', () => {
  const input = field(4, field(1, scalar(50, 0)));
  const expected = field(4, field(1, scalar(50, 1)));
  const backing = new Uint8Array(input.length + 8).fill(255);
  backing.set(input, 4);
  const inputs = [new Uint8Array(input).buffer, new DataView(backing.buffer, 4, input.length)];
  for (const body of inputs) assert.deepEqual(Buffer.from(runPlayerRequest(input, 'player', body).body), expected);
});

const onesieCrypto = Buffer.concat([field(2, Buffer.alloc(24, 0xa1)), field(5, Buffer.alloc(32, 0xb2)), field(6, Buffer.alloc(16, 0xc3)), field(7, Buffer.alloc(32, 0xd4))]);
test('disables an existing Onesie preroll flag without changing any encrypted or unrelated bytes', () => {
  const unknown = field(777, bytes('preserve-envelope-metadata'));
  const wrap = flag => Buffer.concat([scalar(8, 3), field(3, Buffer.concat([onesieCrypto, flag, unknown])), field(900, bytes('root-metadata'))]);
  const input = wrap(scalar(13, 1));
  const output = Buffer.from(runPlayerRequest(input, 'initplayback').body);
  assert.deepEqual(output, wrap(scalar(13, 0)));
  assert.equal(output.filter((value, index) => value !== input[index]).length, 1);
  assert.equal(runPlayerRequest(output, 'initplayback').body, undefined);
});

test('adds an explicit disabled preroll flag only to a complete Onesie envelope', () => {
  const input = field(3, onesieCrypto);
  assert.deepEqual(Buffer.from(runPlayerRequest(input, 'initplayback').body), field(3, Buffer.concat([onesieCrypto, scalar(13, 0)])));
  assert.equal(runPlayerRequest(field(3, field(2, bytes('incomplete'))), 'initplayback').body, undefined);
  assert.equal(runPlayerRequest(Buffer.alloc(0), 'initplayback').body, undefined);
});

test('keeps ambiguous or invalid Onesie envelopes unchanged', () => {
  const invalid = [
    field(3, Buffer.concat([onesieCrypto, scalar(13, 2)])),
    field(3, Buffer.concat([onesieCrypto, scalar(13, 1), scalar(13, 0)])),
    field(3, Buffer.concat([onesieCrypto, field(6, Buffer.alloc(16))])),
    Buffer.concat([field(3, onesieCrypto), field(3, onesieCrypto)]),
    field(3, Buffer.concat([field(2, bytes('cipher')), field(5, bytes('key')), field(6, Buffer.alloc(15)), field(7, Buffer.alloc(32)), scalar(13, 1)]))
  ];
  for (const input of invalid) assert.equal(runPlayerRequest(input, 'initplayback').body, undefined);
});


// --- The pre-roll configuration lives inside the authenticated Onesie envelope.
const nodeCrypto = require('node:crypto');
const zlib = require('node:zlib');
const innerMeta = () => field(9, bytes('inner-metadata'));
const innerPlain = body => Buffer.concat([field(3, body), innerMeta()]);
function runOnesieRequest(body, { key, store } = {}) {
  let output;
  const utils = { gzip: value => zlib.gzipSync(Buffer.from(value)), ungzip: value => zlib.gunzipSync(Buffer.from(value)) };
  vm.runInNewContext(requestScript, {
    Uint8Array, ArrayBuffer, console: { log() {} }, $utils: utils,
    $request: { url: 'https://rr1---sn-a5mlrnek.googlevideo.com/initplayback?source=youtube&c=IOS&oad=5500', body: new Uint8Array(body), headers: { 'User-Agent': 'com.google.ios.youtube/21.42.4' } },
    $persistentStore: { read: () => store === undefined ? JSON.stringify({ youtube: { clientKey: key.toString('base64') } }) : store, write: () => true },
    $done(result) { output = result; }
  });
  return output;
}
const seal = (inner, key, iv) => ({
  cipher: nodeCrypto.createCipheriv('aes-128-ctr', key.subarray(0, 16), iv).update(inner),
  mac: null
});
function sealMac(inner, key, iv) {
  const cipher = nodeCrypto.createCipheriv('aes-128-ctr', key.subarray(0, 16), iv).update(inner);
  return { cipher, mac: nodeCrypto.createHmac('sha256', key.subarray(16)).update(Buffer.concat([cipher, iv])).digest() };
}
const open = (cipher, key, iv) => nodeCrypto.createDecipheriv('aes-128-ctr', key.subarray(0, 16), iv).update(cipher);
function parseFields(payload) {
  const out = {};
  for (let cursor = 0; cursor < payload.length;) {
    let key = 0, scale = 1, byte;
    do { byte = payload[cursor++]; key += (byte & 127) * scale; scale *= 128; } while (byte & 128);
    const number = Math.floor(key / 8), wire = key % 8;
    if (wire === 0) {
      let value = 0; scale = 1;
      do { byte = payload[cursor++]; value += (byte & 127) * scale; scale *= 128; } while (byte & 128);
      (out[number] ||= []).push(value);
    } else if (wire === 2) {
      let size = 0; scale = 1;
      do { byte = payload[cursor++]; size += (byte & 127) * scale; scale *= 128; } while (byte & 128);
      (out[number] ||= []).push(payload.subarray(cursor, cursor + size)); cursor += size;
    } else throw new Error('unsupported wire ' + wire);
  }
  return out;
}
const innerContext = () => Buffer.concat([field(9, bytes('ad-signals')), field(77, bytes('context-data'))]);
const innerContent = () => Buffer.concat([field(12, bytes('vast')), field(25, bytes('forced-ad')), scalar(50, 0), scalar(51, 7)]);
const innerBody = () => Buffer.concat([field(1, innerContext()), field(2, bytes('video-id')), field(4, Buffer.concat([field(1, innerContent()), field(8, bytes('playback-meta'))]))]);
const cleanBody = () => Buffer.concat([field(1, field(77, bytes('context-data'))), field(2, bytes('video-id')), field(4, Buffer.concat([field(1, Buffer.concat([scalar(50, 1), scalar(51, 7)])), field(8, bytes('playback-meta'))]))]);
function envelopeOf(key, iv, plain, sealed) {
  sealed = sealed || sealMac(plain, key, iv);
  return Buffer.concat([
    field(1, Buffer.alloc(24, 0xa1)), field(2, sealed.cipher), field(5, key), field(6, iv), field(7, sealed.mac),
    field(8, Buffer.alloc(1, 1)), scalar(13, 0), field(777, bytes('envelope-metadata'))
  ]);
}
const rootOf = envelope => Buffer.concat([
  field(2, Buffer.alloc(101, 0x5a)), field(3, envelope), field(4, Buffer.alloc(40, 0x5b)),
  scalar(13, 1), field(14, Buffer.alloc(9, 0x5c)), field(900, bytes('root-metadata'))
]);
const fixedKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index * 7 + 1));
const fixedIv = Buffer.from(Array.from({ length: 16 }, (_, index) => 200 - index));

test('rewrites the authenticated Onesie inner payload so the pre-roll ad parameters disappear', () => {
  const input = rootOf(envelopeOf(fixedKey, fixedIv, innerPlain(innerBody())));
  const output = Buffer.from(runOnesieRequest(input, { key: fixedKey }).body);
  const root = parseFields(output), before = parseFields(input);
  assert.deepEqual(root[2], before[2]);
  assert.deepEqual(root[4], before[4]);
  assert.deepEqual(root[14], before[14]);
  assert.deepEqual(root[900], before[900]);
  const envelope = parseFields(root[3][0]), old = parseFields(before[3][0]);
  assert.equal(envelope[13][0], 0);
  assert.deepEqual(envelope[1], old[1]);
  assert.deepEqual(envelope[5], old[5]);
  assert.deepEqual(envelope[6], old[6]);
  assert.deepEqual(envelope[777], old[777]);
  assert.equal(nodeCrypto.createHmac('sha256', fixedKey.subarray(16)).update(Buffer.concat([envelope[2][0], fixedIv])).digest('hex'), envelope[7][0].toString('hex'));
  assert.deepEqual(Buffer.from(open(envelope[2][0], fixedKey, fixedIv)), innerPlain(cleanBody()));
  assert.equal(runOnesieRequest(output, { key: fixedKey }).body, undefined);
});

test('rewrites a gzip-compressed Onesie inner payload and keeps it decryptable', () => {
  const input = rootOf(envelopeOf(fixedKey, fixedIv, zlib.gzipSync(innerPlain(innerBody()))));
  const output = Buffer.from(runOnesieRequest(input, { key: fixedKey }).body);
  const envelope = parseFields(parseFields(output)[3][0]);
  assert.equal(nodeCrypto.createHmac('sha256', fixedKey.subarray(16)).update(Buffer.concat([envelope[2][0], fixedIv])).digest('hex'), envelope[7][0].toString('hex'));
  assert.deepEqual(zlib.gunzipSync(Buffer.from(open(envelope[2][0], fixedKey, fixedIv))), innerPlain(cleanBody()));
});

test('leaves the Onesie envelope untouched when authentication or the stored key fails', () => {
  const input = rootOf(envelopeOf(fixedKey, fixedIv, innerPlain(innerBody())));
  assert.equal(runOnesieRequest(input, { key: Buffer.alloc(32, 3) }).body, undefined);
  const sealed = sealMac(innerPlain(innerBody()), fixedKey, fixedIv);
  sealed.cipher[1] ^= 0xff;
  assert.equal(runOnesieRequest(rootOf(envelopeOf(fixedKey, fixedIv, null, sealed)), { key: fixedKey }).body, undefined);
  for (const store of [null, '{}', 'not-json', JSON.stringify({ youtube: { clientKey: 'AAAA' } })]) {
    assert.equal(runOnesieRequest(input, { key: fixedKey, store }).body, undefined);
  }
});

test('keeps a decrypted Onesie payload byte-identical when it carries no ad parameters', () => {
  const input = rootOf(envelopeOf(fixedKey, fixedIv, innerPlain(cleanBody())));
  assert.equal(runOnesieRequest(input, { key: fixedKey }).body, undefined);
});
