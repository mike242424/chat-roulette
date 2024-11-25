import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';

const app = express();
const httpServer = http.createServer(app);

// Configure Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app', // Frontend domain
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
    allowEIO3: true,
  },
  transports: ['websocket', 'polling'], // WebSocket with fallback
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('peer-id', (peerId) => {
    console.log(`Received peer ID: ${peerId}`);
    socket.peerId = peerId;
  });

  socket.on('message', (data) => {
    console.log(`Message received: ${data}`);
    socket.broadcast.emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Configure PeerJS Server
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: '/peerjs', // Mount PeerJS at `/peerjs`
});

// Add CORS headers for PeerJS
peerServer.on('headers', (headers) => {
  headers['Access-Control-Allow-Origin'] = 'https://chat-roulette.vercel.app';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type';
  headers['Access-Control-Allow-Credentials'] = 'true';
});

// Mount PeerJS
app.use('/peerjs', peerServer);

// Root route (for testing)
app.get('/', (req, res) => {
  res.send('WebRTC Backend Running!');
});

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
