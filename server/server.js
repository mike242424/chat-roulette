import { Server } from 'socket.io';
import http from 'http';
import { ExpressPeerServer } from 'peer';

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

const peerServer = ExpressPeerServer(httpServer, {
  path: '/peerjs',
  allow_discovery: true,
});

// Enable CORS for PeerJS server
httpServer.on('request', (req, res) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    'https://chat-roulette.vercel.app',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});
httpServer.on('request', peerServer);

// Store waiting users and paired users
const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Event when a peer ID is received
  socket.on('peer-id', (peerId) => {
    console.log(`Received peer ID from client: ${peerId}`);
    socket.peerId = peerId;

    // Check if there's an available partner in the queue
    if (waitingQueue.length > 0) {
      const partnerSocket = waitingQueue.shift();
      pairedUsers.set(socket.id, partnerSocket.id);
      pairedUsers.set(partnerSocket.id, socket.id);

      console.log(`Pairing ${socket.id} with ${partnerSocket.id}`);
      socket.emit('paired', { partnerId: partnerSocket.peerId });
      partnerSocket.emit('paired', { partnerId: socket.peerId });
    } else {
      console.log(
        `No partner available, adding ${socket.id} to waiting queue.`,
      );
      waitingQueue.push(socket);
      socket.emit('waiting');
    }
  });

  // Handle incoming messages
  socket.on('message', ({ text }) => {
    const partnerSocketId = pairedUsers.get(socket.id);
    if (partnerSocketId) {
      const recipient = io.sockets.sockets.get(partnerSocketId);
      if (recipient) {
        recipient.emit('message', { from: 'Partner', text });
      }
    }
  });

  // Handle socket disconnection
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
      }
    }

    const index = waitingQueue.indexOf(socket);
    if (index !== -1) waitingQueue.splice(index, 1);
  });
});

const PORT = process.env.PORT || 443;
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
