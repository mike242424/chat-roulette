import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  },
});

app.use(
  cors({
    origin: 'https://chat-roulette.vercel.app',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  }),
);

let waitingUsers = [];

io.on('connection', (socket) => {
  waitingUsers.push(socket.id);

  if (waitingUsers.length >= 2) {
    const user1 = waitingUsers.shift();
    const user2 = waitingUsers.shift();

    io.to(user1).emit('matched', { peerId: user2 });
    io.to(user2).emit('matched', { peerId: user1 });
  }

  socket.on('signal', (data) => {
    io.to(data.target).emit('signal', {
      sender: socket.id,
      signal: data.signal,
    });
  });

  socket.on('chatMessage', (data) => {
    io.to(data.target).emit('chatMessage', {
      sender: socket.id,
      message: data.message,
    });
  });

  socket.on('disconnect', () => {
    waitingUsers = waitingUsers.filter((id) => id !== socket.id);
    io.emit('peerDisconnected', { peerId: socket.id });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Signaling server running on port ${PORT}`),
);
