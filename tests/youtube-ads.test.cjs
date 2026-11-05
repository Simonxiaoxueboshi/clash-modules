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
vm.runInNewContext(script.replace('try{Ki()}', 'globalThis.predicates={Li,Ir,ni,d};try{Ki()}'), sandbox);
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

test('filters the observed deferred-update path and preserves unrelated protobuf fields', () => {
  function varint(value) {
    const out = [];
    while (value > 127) { out.push((value % 128) | 128); value = Math.floor(value / 128); }
    out.push(value);
    return Buffer.from(out);
  }
  const field = (number, payload) => Buffer.concat([varint(number * 8 + 2), varint(payload.length), payload]);
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
  assert.deepEqual(Buffer.from(output.body), expected);
});
