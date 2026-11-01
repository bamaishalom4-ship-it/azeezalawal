const fs = require('fs');
const path = require('path');

const pub = 'C:\\Users\\HOME BOY\\.gemini\\antigravity\\scratch\\azeeza-portfolio\\public';

// 1. Monogram Logos (Black & White)
const logoSvg = (fill, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <rect width="120" height="120" rx="28" fill="${bg}"/>
  <path d="M26 88 L50 28 L64 28 L88 88 L73 88 L68 74 L46 74 L41 88 Z M50.5 61 L63.5 61 L57 42 Z" fill="${fill}"/>
  <path d="M78 28 L92 28 L92 75 L106 75 L106 88 L78 88 Z" fill="#b8860b"/>
</svg>`;

fs.writeFileSync(path.join(pub, 'logo', 'azeeza-logo-black.svg'), logoSvg('#ffffff', '#111111'));
fs.writeFileSync(path.join(pub, 'logo', 'azeeza-logo-white.svg'), logoSvg('#111111', '#ffffff'));

// 2. Cutout silhouette SVG for Word Portrait Canvas (has transparent background and shaded portrait silhouette so the word-portrait algorithm samples real luminance & alpha!)
const cutoutSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <radialGradient id="faceGrad" cx="48%" cy="32%" r="40%">
      <stop offset="0%" stop-color="#f2d3b8"/>
      <stop offset="55%" stop-color="#c68e63"/>
      <stop offset="100%" stop-color="#6e4326"/>
    </radialGradient>
    <linearGradient id="suitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d4a238"/>
      <stop offset="45%" stop-color="#2c3e50"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="headwrap" x1="0%" y1="0%" x2="100%" y2="80%">
      <stop offset="0%" stop-color="#f7d774"/>
      <stop offset="50%" stop-color="#b8860b"/>
      <stop offset="100%" stop-color="#5a3e04"/>
    </linearGradient>
  </defs>
  <!-- Headscarf / Gele / Crown -->
  <path d="M235 280 C215 150, 310 65, 405 65 C500 65, 585 150, 565 280 C555 340, 520 385, 495 405 L305 405 C280 385, 245 340, 235 280 Z" fill="url(#headwrap)"/>
  <!-- Neck -->
  <rect x="345" y="430" width="110" height="120" rx="35" fill="#9c6742"/>
  <!-- Head / Face -->
  <ellipse cx="400" cy="310" rx="122" ry="152" fill="url(#faceGrad)"/>
  <!-- Subtle facial structure shading for word-portrait luminance contrast -->
  <ellipse cx="352" cy="295" rx="22" ry="11" fill="#3b2212"/>
  <ellipse cx="448" cy="295" rx="22" ry="11" fill="#3b2212"/>
  <path d="M395 305 L385 355 L415 355 Z" fill="#855231"/>
  <path d="M362 392 Q400 416 438 392 Q400 404 362 392 Z" fill="#5e2a1e"/>
  <!-- Shoulders / Blazer -->
  <path d="M90 1000 C95 730, 200 560, 330 535 L400 660 L470 535 C600 560, 705 730, 710 1000 Z" fill="url(#suitGrad)"/>
  <!-- Lapels & Collar -->
  <path d="M330 535 L400 695 L470 535 L435 520 L400 630 L365 520 Z" fill="#f5f0e6"/>
</svg>`;

const fullPortraitSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#2e2418"/>
      <stop offset="60%" stop-color="#141210"/>
      <stop offset="100%" stop-color="#090807"/>
    </radialGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bgGlow)"/>
  <circle cx="400" cy="300" r="320" fill="rgba(230, 184, 74, 0.08)"/>
  ${cutoutSvg.replace(/<svg[^>]*>|<\/svg>/g, '')}
</svg>`;

fs.writeFileSync(path.join(pub, 'images', 'portrait', 'azeeza-cutout.svg'), cutoutSvg);
fs.writeFileSync(path.join(pub, 'images', 'portrait', 'azeeza-full.svg'), fullPortraitSvg);

// 3. Generate bespoke visual cards for rooms, doors, and projects
const cards = [
  { file: 'door-hr.svg', c1: '#0a3d24', c2: '#04120a', accent: '#22c55e', kicker: 'ROOM 01 · PEOPLE & HR', title: '500+ FIELD STAFF', sub: '19 States · Lifecycle · HRIS · Equity' },
  { file: 'door-hire.svg', c1: '#423008', c2: '#141005', accent: '#facc15', kicker: 'ROOM 02 · HIRE ME', title: 'MBA · PMP · HR', sub: '3+ Yrs HR · 8+ Yrs Career Impact' },
  { file: 'door-creative.svg', c1: '#122b66', c2: '#070f24', accent: '#60a5fa', kicker: 'ROOM 03 · IMPACT & MEDIA', title: 'SDG & JOURNALISM', sub: 'Gates & Bayer Foundations · Best Reporter' },
  { file: 'proj-field-equity.svg', c1: '#0d472a', c2: '#05140c', accent: '#34d399', kicker: 'AFEX · WORKFORCE EQUITY', title: '500+ Field Staff Across 19 States', sub: 'Diversity, Equity & Respect Operations' },
  { file: 'proj-engagement.svg', c1: '#14532d', c2: '#052e16', accent: '#4ade80', kicker: 'AFEX · EMPLOYEE EXPERIENCE', title: '+20% Employee Satisfaction Lift', sub: 'Survey Analytics, Inductions & Retention' },
  { file: 'proj-hris.svg', c1: '#1e293b', c2: '#090d16', accent: '#38bdf8', kicker: 'PEOPLE ANALYTICS & HRIS', title: 'SeamlessHR · Zoho · BambooHR', sub: 'End-to-End Employee Lifecycle Automation' },
  { file: 'proj-sdg-donors.svg', c1: '#1e3a8a', c2: '#09132e', accent: '#93c5fd', kicker: 'AFEX FAIR TRADE · GLOBAL DONORS', title: 'Gates & Bayer Foundations SDGs', sub: 'SDGs 2, 5, 7, 8, 13 & 17 · Helping Africa Feed Itself' },
  { file: 'proj-agronomy.svg', c1: '#365314', c2: '#111c05', accent: '#a3e635', kicker: 'RURAL LITERACY & AGRONOMY', title: 'Smallholder Farmer Resilience', sub: 'Training Design & Public-Private Partnerships' },
  { file: 'proj-cx-fulfillment.svg', c1: '#4c1d95', c2: '#170730', accent: '#c084fc', kicker: 'AFEX COMMODITIES EXCHANGE', title: '-20% Response Time in 90 Days', sub: '30+ Agents Onboarded · Workflow Optimization' },
  { file: 'proj-buypower.svg', c1: '#7c2d12', c2: '#270c03', accent: '#fb923c', kicker: 'BUYPOWER INC. · QUALITY ASSURANCE', title: '96% QA & 4.8/5 CSAT Score', sub: 'Cross-Functional Feedback Loops & Resolution' },
  { file: 'proj-journalism.svg', c1: '#701a75', c2: '#240526', accent: '#f472b6', kicker: 'SEARCH MEDIA · INVESTIGATIVE', title: 'PTCIJ Best Reporter Award', sub: '+45% Documentary Viewership · +50% Social Growth' },
  { file: 'proj-mba.svg', c1: '#581c87', c2: '#1b072e', accent: '#e879f9', kicker: 'ROME BUSINESS SCHOOL · 2024', title: 'International MBA & Leadership', sub: 'Executive Strategy & Global People Management' }
];

for (const card of cards) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750">
    <defs>
      <radialGradient id="g" cx="20%" cy="15%" r="90%">
        <stop offset="0%" stop-color="${card.c1}"/>
        <stop offset="100%" stop-color="${card.c2}"/>
      </radialGradient>
      <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="1200" height="750" fill="url(#g)"/>
    <rect width="1200" height="750" fill="url(#grid)"/>
    <circle cx="980" cy="180" r="260" fill="${card.accent}" opacity="0.12"/>
    <circle cx="200" cy="620" r="320" fill="${card.accent}" opacity="0.08"/>
    <rect x="72" y="72" width="1056" height="606" rx="28" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
    <text x="120" y="160" fill="${card.accent}" font-family="JetBrains Mono, monospace" font-size="22" font-weight="600" letter-spacing="4">${card.kicker.replace(/&/g, '&amp;')}</text>
    <text x="120" y="390" fill="#ffffff" font-family="Bricolage Grotesque, Inter, sans-serif" font-size="64" font-weight="800" letter-spacing="-1.5">${card.title.replace(/&/g, '&amp;')}</text>
    <text x="120" y="465" fill="rgba(255,255,255,0.72)" font-family="Inter, sans-serif" font-size="30" font-weight="500">${card.sub.replace(/&/g, '&amp;')}</text>
    <line x1="120" y1="540" x2="360" y2="540" stroke="${card.accent}" stroke-width="4" stroke-linecap="round"/>
    <text x="120" y="600" fill="rgba(255,255,255,0.45)" font-family="JetBrains Mono, monospace" font-size="18" letter-spacing="2">AZEEZA MUHAMMAD LAWAL · PORTFOLIO ARCHIVE</text>
  </svg>`;
  fs.writeFileSync(path.join(pub, 'images', 'opt', card.file), svg);
}

// 4. Build 3-row horizontal collage of SeamlessHR, Zoho People, and BambooHR for proj-hris.svg
const seamlessStrip = path.join(pub, 'images', 'opt', 'seamless-hr-strip.jpg');
const zohoStrip = path.join(pub, 'images', 'opt', 'zoho-people-strip.jpg');
const bambooStrip = path.join(pub, 'images', 'opt', 'bamboo-hr.jpg');

if (fs.existsSync(seamlessStrip) && fs.existsSync(zohoStrip) && fs.existsSync(bambooStrip)) {
  const seamlessB64 = fs.readFileSync(seamlessStrip).toString('base64');
  const zohoB64 = fs.readFileSync(zohoStrip).toString('base64');
  const bambooB64 = fs.readFileSync(bambooStrip).toString('base64');

  const hrisCollageSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 750" width="1200" height="750">
  <defs>
    <linearGradient id="seamlessBg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ecf3fe"/>
      <stop offset="50%" stop-color="#e8eef3"/>
      <stop offset="100%" stop-color="#f3e9e2"/>
    </linearGradient>
    <clipPath id="row1"><rect x="0" y="0" width="1200" height="250"/></clipPath>
    <clipPath id="row2"><rect x="0" y="250" width="1200" height="250"/></clipPath>
    <clipPath id="row3"><rect x="0" y="500" width="1200" height="250"/></clipPath>
  </defs>

  <!-- Row 1 (Horizontal Band): SeamlessHR -->
  <g clip-path="url(#row1)">
    <rect x="0" y="0" width="1200" height="250" fill="url(#seamlessBg)"/>
    <image href="data:image/jpeg;base64,${seamlessB64}" x="240" y="8" width="720" height="234" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- Row 2 (Horizontal Band): Zoho People -->
  <g clip-path="url(#row2)">
    <rect x="0" y="250" width="1200" height="250" fill="#ffffff"/>
    <image href="data:image/jpeg;base64,${zohoB64}" x="280" y="262" width="640" height="226" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- Row 3 (Horizontal Band): BambooHR -->
  <g clip-path="url(#row3)">
    <rect x="0" y="500" width="1200" height="250" fill="#8bc43e"/>
    <image href="data:image/jpeg;base64,${bambooB64}" x="320" y="512" width="560" height="226" preserveAspectRatio="xMidYMid meet"/>
  </g>

  <!-- Clean horizontal collage dividers -->
  <line x1="0" y1="250" x2="1200" y2="250" stroke="rgba(0,0,0,0.08)" stroke-width="2"/>
  <line x1="0" y1="500" x2="1200" y2="500" stroke="rgba(0,0,0,0.08)" stroke-width="2"/>
</svg>`;

  fs.writeFileSync(path.join(pub, 'images', 'opt', 'proj-hris.svg'), hrisCollageSvg);
}

console.log('Generated all SVG assets successfully!');
