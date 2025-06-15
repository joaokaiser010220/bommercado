const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const server = http.createServer((req, res) => {
  // Serve index.html
  let filePath = '.' + req.url;
  if (filePath === './') filePath = './index.html';

  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };

  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, function(error, content) {
    if (error) {
      res.writeHead(404);
      res.end('404 - Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

const wss = new WebSocket.Server({ server });

const rooms = {}; // { roomCode: { broadcaster: ws, viewers: Set<WebSocket>, chat: [] } }

function generateRoomCode() {
  return Math.random().toString(36).substr(2, 5);
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.isBroadcaster = false;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    switch(data.type) {
      case 'create-room':
        const code = generateRoomCode();
        rooms[code] = { broadcaster: ws, viewers: new Set(), chat: [] };
        ws.roomCode = code;
        ws.isBroadcaster = true;
        ws.send(JSON.stringify({ type: 'room-created', code }));
        console.log(`Room created: ${code}`);
        break;

      case 'join-room':
        const room = rooms[data.code];
        if (room && room.broadcaster) {
          ws.roomCode = data.code;
          room.viewers.add(ws);
          ws.send(JSON.stringify({ type: 'room-joined', code: data.code }));
          // Notify broadcaster a new viewer joined
          room.broadcaster.send(JSON.stringify({ type: 'viewer-joined' }));
          console.log(`Viewer joined room: ${data.code}`);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Sala não existe ou não há broadcaster' }));
        }
        break;

      case 'signal': 
        // Relay WebRTC signaling data
        const r = rooms[ws.roomCode];
        if (!r) break;
        if (ws.isBroadcaster) {
          // broadcaster sends to viewers
          r.viewers.forEach(viewer => viewer.send(JSON.stringify({ type: 'signal', data: data.data })));
        } else {
          // viewer sends to broadcaster
          if (r.broadcaster) r.broadcaster.send(JSON.stringify({ type: 'signal', data: data.data }));
        }
        break;

      case 'chat-message':
        const roomChat = rooms[ws.roomCode];
        if (!roomChat) break;
        // Broadcast chat to everyone in room
        const chatData = { type: 'chat-message', sender: data.sender, message: data.message };
        roomChat.chat.push(chatData);
        // Limit chat history to 100 messages
        if (roomChat.chat.length > 100) roomChat.chat.shift();
        if (roomChat.broadcaster) roomChat.broadcaster.send(JSON.stringify(chatData));
        roomChat.viewers.forEach(viewer => viewer.send(JSON.stringify(chatData)));
        break;
    }
  });

  ws.on('close', () => {
    if (ws.roomCode && rooms[ws.roomCode]) {
      const r = rooms[ws.roomCode];
      if (ws.isBroadcaster) {
        // Close room and notify viewers
        r.viewers.forEach(v => v.send(JSON.stringify({ type: 'info', message: 'O broadcaster saiu. Sala encerrada.' })));
        r.viewers.forEach(v => v.close());
        delete rooms[ws.roomCode];
        console.log(`Room closed: ${ws.roomCode}`);
      } else {
        // Remove viewer from room
        r.viewers.delete(ws);
      }
    }
  });
});

// Ping clients to keep alive
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
