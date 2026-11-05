// TEMPORARY private LAN probe: reports initplayback request/response bodies and ad media URLs.
(function () {
  const ENDPOINT = "http://192.168.1.26:8766/capture";
  function send(payload, done) {
    $httpClient.post({ url: ENDPOINT, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, function () { done && done(); });
  }
  function base64(input) {
    const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", parts = [];
    for (let i = 0; i < input.length; i += 3) {
      const a = input[i], b = input[i + 1] || 0, c = input[i + 2] || 0;
      parts.push(abc[a >> 2] + abc[((a & 3) << 4) | (b >> 4)] + (i + 1 < input.length ? abc[((b & 15) << 2) | (c >> 6)] : "=") + (i + 2 < input.length ? abc[c & 63] : "="));
    }
    return parts.join("");
  }
  function bytes(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return null;
  }
  if (typeof $response !== "undefined") {
    const body = bytes($response.body);
    send({ stage: "init-resp", path: $request.url.split("?")[0], status: $response.status, length: body ? body.length : -1, body: body ? base64(body) : "" }, function () { $done({}); });
    return;
  }
  const url = $request.url;
  if (/\/initplayback(?:\?|$)/.test(url)) {
    const body = bytes($request.body);
    send({ stage: "init-req", path: url.split("?")[0], length: body ? body.length : -1, body: body ? base64(body) : "" }, function () { $done({}); });
    return;
  }
  if (/videoplayback/.test(url) && /(?:oad|oaad|adformat|ad_type)=/.test(url)) {
    send({ stage: "ad-media", url: url }, function () { $done({}); });
    return;
  }
  $done({});
})();
