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
    origin: [
      'http://localhost:3000',
      'https://chat-roulette.vercel.app',
      'https://chat-roulette-mh6k9rxly-mike242424s-projects.vercel.app',
    ],
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

    console.log(`Paired ${socket.id} with ${partnerSocket.id}`);

    socket.emit('paired', { partnerId: partnerSocket.id });
    partnerSocket.emit('paired', { partnerId: socket.id });
  } else {
    waitingQueue.push(socket);
    console.log(`${socket.id} is waiting for a partner`);
    socket.emit('waiting');
  }

  socket.on('offer', ({ to, sdp }) => {
    console.log(`Offer received from ${socket.id} to ${to}`);
    io.to(to).emit('offer', { from: socket.id, sdp });
  });

  socket.on('answer', ({ to, sdp }) => {
    console.log(`Answer received from ${socket.id} to ${to}`);
    io.to(to).emit('answer', { from: socket.id, sdp });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    console.log(`ICE candidate received from ${socket.id} to ${to}`);
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
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
        console.log(`Re-added ${partnerId} to waiting queue`);
      }
    }

    waitingQueue = waitingQueue.filter((s) => s.id !== socket.id);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
