import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';

const app = express();
const httpServer = http.createServer(app);

// Configure Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app', // Frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
  transports: ['websocket'], // Force WebSocket-only connections
  allowEIO3: true, // Ensure compatibility with WebSocket clients
});

// Handle Socket.io connections
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('message', (data) => {
    console.log('Message received:', data);
    socket.broadcast.emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Configure PeerJS server
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: '/peerjs',
  allow_discovery: true,
});

// Mount PeerJS server to `/peerjs`
app.use('/peerjs', peerServer);

// Test route
app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
