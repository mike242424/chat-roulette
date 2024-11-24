import express from 'express';
import { Server } from 'socket.io';
import { PeerServer } from 'peer';
import https from 'https';
import cors from 'cors';
import rateLimit from 'socketio-rate-limiter';

const app = express();

// CORS Configuration
app.use(
  cors({
    origin: ['https://chat-roulette.vercel.app'], // Allow your frontend URL
    methods: ['GET', 'POST'],
    credentials: true, // Allow credentials if necessary
  }),
);

// Validate SSL Environment Variables
if (!process.env.SSL_KEY_B64 || !process.env.SSL_CERT_B64) {
  console.error(
    'Missing SSL environment variables. Ensure SSL_KEY_B64 and SSL_CERT_B64 are set.',
  );
  process.exit(1);
}

// SSL Certificate (Use a valid certificate in production)
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
app.use(
  '/peerjs',
  (req, res, next) => {
    console.log(`PeerJS request: ${req.method} ${req.url}`);
    next();
  },
  peerServer,
);

// Socket.IO Server Configuration
const io = new Server(httpsServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
  },
});

// Rate Limiting for Socket.IO
io.use(
  rateLimit({
    max: 100, // Allow 100 events per minute
    interval: 60000, // Reset every minute
  }),
);

// Manage Queue and Pairing
const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle Peer ID registration
  socket.on('peer-id', (peerId) => {
    console.log(`Peer registered: ${peerId}`);
    socket.peerId = peerId;

    if (waitingQueue.length > 0) {
      const partnerSocket = waitingQueue.shift();
      pairedUsers.set(socket.id, partnerSocket.id);
      pairedUsers.set(partnerSocket.id, socket.id);

      socket.emit('paired', { partnerId: partnerSocket.peerId });
      partnerSocket.emit('paired', { partnerId: socket.peerId });

      console.log(`Paired ${socket.id} with ${partnerSocket.id}`);
    } else {
      waitingQueue.push(socket);
      socket.emit('waiting');
      console.log(`Added ${socket.id} to waiting queue`);
    }

    console.log(`Queue size: ${waitingQueue.length}`);
    console.log(`Paired users:`, [...pairedUsers.entries()]);
  });

  // Handle Messages
  socket.on('message', ({ text }) => {
    const partnerSocketId = pairedUsers.get(socket.id);
    if (partnerSocketId) {
      const recipient = io.sockets.sockets.get(partnerSocketId);
      if (recipient) {
        recipient.emit('message', { from: 'Partner', text });
        console.log(`Message sent from ${socket.id} to ${partnerSocketId}`);
      }
    }
  });

  // Handle Disconnection
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const partnerId = pairedUsers.get(socket.id);
    pairedUsers.delete(socket.id);

    if (partnerId) {
      pairedUsers.delete(partnerId);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        waitingQueue.push(partnerSocket);
        partnerSocket.emit('waiting');
        console.log(`Re-added ${partnerId} to waiting queue`);
      }
    }

    // Ensure the socket is removed from the waiting queue
    const index = waitingQueue.findIndex((s) => s.id === socket.id);
    if (index !== -1) waitingQueue.splice(index, 1);

    console.log(`Updated queue size: ${waitingQueue.length}`);
  });
});

// Start Server
const port = process.env.PORT || 443; // Use HTTPS default port
httpsServer.listen(port, () => {
  console.log(`Socket.IO server running on port ${port}`);
  console.log(`PeerJS server available at /peerjs`);
});
