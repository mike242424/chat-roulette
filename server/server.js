import { Server } from 'socket.io';
import http from 'http';
import { ExpressPeerServer } from 'peer';

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app', // Frontend URL
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'], // Use WebSocket transport only
});

const peerServer = ExpressPeerServer(httpServer, {
  path: '/peerjs', // Path for PeerJS server
  allow_discovery: true, // Allow peer discovery
});

// Attach PeerJS server to HTTP server
httpServer.on('request', peerServer);

peerServer.on('connection', (client) => {
  console.log(`PeerJS client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`PeerJS client disconnected: ${client.getId()}`);
});

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

    const index = waitingQueue.indexOf(socket);
    if (index !== -1) waitingQueue.splice(index, 1);

    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 443;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
