// 独立广告请求的响应不是 PlayerResponse；返回合法空 Protobuf，避免交给播放器响应解析器。
$done({
  response: {
    status: 200,
    headers: {
      "Content-Type": "application/x-protobuf",
      "Cache-Control": "no-store"
    },
    body: ""
  }
});
