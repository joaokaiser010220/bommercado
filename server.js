const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve arquivos estáticos (index.html e assets)
app.use(express.static(path.join(__dirname)));

// Carregar keys do disco
const keysFile = path.join(__dirname, 'keys.json');
let keys = [];
try {
  keys = JSON.parse(fs.readFileSync(keysFile));
} catch {
  keys = [];
}

// Salvar keys no disco
function saveKeys() {
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
}

// Party rooms: { partyCode: { clients: Set<WebSocket>, screenStream: any } }
const parties = {};

// Mensagem enviada do cliente (JSON com action)
wss.on('connection', (ws) => {
  ws.party = null;  // qual party entrou
  ws.id = uuidv4();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Mensagem inválida.' }));
    }
  });

  ws.on('close', () => {
    if (ws.party && parties[ws.party]) {
      parties[ws.party].clients.delete(ws);
      broadcastParty(ws.party, { type: 'info', message: `Usuário saiu. (${ws.id.slice(0,6)})` });

      // Se ninguém na party, apaga ela
      if (parties[ws.party].clients.size === 0) {
        delete parties[ws.party];
        // Também remove key se existir
        keys = keys.filter(k => k !== ws.party);
        saveKeys();
      }
    }
  });
});

function handleMessage(ws, data) {
  switch(data.action) {
    case 'create_party': {
      // Cria party com código aleatório (6 chars)
      const partyCode = generatePartyCode();
      parties[partyCode] = { clients: new Set(), screenStream: null };
      parties[partyCode].clients.add(ws);
      ws.party = partyCode;
      keys.push(partyCode);
      saveKeys();

      ws.send(JSON.stringify({ type: 'party_created', partyCode }));
      break;
    }
    case 'join_party': {
      const { partyCode } = data;
      if (!partyCode || !parties[partyCode]) {
        ws.send(JSON.stringify({ type: 'error', message: 'Party não encontrada.' }));
        return;
      }
      parties[partyCode].clients.add(ws);
      ws.party = partyCode;
      ws.send(JSON.stringify({ type: 'party_joined', partyCode }));
      broadcastParty(partyCode, { type: 'info', message: `Novo participante entrou (${ws.id.slice(0,6)})` }, ws);
      break;
    }
    case 'send_message': {
      const { text } = data;
      if (!ws.party || !parties[ws.party]) return;
      broadcastParty(ws.party, { type: 'chat', text: text, from: ws.id.slice(0,6) });
      break;
    }
    case 'share_screen_signal': {
      // Sinaliza para todos da party menos o que enviou
      if (!ws.party || !parties[ws.party]) return;
      broadcastParty(ws.party, { type: 'screen_signal', signal: data.signal, from: ws.id }, ws);
      break;
    }
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Ação desconhecida.' }));
  }
}

function broadcastParty(partyCode, message, excludeWs=null) {
  if (!parties[partyCode]) return;
  const msgStr = JSON.stringify(message);
  for (const client of parties[partyCode].clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(msgStr);
    }
  }
}

function generatePartyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (keys.includes(code));
  return code;
}

// Start server
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
