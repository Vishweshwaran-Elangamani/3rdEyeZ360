const http = require("http");
const httpProxy = require("http-proxy");

const proxy = httpProxy.createProxyServer({
  target: "http://192.168.62.164:3000",
  changeOrigin: true,
  ws: true,
});

proxy.on("error", (error, request, response) => {
  console.error("[Proxy Error]", error.message);

  if (
    response &&
    typeof response.writeHead === "function" &&
    !response.headersSent
  ) {
    response.writeHead(502, {
      "Content-Type": "application/json",
    });

    response.end(
      JSON.stringify({
        detail: "Unable to reach the shared backend",
        error: error.message,
      }),
    );
  }
});

const server = http.createServer((request, response) => {
  proxy.web(request, response);
});

server.on("upgrade", (request, socket, head) => {
  proxy.ws(request, socket, head);
});

server.listen(3000, "127.0.0.1", () => {
  console.log("3rdEyeZ360 proxy started");
  console.log("Local:  http://localhost:3000");
  console.log("Server: http://192.168.62.164:3000");
});