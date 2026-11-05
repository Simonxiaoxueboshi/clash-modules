// Protocol fields: teaoea/shell plugins/YouTube/src/{YouTubePlayback,YouTubeConfig}.js.
// Preserve all unrelated protobuf fields and their original wire bytes.
// Pre-roll configuration travels inside the authenticated Onesie envelope: rewrite it only
// after the stored client key authenticates the payload, and never touch unverified bytes.
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

  // Crypto primitives are MIT licensed, Copyright (c) 2024 可莉唯一的狗,
  // from https://github.com/teaoea/shell plugins/YouTube/src/YouTubeConfig.js.
  function fail(code) { throw new Error(code); }
  var AES_SBOX=new Uint8Array([99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22]);
  function sha256(data){var constants=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];var length=data.length,total=Math.ceil((length+9)/64)*64,buffer=new Uint8Array(total),view=new DataView(buffer.buffer),bits=length*8;buffer.set(data);buffer[length]=128;view.setUint32(total-8,Math.floor(bits/4294967296));view.setUint32(total-4,bits>>>0);var hash=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],words=new Uint32Array(64);for(var offset=0;offset<total;offset+=64){for(var i=0;i<16;i++)words[i]=view.getUint32(offset+i*4);for(i=16;i<64;i++){var s0=rotate(words[i-15],7)^rotate(words[i-15],18)^(words[i-15]>>>3),s1=rotate(words[i-2],17)^rotate(words[i-2],19)^(words[i-2]>>>10);words[i]=(words[i-16]+s0+words[i-7]+s1)>>>0;}var a=hash[0],b=hash[1],c=hash[2],d=hash[3],e=hash[4],f=hash[5],g=hash[6],h=hash[7];for(i=0;i<64;i++){var upper=rotate(e,6)^rotate(e,11)^rotate(e,25),choice=(e&f)^(~e&g),t1=(h+upper+choice+constants[i]+words[i])>>>0,lower=rotate(a,2)^rotate(a,13)^rotate(a,22),majority=(a&b)^(a&c)^(b&c),t2=(lower+majority)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}hash[0]=(hash[0]+a)>>>0;hash[1]=(hash[1]+b)>>>0;hash[2]=(hash[2]+c)>>>0;hash[3]=(hash[3]+d)>>>0;hash[4]=(hash[4]+e)>>>0;hash[5]=(hash[5]+f)>>>0;hash[6]=(hash[6]+g)>>>0;hash[7]=(hash[7]+h)>>>0;}var result=new Uint8Array(32),resultView=new DataView(result.buffer);for(i=0;i<8;i++)resultView.setUint32(i*4,hash[i]);return result;}
  function hmac256(key,data){if(key.length>64)key=sha256(key);var inner=new Uint8Array(64+data.length),outer=new Uint8Array(96);for(var i=0;i<64;i++){var value=i<key.length?key[i]:0;inner[i]=value^54;outer[i]=value^92;}inner.set(data,64);outer.set(sha256(inner),64);return sha256(outer);}
  function aesSchedule(key){if(!key||key.length!==16)fail("invalid-aes-key");var expanded=new Uint8Array(176);expanded.set(key);var generated=16,rcon=1,temp=new Uint8Array(4);while(generated<176){for(var i=0;i<4;i++)temp[i]=expanded[generated-4+i];if(generated%16===0){var first=temp[0];temp[0]=AES_SBOX[temp[1]]^rcon;temp[1]=AES_SBOX[temp[2]];temp[2]=AES_SBOX[temp[3]];temp[3]=AES_SBOX[first];rcon=((rcon<<1)^((rcon&128)?27:0))&255;}for(i=0;i<4;i++){expanded[generated]=expanded[generated-16]^temp[i];generated++;}}return expanded;}
  function aesBlock(input,roundKeys){var state=new Uint8Array(input),round,i,column,a0,a1,a2,a3,t;/**
 * 功能：执行 addKey 对应的内部处理步骤。
 * 更新时间：2026-10-04T08:54:22+08:00
 */
function addKey(offset){for(i=0;i<16;i++)state[i]^=roundKeys[offset+i];}/**
 * 功能：执行 xtime 对应的内部处理步骤。
 * 更新时间：2026-10-04T08:54:22+08:00
 */
function xtime(value){return ((value<<1)^((value&128)?27:0))&255;}addKey(0);for(round=1;round<=10;round++){for(i=0;i<16;i++)state[i]=AES_SBOX[state[i]];t=state[1];state[1]=state[5];state[5]=state[9];state[9]=state[13];state[13]=t;t=state[2];state[2]=state[10];state[10]=t;t=state[6];state[6]=state[14];state[14]=t;t=state[3];state[3]=state[15];state[15]=state[11];state[11]=state[7];state[7]=t;if(round<10)for(column=0;column<4;column++){i=column*4;a0=state[i];a1=state[i+1];a2=state[i+2];a3=state[i+3];t=a0^a1^a2^a3;state[i]=a0^t^xtime(a0^a1);state[i+1]=a1^t^xtime(a1^a2);state[i+2]=a2^t^xtime(a2^a3);state[i+3]=a3^t^xtime(a3^a0);}addKey(round*16);}return state;}
  function addKey(offset){for(i=0;i<16;i++)state[i]^=roundKeys[offset+i];}
  function xtime(value){return ((value<<1)^((value&128)?27:0))&255;}
  function rotate(value,bits){return (value>>>bits)|(value<<(32-bits));}
  function aesCtr(data,key,iv){if(!iv||iv.length!==16)fail("invalid-aes-iv");var roundKeys=aesSchedule(key),counter=new Uint8Array(iv),output=new Uint8Array(data.length);for(var offset=0;offset<data.length;offset+=16){var stream=aesBlock(counter,roundKeys),length=Math.min(16,data.length-offset);for(var i=0;i<length;i++)output[offset+i]=data[offset+i]^stream[i];incrementCounter(counter);}return output;}
  function incrementCounter(counter){for(var i=15;i>=0;i--){counter[i]=(counter[i]+1)&255;if(counter[i]!==0)return;}}
  function unbase64(text){var alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",clean=String(text||"").replace(/\s+/g,""),out=[];if(!clean||clean.length%4)fail("invalid-base64");for(var i=0;i<clean.length;i+=4){var a=alphabet.indexOf(clean[i]),b=alphabet.indexOf(clean[i+1]),c=clean[i+2]==="="?-1:alphabet.indexOf(clean[i+2]),d=clean[i+3]==="="?-1:alphabet.indexOf(clean[i+3]);if(a<0||b<0||(c<0&&clean[i+2]!=="=")||(d<0&&clean[i+3]!=="=")||(c<0&&d>=0)||(i+4<clean.length&&(c<0||d<0)))fail("invalid-base64");out.push((a<<2)|(b>>4));if(c>=0)out.push(((b&15)<<4)|(c>>2));if(d>=0)out.push(((c&3)<<6)|d);}return new Uint8Array(out);}
  function equal(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let n = 0; n < a.length; n++) if (a[n] !== b[n]) return false;
    return true;
  }
  function toBytes(value) {
    return value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value)
      : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : null;
  }
  function records(bytes) {
    const out = [], cursor = { pos: 0 };
    while (cursor.pos < bytes.length) {
      const start = cursor.pos, key = uint(bytes, cursor), field = Math.floor(key / 8), wire = key % 8;
      if (!field) throw new Error("Invalid protobuf field zero");
      let dataStart = cursor.pos;
      if (wire === 2) { const size = uint(bytes, cursor); dataStart = cursor.pos; cursor.pos += size; }
      else if (wire === 0) {
        let ended = false;
        for (let n = 0; n < 10 && cursor.pos < bytes.length; n++) {
          const byte = bytes[cursor.pos++];
          if (byte < 128) { if (n === 9 && byte > 1) break; ended = true; break; }
        }
        if (!ended) throw new Error("Invalid protobuf varint");
      } else if (wire === 1) cursor.pos += 8;
      else if (wire === 5) cursor.pos += 4;
      else throw new Error("Unsupported protobuf wire type");
      if (cursor.pos > bytes.length) throw new Error("Truncated protobuf field");
      out.push({ field, wire, start, dataStart, dataEnd: cursor.pos });
    }
    return out;
  }
  function single(list, no) { const hit = list.filter((record) => record.field === no); return hit.length === 1 ? hit[0] : null; }
  function fieldBytes(bytes, list, no) { const hit = single(list, no); return hit && hit.wire === 2 ? bytes.subarray(hit.dataStart, hit.dataEnd) : null; }
  function frame(field, payload) { return join([encode(field * 8 + 2), encode(payload.length), payload]); }
  function storedClientKey() {
    try {
      if (typeof $persistentStore === "undefined") return null;
      const config = JSON.parse($persistentStore.read("YouTubeConfig") || "{}") || {};
      const agent = String($request.headers["user-agent"] || $request.headers["User-Agent"] || "");
      const entry = config[/music/i.test(agent) ? "youtubeMusic" : "youtube"];
      if (!entry || typeof entry.clientKey !== "string") return null;
      const key = unbase64(entry.clientKey);
      return key && key.length === 32 ? key : null;
    } catch (error) { return null; }
  }
  function inflate(bytes) {
    if (!(bytes.length >= 2 && bytes[0] === 31 && bytes[1] === 139)) return { bytes, gzip: false };
    if (typeof $utils === "undefined" || typeof $utils.ungzip !== "function") return null;
    const restored = toBytes($utils.ungzip(bytes));
    return restored && restored.length ? { bytes: restored, gzip: true } : null;
  }
  function deflate(bytes) {
    if (typeof $utils === "undefined" || typeof $utils.gzip !== "function") return null;
    const output = toBytes($utils.gzip(bytes));
    return output && output.length ? output : null;
  }
  // The pre-roll configuration travels inside the authenticated Onesie envelope, so the
  // plain request fields are not enough. Only rewrite when the stored key authenticates
  // the payload and the decrypted player body actually carried ad parameters.
  let outcome = "unknown";
  const miss = (code) => { outcome = code; return null; };
  function rewriteOnesie(bytes) {
    outcome = "unknown";
    const root = records(bytes);
    const outer = single(root, 3);
    if (!outer || outer.wire !== 2) return miss("no-envelope");
    const envelope = bytes.subarray(outer.dataStart, outer.dataEnd);
    const fields = records(envelope);
    const cipher = fieldBytes(envelope, fields, 2), iv = fieldBytes(envelope, fields, 6), mac = fieldBytes(envelope, fields, 7);
    if (!cipher || !iv || !mac || !cipher.length || iv.length !== 16 || mac.length !== 32) return miss("bad-envelope");
    if (!fieldBytes(envelope, fields, 5)) return miss("bad-envelope");
    const clientKey = storedClientKey();
    if (!clientKey) return miss("no-key");
    if (!equal(hmac256(clientKey.subarray(16), join([cipher, iv])), mac)) return miss("bad-mac");
    const plain = inflate(aesCtr(cipher, clientKey.subarray(0, 16), iv));
    if (!plain) return miss("bad-plain");
    const inner = records(plain.bytes);
    const bodies = inner.filter((record) => record.field === 3 && record.wire === 2);
    if (bodies.length !== 1) return miss("bad-inner");
    const cleaned = clean(plain.bytes.subarray(bodies[0].dataStart, bodies[0].dataEnd), "player");
    if (!cleaned.changed) return miss("no-ad-params");
    const rebuilt = join(inner.map((record) => record === bodies[0] ? frame(3, cleaned.body) : plain.bytes.subarray(record.start, record.dataEnd)));
    const compressed = plain.gzip ? deflate(rebuilt) : rebuilt;
    if (!compressed) return miss("bad-plain");
    const newCipher = aesCtr(compressed, clientKey.subarray(0, 16), iv);
    if (newCipher.length !== compressed.length) return miss("bad-plain");
    const newMac = hmac256(clientKey.subarray(16), join([newCipher, iv]));
    const newEnvelope = join(fields.map((record) => {
      if (record.field === 2 && record.wire === 2) return frame(2, newCipher);
      if (record.field === 7 && record.wire === 2) return frame(7, newMac);
      return envelope.subarray(record.start, record.dataEnd);
    }));
    outcome = "rewritten";
    return join(root.map((record) => record === outer ? frame(3, newEnvelope) : bytes.subarray(record.start, record.dataEnd)));
  }
  const settings = (() => { try { return JSON.parse(typeof $argument === "string" ? $argument : "{}") || {}; } catch (error) { return {}; } })();
  const verbose = settings.debug === true || String(settings.debug).toLowerCase() === "true";
  const OUTCOME = {
    rewritten: "已改写加密信封",
    "no-key": "未取到密钥（YouTubeConfig 无 clientKey），仅置标志",
    "bad-mac": "密钥校验失败，原样放行",
    "no-ad-params": "信封内无广告参数，原样放行",
    "no-envelope": "未找到加密信封，原样放行"
  };
  function report() {
    if (!verbose) return;
    try { $notification.post("YouTube片头广告", "", OUTCOME[outcome] || ("原样放行：" + outcome)); } catch (error) {}
  }

  try {
    const kind = /\/initplayback(?:\?|$)/.test($request.url) ? "init" : /\/get_watch(?:\?|$)/.test($request.url) ? "watch" : "player";
    let result = clean(body, kind);
    if (kind === "init") {
      const rewritten = rewriteOnesie(result.changed ? result.body : body);
      if (rewritten) result = { body: rewritten, changed: true };
      report();
    }
    if (!result.changed) { $done({}); return; }
    const headers = { ...$request.headers };
    for (const key of Object.keys(headers)) if (/^content-(?:length|encoding)$/i.test(key)) delete headers[key];
    $done({ body: result.body, headers });
  } catch (error) {
    console.log("YouTube playback request unchanged: " + error.message);
    $done({});
  }
})();
