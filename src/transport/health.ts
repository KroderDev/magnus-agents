import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Logger } from "pino";

export function startHealthServer(port: number, log: Logger): () => void {
  const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
  });

  server.listen(port, () => {
    log.info({ port }, "health server listening");
  });

  return () => {
    server.close();
  };
}
