import { Server } from 'socket.io';
import http from 'http';
import { ExpressPeerServer } from 'peer';

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
  },
});

const peerServer = ExpressPeerServer(httpServer, {
  path: '/',
  allow_discovery: true, // Enables peer discovery
});

httpServer.on('request', peerServer);

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

const PORT = process.env.PORT || 443;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
