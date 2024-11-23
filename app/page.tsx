'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface Message {
  from: string;
  text: string;
}

const ChatPage = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('Connected');
    });

    // Handle pairing
    socket.on('paired', ({ partnerId }) => {
      setStatus(`Paired with user: ${partnerId}`);
      setPartnerId(partnerId);
      setMessages([]);
    });

    // Handle waiting
    socket.on('waiting', () => {
      setStatus('Waiting to be connected...');
      setPartnerId(null);
    });

    // Listen for incoming messages
    socket.on('message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      setStatus('Disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const sendMessage = () => {
    if (partnerId && socketRef.current) {
      const message = { to: partnerId, text: input };
      socketRef.current.emit('message', message);
      setMessages((prev) => [...prev, { from: 'You', text: input }]);
      setInput('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && input.trim() && partnerId) {
      sendMessage();
    }
  };

  return (
    <div className="chat-container">
      <h1 className="title">Chat Roulette</h1>
      <p className="status-indicator">Status: {status}</p>
      <div className="chat-box">
        {messages.length > 0 ? (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat-message ${
                msg.from === 'You' ? 'chat-message-right' : 'chat-message-left'
              }`}
            >
              <strong>{msg.from === 'You' ? 'You' : msg.from}: </strong>
              {msg.text}
            </div>
          ))
        ) : partnerId ? (
          <div className="empty-chat">No messages yet. Say hi!</div>
        ) : (
          <div className="empty-chat">
            No messages yet. Waiting to be connected...
          </div>
        )}
      </div>
      <div className="chat-input">
        <input
          className="neon-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={!partnerId}
        />
        <button
          className="neon-button"
          onClick={sendMessage}
          disabled={!input || !partnerId}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
