import { Server } from 'socket.io';
import http from 'http';

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'https://chat-roulette.vercel.app/'],
    methods: ['GET', 'POST'],
  },
});

const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  if (waitingQueue.length > 0) {
    const partnerSocket = waitingQueue.shift();
    pairedUsers.set(socket.id, partnerSocket.id);
    pairedUsers.set(partnerSocket.id, socket.id);

    socket.emit('paired', { partnerId: partnerSocket.id });
    partnerSocket.emit('paired', { partnerId: socket.id });
  } else {
    waitingQueue.push(socket);
    socket.emit('waiting');
  }

  socket.on('offer', ({ to, sdp }) => {
    io.to(to).emit('offer', { from: socket.id, sdp });
  });

  socket.on('answer', ({ to, sdp }) => {
    io.to(to).emit('answer', { from: socket.id, sdp });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  socket.on('message', ({ to, text }) => {
    const partnerSocket = io.sockets.sockets.get(to);
    if (partnerSocket) {
      partnerSocket.emit('message', { from: socket.id, text });
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

httpServer.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
