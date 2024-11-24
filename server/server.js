import express from 'express';
import { Server } from 'socket.io';
import { PeerServer } from 'peer';
import https from 'https';
import cors from 'cors';

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
    credentials: true,
  }),
);

// Validate SSL Environment Variables
if (!process.env.SSL_KEY_B64 || !process.env.SSL_CERT_B64) {
  console.error(
    'Missing SSL environment variables. Ensure SSL_KEY_B64 and SSL_CERT_B64 are set.',
  );
  process.exit(1);
}

// SSL Certificate
let sslOptions;
try {
  sslOptions = {
    key: Buffer.from(process.env.SSL_KEY_B64, 'base64').toString('utf8'),
    cert: Buffer.from(process.env.SSL_CERT_B64, 'base64').toString('utf8'),
  };
} catch (error) {
  console.error('Error setting up SSL certificates:', error.message);
  process.exit(1);
}

// Create HTTPS Server
const httpsServer = https.createServer(sslOptions, app);

// PeerJS Configuration
const peerServer = PeerServer({
  path: '/peerjs',
  debug: true,
});

peerServer.on('connection', (client) => {
  console.log(`Peer connected: ${client.id}`);
});
peerServer.on('disconnect', (client) => {
  console.log(`Peer disconnected: ${client.id}`);
});

// Attach PeerJS to /peerjs
app.use('/peerjs', peerServer);

// Socket.IO Server Configuration
const io = new Server(httpsServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
  },
});

// Queue Management
const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

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

    const index = waitingQueue.findIndex((s) => s.id === socket.id);
    if (index !== -1) waitingQueue.splice(index, 1);
  });
});

// Start Server
const port = process.env.PORT || 443;
httpsServer.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}`);
  console.log(`PeerJS server available at /peerjs`);
});
