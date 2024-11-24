'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Peer from 'peerjs';

const ChatRoulette = () => {
  interface Message {
    from: string;
    text: string;
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('Connecting...');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<any>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<any>(null);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        // Access local video/audio stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize Socket.IO
        const socket = io('https://chat-roulette.onrender.com', {
          transports: ['websocket'],
        });
        socketRef.current = socket;

        // Initialize PeerJS
        const peer = new Peer('', {
          host: 'chat-roulette.onrender.com',
          port: 443,
          secure: true,
          path: '/peerjs',
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              {
                urls: 'turn:your-turn-server-url',
                username: 'your-username',
                credential: 'your-credential',
              },
            ],
          },
        });

        peerRef.current = peer;

        // Handle PeerJS open connection
        peer.on('open', (id) => {
          console.log('PeerJS ID:', id);
          socket.emit('peer-id', id);
        });

        // Handle pairing
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
          setStatus('Waiting for a partner...');
          setPartnerId(null);
        });

        // Handle incoming calls
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

        // Handle messages
        socket.on('message', (message) => {
          setMessages((prev) => [...prev, message]);
        });

        // Error handling
        peer.on('error', (err) => {
          console.error('PeerJS Error:', err);
        });

        socket.on('connect_error', (err) => {
          console.error('Socket.IO Connection Error:', err);
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
    <div className="chat-container">
      <h1 className="neon-title">Chat Roulette</h1>
      <p className="status-indicator">{status}</p>

      <div className="video-container">
        <video ref={localVideoRef} autoPlay muted className="video" />
        <video ref={remoteVideoRef} autoPlay className="video" />
      </div>

      <div className="chat-box">
        {messages.length === 0 ? (
          <p className="empty-chat">No messages yet...</p>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message ${
                msg.from === 'You' ? 'chat-message-right' : 'chat-message-left'
              }`}
            >
              <strong>{msg.from === 'You' ? 'You' : 'Partner'}:</strong>{' '}
              {msg.text}
            </div>
          ))
        )}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          className="neon-input"
          placeholder="Type your message..."
        />
        <button
          onClick={sendMessage}
          className="neon-button"
          disabled={!partnerId || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoulette;
