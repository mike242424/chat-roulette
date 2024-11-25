import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';

// Initialize Express app
const app = express();

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.io with explicit WebSocket support
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app', // Frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'], // Allow required headers
    credentials: true, // Allow credentials (cookies, etc.)
  },
  transports: ['websocket'], // Force WebSocket transport
});

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('message', (data) => {
    console.log('Message received:', data);
    socket.broadcast.emit('message', data); // Broadcast the message
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Initialize PeerJS server
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: '/peerjs',
  allow_discovery: true, // Enable peer discovery
});

// Mount PeerJS server to `/peerjs`
app.use('/peerjs', peerServer);

// Serve a simple test route
app.get('/', (req, res) => {
  res.send('WebRTC App Backend Running');
});

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
