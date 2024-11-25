'use client';

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Peer from 'peerjs';

const SimplifiedClient = () => {
  const socketRef = useRef<any>(null);
  const peerRef = useRef<Peer | null>(null);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        console.log('Initializing connection...');

        // Initialize Socket.IO connection
        const socket = io('https://chat-roulette.onrender.com', {
          transports: ['websocket'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('Socket connected:', socket.id);
        });

        socket.on('waiting', () => {
          console.log('Waiting for a partner...');
        });

        socket.on('paired', ({ partnerId }) => {
          console.log('Paired with partner:', partnerId);
        });

        socket.on('disconnect', (reason) => {
          console.error('Socket disconnected:', reason);
        });

        // Initialize PeerJS connection
        const peer = new Peer('', {
          host: 'chat-roulette.onrender.com',
          port: 443,
          secure: true,
          path: '/peerjs',
          config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          },
        });

        peerRef.current = peer;

        peer.on('open', (id) => {
          console.log('Peer connected with ID:', id);
          socket.emit('peer-id', id);
          console.log('peer-id emitted');
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
        });

        peer.on('disconnected', () => {
          console.log('Peer disconnected.');
        });

        peer.on('close', () => {
          console.log('Peer connection closed.');
        });
      } catch (error) {
        console.error('Error initializing connection:', error);
      }
    };

    initializeConnection();

    return () => {
      // Clean up connections on unmount
      peerRef.current?.destroy();
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Testing ChatRoulette Connection</h1>
      <p>Check the console for connection logs.</p>
    </div>
  );
};

export default SimplifiedClient;
