import { Server } from 'socket.io';

const io = new Server(3001, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const waitingQueue = [];
const pairedUsers = new Map();

io.on('connection', (socket) => {
  // Check if there's someone waiting in the queue
  if (waitingQueue.length > 0) {
    const partnerSocket = waitingQueue.shift();

    // Notify both users they are paired
    socket.emit('paired', { partnerId: partnerSocket.id });
    partnerSocket.emit('paired', { partnerId: socket.id });

    // Track the pairing
    pairedUsers.set(socket.id, partnerSocket.id);
    pairedUsers.set(partnerSocket.id, socket.id);
  } else {
    // Add the user to the waiting queue if no one is available
    waitingQueue.push(socket);

    // Notify the user they are waiting
    socket.emit('waiting');
  }

  // Listen for messages
  socket.on('message', ({ to, text }) => {
    const partnerSocket = io.sockets.sockets.get(to);
    if (partnerSocket) {
      partnerSocket.emit('message', { from: socket.id, text });
    }
  });

  // Handle disconnection of paired or waiting users
  socket.on('disconnect', () => {
    // Handle paired users
    const partnerId = pairedUsers.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      pairedUsers.delete(socket.id);
      pairedUsers.delete(partnerId);

      // Add the partner back to the waiting queue if they are still connected
      if (partnerSocket) {
        waitingQueue.push(partnerSocket);
        partnerSocket.emit('waiting');
        pairNextUser();
      }
    }

    // Remove disconnected user from waiting queue
    const index = waitingQueue.indexOf(socket);
    if (index !== -1) {
      waitingQueue.splice(index, 1);
    }
  });

  // Helper function to pair the next user
  const pairNextUser = () => {
    if (waitingQueue.length >= 2) {
      const user1 = waitingQueue.shift();
      const user2 = waitingQueue.shift();

      user1.emit('paired', { partnerId: user2.id });
      user2.emit('paired', { partnerId: user1.id });

      pairedUsers.set(user1.id, user2.id);
      pairedUsers.set(user2.id, user1.id);
    }
  };
});
