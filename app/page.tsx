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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const socket = io('https://chat-roulette.onrender.com:3001');
        socketRef.current = socket;

        const peer = new Peer({
          host: 'peerjs-server.herokuapp.com',
          secure: true,
          port: 443,
        });
        peerRef.current = peer;

        peer.on('open', (id) => {
          socket.emit('peer-id', id);
        });

        socket.on('paired', ({ partnerId }) => {
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

        peer.on('call', (call) => {
          call.answer(stream);

          call.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });

          callRef.current = call;
        });

        socket.on('message', (message: Message) => {
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
