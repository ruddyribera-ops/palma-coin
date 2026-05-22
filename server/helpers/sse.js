// Shared SSE client set — used by both sseMiddleware and broadcast
const sseClients = new Set();

export function sseMiddleware(req, res, next) {
  if (req.path === '/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: {"type":"connected"}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }
  next();
}

export function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => client.write(msg));
}

export { sseClients };

export default { sseClients, sseMiddleware, broadcast };
