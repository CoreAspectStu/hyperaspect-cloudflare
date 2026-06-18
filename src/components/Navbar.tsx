'use client';
import React, { useState } from 'react';
import { CREAM_BG, DARK_TEXT, YOUTUBE_RED, BORDER, SHADOW, SHADOW_LG } from '@/lib/constants';
import { X } from 'lucide-react'; // Assuming lucide-react is installed

const Navbar: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleJoinWaitlist = async () => {
    setMessage(''); // Clear previous messages
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Successfully joined waitlist!');
        setEmail(''); // Clear email on success
      } else {
        setMessage(data.message || 'Failed to join waitlist. Please try again.');
      }
    } catch (error) {
      console.error('Error joining waitlist:', error);
      setMessage('An error occurred. Please try again later.');
    }
  };

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        backgroundColor: CREAM_BG,
        borderBottom: BORDER,
        boxShadow: SHADOW, // Use SHADOW directly
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        color: DARK_TEXT,
      }}
    >
      <h1 style={{ margin: 0, fontSize: '1.5rem' }}>HyperAspect</h1>

      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          backgroundColor: YOUTUBE_RED,
          color: CREAM_BG, // Text color for button should contrast
          border: BORDER, // Apply neo-brutalist border.
          boxShadow: SHADOW, // Apply neo-brutalist shadow.
          padding: '0.75rem 1.5rem',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 'bold',
          transition: 'all 0.1s ease',
          textTransform: 'uppercase',
          position: 'relative',
          top: '-2px',
          left: '-2px',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(0, 0)'; e.currentTarget.style.boxShadow = `0 0 0 ${DARK_TEXT}`; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = SHADOW; }}
        
      >
        Go Pro
      </button>

      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', // Darker overlay
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001,
          }}
        >
          <div
            style={{
              backgroundColor: CREAM_BG,
              border: BORDER,
              boxShadow: SHADOW_LG, // Larger shadow for modal
              padding: '2rem',
              maxWidth: '500px',
              width: '90%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              color: DARK_TEXT,
            }}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                backgroundColor: CREAM_BG,
                border: BORDER,
                boxShadow: SHADOW,
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <X size={20} color={DARK_TEXT} />
            </button>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.8rem' }}>Join the Pro Waitlist</h2>
            <p>Enter your email to get early access and updates!</p>
            <input
              type="email"
              placeholder="your@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: '0.75rem',
                border: BORDER,
                boxShadow: SHADOW,
                fontSize: '1rem',
                backgroundColor: CREAM_BG,
              }}
            />
            <button
              onClick={handleJoinWaitlist}
              style={{
                backgroundColor: YOUTUBE_RED,
                color: CREAM_BG,
                border: BORDER,
                boxShadow: SHADOW,
                padding: '0.75rem 1.5rem',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold',
                transition: 'all 0.1s ease',
                textTransform: 'uppercase',
                position: 'relative',
                top: '-2px',
                left: '-2px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(0, 0)'; e.currentTarget.style.boxShadow = `0 0 0 ${DARK_TEXT}`; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = SHADOW; }}
            >
              Join Waitlist
            </button>
            {message && <p style={{ marginTop: '1rem', color: DARK_TEXT }}>{message}</p>}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;