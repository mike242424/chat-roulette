import { Server } from 'socket.io';
import http from 'http';

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Socket.IO server is running.');
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'https://chat-roulette.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

let waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`${socket.id} connected`);

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
    console.log(`Received offer from ${socket.id} to ${to}`);
    if (to && sdp) {
      io.to(to).emit('offer', { from: socket.id, sdp });
    }
  });

  socket.on('answer', ({ to, sdp }) => {
    console.log(`Received answer from ${socket.id} to ${to}`);
    if (to && sdp) {
      io.to(to).emit('answer', { from: socket.id, sdp });
    }
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log(`Received ICE candidate from ${socket.id} to ${to}`);
    if (to && candidate) {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    }
  });

  socket.on('message', ({ to, text }) => {
    console.log(`Message from ${socket.id} to ${to}: ${text}`);
    const partnerSocket = io.sockets.sockets.get(to);
    if (partnerSocket) {
      partnerSocket.emit('message', { from: socket.id, text });
    }
  });

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected`);
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

    waitingQueue = waitingQueue.filter((s) => s.id !== socket.id);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
