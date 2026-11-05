// Empty UMP initialization makes the iOS client request a normal player response.
$done({
  response: {
    status: 200,
    headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    body: new Uint8Array(0)
  }
});
