import { Server } from 'socket.io';
import http from 'http';
import { ExpressPeerServer } from 'peer';

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer();

const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

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
    console.log('Socket disconnected:', socket.id);
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

const peerServer = ExpressPeerServer(httpServer, {
  path: '/peerjs',
  allow_discovery: true,
});

peerServer.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://chat-roulette.vercel.app'); // Frontend URL
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

peerServer.on('connection', (client) => {
  console.log('PeerJS connection established:', client.id);
});

peerServer.on('disconnect', (client) => {
  console.log('PeerJS client disconnected:', client.id);
});

httpServer.on('request', peerServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`PeerJS server running on path /peerjs`);
});
