// Player request field mapping: teaoea/shell plugins/YouTube/src/YouTubePlayback.js.
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
      if (wire === 2) {
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
    if (kind === "content" && !inlineWritten) {
      parts.push(encode(400), Uint8Array.of(1));
      changed = true;
    }
    return { body: changed ? join(parts) : bytes, changed };
  }

  try {
    const kind = /\/get_watch(?:\?|$)/.test($request.url) ? "watch" : "player";
    const result = clean(body, kind);
    if (!result.changed) { $done({}); return; }
    const headers = { ...$request.headers };
    for (const key of Object.keys(headers)) if (/^content-(?:length|encoding)$/i.test(key)) delete headers[key];
    $done({ body: result.body, headers });
  } catch (error) {
    console.log("YouTube player request unchanged: " + error.message);
    $done({});
  }
})();
