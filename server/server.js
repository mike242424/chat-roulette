import express from 'express';
import { Server } from 'socket.io';
import { PeerServer } from 'peer';
import http from 'http';
import cors from 'cors';

const app = express();
const httpServer = http.createServer(app);

// CORS Configuration
app.use(
  cors({
    origin: 'https://chat-roulette.vercel.app', // Replace with your Vercel frontend URL
    methods: ['GET', 'POST'],
  }),
);

// PeerJS Configuration
const peerServer = PeerServer({
  path: '/peerjs',
  debug: true, // Enable debugging for PeerJS
  key: 'add-some-key',
});

// Attach PeerJS to /peerjs
app.use('/peerjs', peerServer);

// Socket.IO Server Configuration
const io = new Server(httpServer, {
  cors: {
    origin: 'chat-roulette.vercel.app', // Replace with your Vercel frontend URL
    methods: ['GET', 'POST'],
  },
});

// Manage Queue and Pairing
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

// Start Server
const port = process.env.PORT || 443; // Dynamic port for cloud hosting
httpServer.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}`);
  console.log(`PeerJS server available at /peerjs`);
});
