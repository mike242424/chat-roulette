import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';

const app = express();
const httpServer = http.createServer(app);

// Configure Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app', // Allow your frontend
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
  transports: ['polling', 'websocket'], // Allow fallback to polling
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('message', (data) => {
    console.log(`Message received: ${data}`);
    socket.broadcast.emit('message', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });

  socket.on('error', (error) => {
    console.error(`WebSocket error: ${error}`);
  });
});

// Configure PeerJS
const peerServer = ExpressPeerServer(httpServer, {
  debug: true,
  path: '/', // Use the root path
});

// Add CORS headers for PeerJS
peerServer.on('headers', (headers) => {
  headers['Access-Control-Allow-Origin'] = 'https://chat-roulette.vercel.app';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type';
  headers['Access-Control-Allow-Credentials'] = 'true';
});

app.use('/', peerServer);

app.get('/', (req, res) => {
  res.send('WebRTC Backend Running!');
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
