import { Server } from 'socket.io';
import http from 'http';
import express from 'express';
import { ExpressPeerServer } from 'peer';

const app = express();
const httpServer = http.createServer(app);

// Configure Socket.io server with proper CORS
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app', // Frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'], // Allow necessary headers
    credentials: true, // Allow credentials
  },
  transports: ['websocket', 'polling'], // Ensure WebSocket transport
});

const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  socket.on('peer-id', (peerId) => {
    socket.peerId = peerId;

    if (waitingQueue.length > 0) {
      const partnerSocket = waitingQueue.shift();
      pairedUsers.set(socket.id, partnerSocket.id);
      pairedUsers.set(partnerSocket.id, socket.id);

      socket.emit('paired', { partnerId: partnerSocket.peerId });
      partnerSocket.emit('paired', { partnerId: socket.peerId });
    } else {
      waitingQueue.push(socket);
      socket.emit('waiting');
    }
  });

  socket.on('message', ({ text }) => {
    const partnerSocketId = pairedUsers.get(socket.id);
    if (partnerSocketId) {
      const recipient = io.sockets.sockets.get(partnerSocketId);
      if (recipient) {
        recipient.emit('message', { from: 'Partner', text });
      }
    }
  });

  socket.on('disconnect', () => {
    const partnerId = pairedUsers.get(socket.id);
    pairedUsers.delete(socket.id);

    if (partnerId) {
      pairedUsers.delete(partnerId);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        waitingQueue.push(partnerSocket);
        partnerSocket.emit('waiting');
      }
    }

    const index = waitingQueue.indexOf(socket);
    if (index !== -1) waitingQueue.splice(index, 1);
  });
});

// Configure PeerJS server
const peerServer = ExpressPeerServer(httpServer, {
  path: '/peerjs',
  allow_discovery: true, // Optional for discovery
});

// Mount PeerJS server to the app
app.use('/peerjs', peerServer);

// Add middleware to ensure WebSocket handshake works
app.use((req, res, next) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://chat-roulette.vercel.app',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Test route for confirmation
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
