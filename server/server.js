import { Server } from 'socket.io';
import { PeerServer } from 'peer';
import http from 'http';

const port = process.env.PORT || 3001;
const httpServer = http.createServer();

const io = new Server(httpServer, {
  cors: {
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
  },
});

const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

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
    console.log(`Disconnected: ${socket.id}`);
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

const peerServer = PeerServer({
  server: httpServer,
  path: '/peerjs',
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
