'use client';

import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const ChatRoulette = () => {
  interface Message {
    from: string;
    text: string;
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('Connecting...');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        console.log('Initializing connection...');

        const socket = io('https://chat-roulette.onrender.com', {
          transports: ['websocket'],
        });
        socketRef.current = socket;

        console.log('Socket initialized.');

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
        });

        socket.on('disconnect', (reason) => {
          console.error('Socket disconnected:', reason);
        });

        socket.on('message', (message: Message) => {
          console.log('Message received:', message);
          setMessages((prev) => [...prev, message]);
        });

        // Send peer-id (if you still want to handle pairing logic in socket)
        socket.emit('peer-id', ''); // You can still send an empty peer-id if you don’t need video functionality
      } catch (error) {
        console.error('Error initializing connection:', error);
      }
    };

    initializeConnection();

    return () => {
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
