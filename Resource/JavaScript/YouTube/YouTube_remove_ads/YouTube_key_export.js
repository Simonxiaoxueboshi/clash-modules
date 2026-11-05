// Temporary private export for validating local Onesie decryption. No cloud receiver.
$httpClient.post({
  url: "http://192.168.1.26:8766/capture",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ path: "local-onesie-state", body: "", config: $persistentStore.read("YouTubeConfig") })
}, () => $done({}));
