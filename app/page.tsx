'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Peer from 'peerjs';

const ChatRoulette = () => {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('Connecting...');
  const [partnerId, setPartnerId] = useState(null);
  const [input, setInput] = useState('');
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const socket = io('https://chat-roulette.onrender.com', {
          transports: ['websocket'], // Enforce WebSocket
          withCredentials: true,
        });
        socketRef.current = socket;

        const peer = new Peer('', {
          host: 'chat-roulette.onrender.com',
          port: 443,
          path: '/peerjs',
          secure: true,
        });
        peerRef.current = peer;

        peer.on('open', (id) => {
          console.log('Peer ID:', id);
          socket.emit('peer-id', id);
        });

        socket.on('paired', ({ partnerId }) => {
          console.log('Paired with:', partnerId);
          setStatus('Connected to a partner!');
          setPartnerId(partnerId);

          if (peerRef.current) {
            const call = peerRef.current.call(partnerId, stream);
            callRef.current = call;

            call.on('stream', (remoteStream) => {
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
            });
          }
        });

        socket.on('waiting', () => {
          console.log('Waiting for a partner...');
          setStatus('Waiting for a partner...');
          setPartnerId(null);
        });

        peer.on('call', (call) => {
          console.log('Incoming call...');
          call.answer(stream);

          call.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });

          callRef.current = call;
        });

        socket.on('message', (message) => {
          setMessages((prev) => [...prev, message]);
        });
      } catch (error) {
        console.error('Error initializing connections:', error);
      }
    };

    initializeConnection();

    return () => {
      peerRef.current?.destroy();
      socketRef.current?.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (partnerId && socketRef.current) {
      const message = { text: input };
      socketRef.current.emit('message', message);
      setMessages((prev) => [...prev, { from: 'You', text: input }]);
      setInput('');
    }
  };

  return (
    <div>
      <h1>Chat Roulette</h1>
      <p>{status}</p>

      <div>
        <video ref={localVideoRef} autoPlay muted />
        <video ref={remoteVideoRef} autoPlay />
      </div>

      <div>
        {messages.map((msg, idx) => (
          <p key={idx}>{msg.text}</p>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage} disabled={!partnerId}>
        Send
      </button>
    </div>
  );
};

export default ChatRoulette;
