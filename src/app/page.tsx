'use client';
import React, { useState } from 'react';
import { CREAM_BG, DARK_TEXT, BORDER, SHADOW, SHADOW_LG } from '@/lib/constants';

const HomePage: React.FC = () => {
  // State for managing workflow (e.g., 'init', 'input', 'generating', 'result') - not implemented yet
  const [workflowState, setWorkflowState] = useState('init');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start', // Start content from top, below Navbar
        minHeight: 'calc(100vh - 4rem)', // Adjust for Navbar height, rough estimate
        padding: '2rem 0',
        color: DARK_TEXT,
        backgroundColor: CREAM_BG,
      }}
    >
      {/* Page Title/Headline */}
      <h1
        style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          marginBottom: '2rem',
          textAlign: 'center',
          border: BORDER,
          padding: '1rem 2rem',
          boxShadow: SHADOW,
          backgroundColor: CREAM_BG,
        }}
      >
        Create Your AI-Powered Videos
      </h1>

      {/* Main Content Area */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3rem',
          width: '90%',
          maxWidth: '1200px',
          padding: '2rem',
          border: BORDER,
          boxShadow: SHADOW_LG, // Larger shadow for main content
          backgroundColor: CREAM_BG,
        }}
      >
        {/* Input Tiles Section Placeholder */}
        <div style={{ border: BORDER, padding: '1.5rem', boxShadow: SHADOW, backgroundColor: CREAM_BG }}>
          <h2 style={{ marginTop: 0, fontSize: '2rem' }}>Choose Your Input</h2>
          <p>This section will contain 5 interactive tiles for different input methods.</p>
        </div>

        {/* Gallery Section Placeholder */}
        <div style={{ border: BORDER, padding: '1.5rem', boxShadow: SHADOW, backgroundColor: CREAM_BG }}>
          <h2 style={{ marginTop: 0, fontSize: '2rem' }}>Your Generated Videos</h2>
          <p>This section will display a gallery of previously generated videos.</p>
        </div>

        {/* Interview/Generation/Result Flow Section Placeholder */}
        <div style={{ border: BORDER, padding: '1.5rem', boxShadow: SHADOW, backgroundColor: CREAM_BG }}>
          <h2 style={{ marginTop: 0, fontSize: '2rem' }}>Video Creation Workflow</h2>
          <p>This section will manage the step-by-step video creation process.</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;