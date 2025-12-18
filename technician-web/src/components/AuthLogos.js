// Google Gmail Logo SVG
export const GoogleLogo = () => (
  <svg viewBox="0 0 24 24" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 7H18V17H6Z" fill="none"/>
    <path d="M12 12.5L6 8V16H18V8L12 12.5Z" fill="white" stroke="white" strokeWidth="0.5"/>
    <path d="M6 8L12 12.5L18 8" stroke="white" strokeWidth="1.2" fill="none"/>
  </svg>
);

// Face Recognition Logo SVG
export const FaceLogo = () => (
  <svg viewBox="0 0 200 200" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="white" strokeWidth="8" strokeLinecap="round">
      {/* Face box */}
      <rect x="40" y="30" width="120" height="140" rx="20"/>
      {/* Left eye */}
      <circle cx="70" cy="70" r="8" fill="white"/>
      {/* Right eye */}
      <circle cx="130" cy="70" r="8" fill="white"/>
      {/* Smile */}
      <path d="M 70 110 Q 100 130 130 110" strokeWidth="6"/>
    </g>
  </svg>
);

// Fingerprint Logo SVG
export const FingerprintLogo = () => (
  <svg viewBox="0 0 200 200" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="white" strokeWidth="6" strokeLinecap="round">
      {/* Fingerprint rings */}
      <circle cx="100" cy="100" r="15"/>
      <circle cx="100" cy="100" r="30"/>
      <circle cx="100" cy="100" r="45"/>
      <circle cx="100" cy="100" r="60"/>
      <circle cx="100" cy="100" r="75"/>
      {/* Center dot */}
      <circle cx="100" cy="100" r="4" fill="white"/>
    </g>
  </svg>
);

// Email Logo SVG
export const EmailLogo = () => (
  <svg viewBox="0 0 200 160" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
      {/* Envelope */}
      <rect x="20" y="30" width="160" height="100" rx="10"/>
      {/* Flap */}
      <path d="M 20 30 L 100 85 L 180 30"/>
    </g>
  </svg>
);
