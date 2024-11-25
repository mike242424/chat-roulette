import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Resolve __dirname and __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express and HTTP server
const app = express();
const httpServer = http.createServer(app);

// Configure Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app', // Frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'], // Allow necessary headers
    credentials: true, // Allow credentials (e.g., cookies)
  },
  transports: ['websocket'], // Use WebSocket transport only
  allowEIO3: true, // Enable compatibility with older Socket.io clients
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('message', (data) => {
    console.log(`Message received: ${data}`);
    socket.broadcast.emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Configure PeerJS
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: '/peerjs',
  allow_discovery: true, // Enable peer discovery
});

// Mount PeerJS server
app.use('/peerjs', peerServer);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Test route
app.get('/', (req, res) => {
  res.send('WebRTC Backend Running!');
});

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
