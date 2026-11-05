// Temporary private LAN capture of raw and filtered initialization requests.
(function () {
  if (!/\/initplayback(?:\?|$)/.test($request.url)) return;
  const finish = $done;
  const path = $request.url.split('?')[0];
  function bytes(body) { return body instanceof Uint8Array ? body : body instanceof ArrayBuffer ? new Uint8Array(body) : null; }
  function upload(body, stage, callback) {
    const input = bytes(body);
    if (!input) { callback(); return; }
    const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', parts = [];
    for (let i=0; i<input.length; i+=3) {
      const a=input[i],b=input[i+1]||0,c=input[i+2]||0;
      parts.push(abc[a>>2]+abc[((a&3)<<4)|(b>>4)]+(i+1<input.length?abc[((b&15)<<2)|(c>>6)]:'=')+(i+2<input.length?abc[c&63]:'='));
    }
    $httpClient.post({url:'http://192.168.1.26:8766/capture',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,stage,body:parts.join('')})},callback);
  }
  let rawPending=true, outputPending=true, result, called=false, finished=false;
  function flush(){ if(called&&!rawPending&&!outputPending&&!finished){finished=true;finish(result);} }
  setTimeout(function(){rawPending=false;outputPending=false;flush();},5000);
  upload($request.body,'raw',function(){rawPending=false;flush();});
  $done=function(value){result=value;called=true;upload(value&&value.body!==undefined?value.body:$request.body,'filtered',function(){outputPending=false;flush();});};
})();
// Protocol fields: teaoea/shell plugins/YouTube/src/{YouTubePlayback,YouTubeConfig}.js.
// Preserve all unrelated protobuf fields and their original wire bytes.
(() => {
  const rawBody = $request.body;
  const body = rawBody instanceof Uint8Array ? rawBody
    : rawBody instanceof ArrayBuffer ? new Uint8Array(rawBody)
    : ArrayBuffer.isView(rawBody) ? new Uint8Array(rawBody.buffer, rawBody.byteOffset, rawBody.byteLength) : null;
  if (!body) { $done({}); return; }

  function uint(bytes, cursor) {
    let value = 0, scale = 1;
    for (let n = 0; n < 5 && cursor.pos < bytes.length; n++) {
      const byte = bytes[cursor.pos++];
      value += (byte & 127) * scale;
      if (byte < 128 && value <= 0xffffffff) return value;
      scale *= 128;
    }
    throw new Error("Invalid protobuf key or length");
  }
  function encode(value) {
    const bytes = [];
    do { const byte = value % 128; value = Math.floor(value / 128); bytes.push(byte | (value ? 128 : 0)); } while (value);
    return Uint8Array.from(bytes);
  }
  function join(parts) {
    const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }
  function clean(bytes, kind) {
    const cursor = { pos: 0 }, parts = [];
    let changed = false, inlineWritten = false;
    let envelopeSeen = false, prerollSeen = false;
    const cryptoLengths = kind === "onesie" ? { 2: -1, 5: -1, 6: -1, 7: -1 } : null;
    while (cursor.pos < bytes.length) {
      const start = cursor.pos, key = uint(bytes, cursor), field = Math.floor(key / 8), wire = key % 8;
      if (!field) throw new Error("Invalid protobuf field zero");
      let dataStart = cursor.pos, dataEnd;
      if (wire === 2) {
        const size = uint(bytes, cursor);
        dataStart = cursor.pos;
        cursor.pos += size;
      } else if (wire === 0) {
        let ended = false;
        for (let n = 0; n < 10 && cursor.pos < bytes.length; n++) {
          const byte = bytes[cursor.pos++];
          if (byte < 128) { if (n === 9 && byte > 1) break; ended = true; break; }
        }
        if (!ended) throw new Error("Invalid protobuf varint");
      } else if (wire === 1) cursor.pos += 8;
      else if (wire === 5) cursor.pos += 4;
      else throw new Error("Unsupported protobuf wire type");
      dataEnd = cursor.pos;
      if (dataEnd > bytes.length) throw new Error("Truncated protobuf field");

      if (cryptoLengths && Object.prototype.hasOwnProperty.call(cryptoLengths, field)) {
        if (wire !== 2 || cryptoLengths[field] !== -1) throw new Error("Invalid or duplicate Onesie crypto field");
        cryptoLengths[field] = dataEnd - dataStart;
      }
      if (kind === "onesie" && field === 13) {
        if (prerollSeen || wire !== 0 || dataEnd - dataStart !== 1 || bytes[dataStart] > 1) throw new Error("Invalid or duplicate Onesie preroll flag");
        prerollSeen = true;
        if (bytes[dataStart] === 0) parts.push(bytes.subarray(start, dataEnd));
        else { parts.push(encode(104), Uint8Array.of(0)); changed = true; }
        continue;
      }

      if (kind === "context" && field === 9 && wire === 2 ||
          kind === "content" && (field === 12 || field === 25) && wire === 2) {
        changed = true;
        continue;
      }
      if (kind === "content" && field === 50 && wire === 0) {
        if (!inlineWritten && dataEnd - dataStart === 1 && bytes[dataStart] === 1) parts.push(bytes.subarray(start, dataEnd));
        else {
          if (!inlineWritten) parts.push(encode(400), Uint8Array.of(1));
          changed = true;
        }
        inlineWritten = true;
        continue;
      }
      let childKind;
      if (kind === "init" && field === 3) {
        if (wire !== 2 || envelopeSeen) throw new Error("Invalid or duplicate Onesie envelope");
        envelopeSeen = true;
        childKind = "onesie";
      } else if (wire === 2) {
        if (kind === "watch") childKind = field === 1 ? "context" : field === 2 ? "player" : undefined;
        else if (kind === "player") childKind = field === 1 ? "context" : field === 4 ? "playback" : undefined;
        else if (kind === "playback" && field === 1) childKind = "content";
      }
      const child = childKind ? clean(bytes.subarray(dataStart, dataEnd), childKind) : null;
      if (child && child.changed) {
        parts.push(encode(key), encode(child.body.length), child.body);
        changed = true;
      } else parts.push(bytes.subarray(start, dataEnd));
    }
    if (cryptoLengths) {
      if (cryptoLengths[2] <= 0 || cryptoLengths[5] <= 0 || cryptoLengths[6] !== 16 || cryptoLengths[7] !== 32) return { body: bytes, changed: false };
      if (!prerollSeen) { parts.push(encode(104), Uint8Array.of(0)); changed = true; }
    }
    if (kind === "content" && !inlineWritten) {
      parts.push(encode(400), Uint8Array.of(1));
      changed = true;
    }
    return { body: changed ? join(parts) : bytes, changed };
  }

  try {
    const kind = /\/initplayback(?:\?|$)/.test($request.url) ? "init" : /\/get_watch(?:\?|$)/.test($request.url) ? "watch" : "player";
    const result = clean(body, kind);
    if (!result.changed) { $done({}); return; }
    const headers = { ...$request.headers };
    for (const key of Object.keys(headers)) if (/^content-(?:length|encoding)$/i.test(key)) delete headers[key];
    $done({ body: result.body, headers });
  } catch (error) {
    console.log("YouTube playback request unchanged: " + error.message);
    $done({});
  }
})();
