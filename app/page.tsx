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
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        localStreamRef.current = stream;
      })
      .catch((error) => {
        alert('Unable to access your camera and microphone.');
      });

    socket.on('matched', ({ peerId }) => {
      setPeerId(peerId);

      if (localStreamRef.current) {
        const peer = new Peer({
          initiator: true,
          trickle: false,
          stream: localStreamRef.current,
          config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          },
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
      } else {
        console.error('Local stream is not ready yet.');
      }
    });

    socket.on('signal', ({ sender, signal }) => {
      if (!peerRef.current && localStreamRef.current) {
        const peer = new Peer({
          initiator: false,
          trickle: false,
          stream: localStreamRef.current,
          config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          },
        });

        peer.on('signal', (signal) => {
          socket.emit('signal', { target: sender, signal });
        });

        peer.on('stream', (stream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        });

        peerRef.current = peer;
        peer.signal(signal);
      } else if (peerRef.current) {
        peerRef.current.signal(signal);
      }
    });

    socket.on('chatMessage', ({ sender, message }) => {
      setChatMessages((prev) => [...prev, `${sender}: ${message}`]);
    });

    socket.on('peerDisconnected', ({ peerId: disconnectedPeerId }) => {
      if (disconnectedPeerId === peerId) {
        alert('Your peer has disconnected.');
        if (peerRef.current) {
          peerRef.current.destroy();
        }
        setPeerId(null);
      }
    });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
      socket.disconnect();
    };
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
      <h1 className="neon-title">Chatroulette</h1>
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
