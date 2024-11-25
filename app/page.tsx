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
        console.log('Initializing connection...');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        console.log('Media stream obtained.');

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const socket = io('https://chat-roulette.onrender.com', {
          transports: ['websocket'],
        });
        socketRef.current = socket;

        console.log('Socket initialized.');

        const peer = new Peer('', {
          host: 'chat-roulette.onrender.com',
          port: 443,
          secure: true,
          path: '',
        });
        peerRef.current = peer;

        peer.on('open', (id) => {
          console.log('Peer ID obtained:', id);
          socket.emit('peer-id', id); // Emitting the peer ID to the server
          console.log('peer-id emitted');
        });

        socket.on('connect', () => {
          console.log('Connected to socket server.');
          setStatus('Waiting for a partner...');
        });

        socket.on('waiting', () => {
          console.log('Waiting for a partner...');
          setStatus('Waiting for a partner...');
          setPartnerId(null);
        });

        socket.on('paired', ({ partnerId }) => {
          console.log('Paired with partner:', partnerId);
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

        socket.on('disconnect', (reason) => {
          console.error('Socket disconnected:', reason);
        });

        socket.on('message', (message: Message) => {
          console.log('Message received:', message);
          setMessages((prev) => [...prev, message]);
        });

        peer.on('call', (call) => {
          console.log('Incoming call:', call);
          call.answer(stream);

          call.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });

          callRef.current = call;
        });
      } catch (error) {
        console.error('Error initializing connection:', error);
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
              <strong>{msg.from === 'You' ? 'You' : 'Partner'}:</strong>
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
