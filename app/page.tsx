'use client';

import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const SIGNALING_SERVER_URL = 'https://chat-roulette.onrender.com';
const socket = io(SIGNALING_SERVER_URL);

export default function VideoChat() {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<any>(null);

  useEffect(() => {
    socket.on('matched', ({ peerId }) => {
      setPeerId(peerId);

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: localVideoRef.current?.srcObject as MediaStream,
      });

      peer.on('signal', (signal) => {
        socket.emit('signal', { target: peerId, signal });
      });

      peer.on('stream', (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      });

      peerRef.current = peer;
    });

    socket.on('signal', ({ sender, signal }) => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      } else {
        const peer = new Peer({
          initiator: false,
          trickle: false,
          stream: localVideoRef.current?.srcObject as MediaStream,
        });

        peer.on('signal', (signal) => {
          socket.emit('signal', { target: sender, signal });
        });

        peer.on('stream', (stream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        });

        peer.signal(signal);
        peerRef.current = peer;
      }
    });

    socket.on('chatMessage', ({ sender, message }) => {
      setChatMessages((prev) => [...prev, `${sender}: ${message}`]);
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });
  }, []);

  const handleSendMessage = () => {
    if (peerId) {
      socket.emit('chatMessage', { target: peerId, message });
      setChatMessages((prev) => [...prev, `You: ${message}`]);
      setMessage('');
    }
  };

  return (
    <div className="chat-container">
      <h1 className="neon-title">Neon Video Chat</h1>
      <div className="video-container">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="video"
          title="Your Video"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          className="video"
          title="Peer's Video"
        />
      </div>
      <div className="chat-box">
        <div className="status-indicator">
          {peerId ? 'Connected to a peer!' : 'Waiting for a connection...'}
        </div>
        {chatMessages.length === 0 ? (
          <p className="empty-chat">No messages yet. Start the conversation!</p>
        ) : (
          chatMessages.map((msg, idx) => (
            <p
              key={idx}
              className={`chat-message ${
                msg.startsWith('You:')
                  ? 'chat-message-right'
                  : 'chat-message-left'
              }`}
            >
              {msg}
            </p>
          ))
        )}
      </div>
      <div className="chat-input">
        <input
          type="text"
          className="neon-input"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button className="neon-button" onClick={handleSendMessage}>
          Send
        </button>
      </div>
    </div>
  );
}
