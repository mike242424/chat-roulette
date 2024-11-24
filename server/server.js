import { Server } from 'socket.io';
import { PeerServer } from 'peer';
import http from 'http';

const port = process.env.PORT || 3001;
const httpServer = http.createServer();

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('peer-id', (peerId) => {
    socket.peerId = peerId;
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

const peerServer = PeerServer({
  server: httpServer,
  path: '/peerjs',
});

httpServer.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
