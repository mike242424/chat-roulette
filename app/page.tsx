'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Peer from 'simple-peer';

const ChatRoulette = () => {
  interface Message {
    from: string;
    text: string;
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Connecting...');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);

  useEffect(() => {
    const socket = io('https://chat-roulette.onrender.com');
    socketRef.current = socket;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        socket.on('connect', () => {
          console.log('Connected to signaling server');
          setStatus('Connected to server');
        });

        socket.on('paired', ({ partnerId }) => {
          console.log(`Paired with user: ${partnerId}`);
          setStatus(`Paired with user: ${partnerId}`);
          setPartnerId(partnerId);

          const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
          });

          peer.on('signal', (data) => {
            console.log('Sending signaling data:', data);
            if (data.type === 'offer' || data.type === 'answer') {
              socket.emit('offer', { to: partnerId, sdp: data });
            }
          });

          peer.on('stream', (remoteStream) => {
            console.log('Received remote stream');
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
          });

          peer.on('error', (err) => {
            console.error('Peer error:', err);
            setStatus('Connection failed. Please refresh and try again.');
          });

          peerRef.current = peer;

          socket.on('offer', ({ from, sdp }) => {
            console.log('Received offer:', sdp);
            const answeringPeer = new Peer({
              initiator: false,
              trickle: false,
              stream,
            });

            answeringPeer.signal(sdp);

            answeringPeer.on('signal', (data) => {
              console.log('Sending answer:', data);
              socket.emit('answer', { to: from, sdp: data });
            });

            answeringPeer.on('stream', (remoteStream) => {
              console.log('Received remote stream');
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
              }
            });

            answeringPeer.on('error', (err) => {
              console.error('Peer error:', err);
              setStatus('Connection failed. Please refresh and try again.');
            });

            peerRef.current = answeringPeer;
          });

          socket.on('answer', (sdp) => {
            console.log('Received answer:', sdp);
            peer.signal(sdp);
          });

          socket.on('ice-candidate', (candidate) => {
            console.log('Received ICE candidate:', candidate);
            peer.signal(candidate);
          });
        });

        socket.on('waiting', () => {
          console.log('Waiting for a partner...');
          setStatus('Waiting for a partner...');
          setPartnerId(null);
        });

        socket.on('message', (message) => {
          console.log('Message received:', message);
          setMessages((prev) => [...prev, message]);
        });
      })
      .catch((err) => {
        console.error('Error accessing media devices:', err);
        setStatus('Failed to access camera or microphone.');
      });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
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

  return (
    <div className="chat-container">
      <h1 className="title">Chat Roulette</h1>
      <p className="status-indicator">{status}</p>
      <div className="video-container">
        <video ref={localVideoRef} autoPlay muted className="video" />
        <video ref={remoteVideoRef} autoPlay className="video" />
      </div>
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`chat-message ${
              msg.from === 'You' ? 'chat-message-right' : 'chat-message-left'
            }`}
          >
            <strong>{msg.from === 'You' ? 'You' : 'Partner'}:</strong>{' '}
            {msg.text}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          className="neon-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button className="neon-button" onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoulette;
