'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'peerjs';
import { MediaConnection } from 'peerjs';

interface Message {
  from: string;
  text: string;
}

const ChatRoulette = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<string>('Connecting...');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [input, setInput] = useState<string>('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

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

        // Initialize Socket.IO
        const socket = io('https://chat-roulette.onrender.com', {
          transports: ['websocket', 'polling'], // WebSocket with fallback
          withCredentials: true,
        });
        socketRef.current = socket;

        // Initialize PeerJS
        const peer = new Peer('', {
          host: 'chat-roulette.onrender.com',
          port: 443, // Use HTTPS
          path: '/peerjs', // Match backend PeerJS path
          secure: true,
        });
        peerRef.current = peer;

        peer.on('open', (id: string) => {
          console.log(`Peer connected with ID: ${id}`);
          socket.emit('peer-id', id);
        });

        socket.on('paired', ({ partnerId }: { partnerId: string }) => {
          setStatus('Connected to a partner!');
          setPartnerId(partnerId);

          if (peerRef.current) {
            const call = peerRef.current.call(partnerId, stream);
            callRef.current = call;

            call.on('stream', (remoteStream: MediaStream) => {
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

        peer.on('call', (call: MediaConnection) => {
          call.answer(stream);

          call.on('stream', (remoteStream: MediaStream) => {
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
      const message: Message = { from: 'You', text: input };
      socketRef.current.emit('message', message);
      setMessages((prev) => [...prev, message]);
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
              <strong>{msg.from}:</strong> {msg.text}
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
