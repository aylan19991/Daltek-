import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const assetsDir = path.join(publicDir, 'assets');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// 1. Master DALTEK Vector Emblem (Dark & Gold, Luxury Queue Flow Monogram)
const daltekEmblemSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%" fx="50%" fy="30%">
      <stop offset="0%" stop-color="#181D26" />
      <stop offset="60%" stop-color="#0E1219" />
      <stop offset="100%" stop-color="#07090D" />
    </radialGradient>

    <!-- Luxury Gold Gradient Primary -->
    <linearGradient id="goldPrim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF3B0" />
      <stop offset="25%" stop-color="#F5B82E" />
      <stop offset="50%" stop-color="#E29A10" />
      <stop offset="80%" stop-color="#B87304" />
      <stop offset="100%" stop-color="#EBB338" />
    </linearGradient>

    <!-- Gold Accent 2 -->
    <linearGradient id="goldAccent" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFEAA7" />
      <stop offset="40%" stop-color="#F3BA35" />
      <stop offset="100%" stop-color="#8C5302" />
    </linearGradient>

    <!-- Tech Cyan Glow Accent (Signaling Queue Sync) -->
    <linearGradient id="syncGlow" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#F5B82E" stop-opacity="0.9" />
    </linearGradient>

    <!-- Subtle Drop Shadow -->
    <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.7" />
    </filter>
  </defs>

  <!-- Deep Obsidian Slate Rounded Icon Base -->
  <rect x="16" y="16" width="480" height="480" rx="108" fill="url(#bgGrad)" stroke="#F5B82E" stroke-opacity="0.25" stroke-width="4" filter="url(#softShadow)" />

  <!-- Inner Subtle Concentric Tech Border -->
  <rect x="36" y="36" width="440" height="440" rx="88" fill="none" stroke="#F5B82E" stroke-opacity="0.08" stroke-width="1.5" />

  <!-- Glowing Emblem Center Group -->
  <g transform="translate(256, 256)" filter="url(#goldGlow)">
    <!-- Queue Flow Wave Arc 1 (Back wave) -->
    <path d="M 40 -120 A 130 130 0 0 1 120 -40" fill="none" stroke="url(#goldAccent)" stroke-width="8" stroke-linecap="round" opacity="0.35" />
    <circle cx="120" cy="-40" r="5" fill="#FFEAA7" opacity="0.6" />

    <!-- Queue Flow Wave Arc 2 (Middle wave) -->
    <path d="M 50 -150 A 170 170 0 0 1 150 -50" fill="none" stroke="url(#goldAccent)" stroke-width="10" stroke-linecap="round" opacity="0.55" />
    <circle cx="150" cy="-50" r="7" fill="#FFF3B0" opacity="0.8" />

    <!-- Queue Flow Wave Arc 3 (Outer priority signal wave) -->
    <path d="M 60 -185 A 215 215 0 0 1 185 -60" fill="none" stroke="url(#goldPrim)" stroke-width="12" stroke-linecap="round" />
    <circle cx="185" cy="-60" r="9" fill="#FFF8D6" />

    <!-- Central Tech Monogram 'D' for DALTEK -->
    <!-- Left Vertical Spine Pillar -->
    <rect x="-140" y="-140" width="38" height="280" rx="19" fill="url(#goldPrim)" />
    
    <!-- Inner Accent Inset on Spine -->
    <rect x="-132" y="-120" width="8" height="240" rx="4" fill="#FFFDF0" opacity="0.4" />

    <!-- Main Outer D Geometric Curve (Queue loop) -->
    <path d="M -115 -140 L -20 -140 C 75 -140, 135 -75, 135 0 C 135 75, 75 140, -20 140 L -115 140" 
          fill="none" 
          stroke="url(#goldPrim)" 
          stroke-width="38" 
          stroke-linecap="round" 
          stroke-linejoin="round" />

    <!-- Inner Golden Core Flow Indicator (Fast Queue Core) -->
    <path d="M -102 -75 L -20 -75 C 35 -75, 70 -35, 70 0 C 70 35, 35 75, -20 75 L -102 75" 
          fill="none" 
          stroke="url(#goldAccent)" 
          stroke-width="14" 
          stroke-linecap="round" 
          opacity="0.85" />

    <!-- Dynamic Queue Progression Dots (3 Golden Tickets/Nodes in Motion) -->
    <circle cx="-15" cy="-28" r="8" fill="#FFF8D6" />
    <circle cx="15" cy="0" r="10" fill="#FFF8D6" />
    <circle cx="-15" cy="28" r="8" fill="#FFF8D6" />
  </g>
</svg>
`;

// 2. Full Horizontal Brand Banner (Logo + Typography)
const daltekFullLogoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <radialGradient id="bgGradFull" cx="30%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#141923" />
      <stop offset="100%" stop-color="#080A0E" />
    </radialGradient>
    <linearGradient id="goldPrimFull" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF3B0" />
      <stop offset="30%" stop-color="#F5B82E" />
      <stop offset="70%" stop-color="#E29A10" />
      <stop offset="100%" stop-color="#B87304" />
    </linearGradient>
    <linearGradient id="goldAccentFull" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFEAA7" />
      <stop offset="50%" stop-color="#F3BA35" />
      <stop offset="100%" stop-color="#9C6208" />
    </linearGradient>
    <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.6" />
    </filter>
  </defs>

  <rect width="1200" height="400" rx="36" fill="url(#bgGradFull)" stroke="#F5B82E" stroke-opacity="0.2" stroke-width="2" />

  <!-- Emblem on the Left -->
  <g transform="translate(190, 200) scale(0.62)">
    <g transform="translate(-256, -256)">
      ${daltekEmblemSvg.replace(/<\/?svg[^>]*>/g, '')}
    </g>
  </g>

  <!-- Typography Right -->
  <g transform="translate(420, 220)">
    <!-- Brand Name: DALTEK -->
    <text x="0" y="0" font-family="'Syne', 'Outfit', sans-serif" font-size="104" font-weight="800" fill="url(#goldPrimFull)" letter-spacing="8" filter="url(#softGlow)">
      DALTEK
    </text>

    <!-- Subtitle / Tagline -->
    <text x="4" y="52" font-family="'Outfit', sans-serif" font-size="24" font-weight="600" fill="#E2E8F0" letter-spacing="6" opacity="0.9">
      GESTION DE FILE D'ATTENTE TEMPS RÉEL
    </text>

    <text x="4" y="86" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="500" fill="#F5B82E" letter-spacing="4" opacity="0.8">
      SUITE UNIFIÉE • GUICHETS • TV • MOBILE • NATIVE
    </text>
  </g>
</svg>
`;

// 3. TV 16:9 Display Banner (1920 x 1080)
const daltekTvBannerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <radialGradient id="tvBg" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#161B26" />
      <stop offset="60%" stop-color="#0D1017" />
      <stop offset="100%" stop-color="#06080B" />
    </radialGradient>
    <linearGradient id="tvGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF3B0" />
      <stop offset="35%" stop-color="#F5B82E" />
      <stop offset="70%" stop-color="#E29A10" />
      <stop offset="100%" stop-color="#B87304" />
    </linearGradient>
  </defs>

  <rect width="1920" height="1080" fill="url(#tvBg)" />

  <!-- Center Master Emblem -->
  <g transform="translate(960, 440) scale(1.15)">
    <g transform="translate(-256, -256)">
      ${daltekEmblemSvg.replace(/<\/?svg[^>]*>/g, '')}
    </g>
  </g>

  <!-- Title & Baseline -->
  <text x="960" y="820" text-anchor="middle" font-family="'Syne', sans-serif" font-size="96" font-weight="800" fill="url(#tvGold)" letter-spacing="12">
    DALTEK
  </text>
  <text x="960" y="880" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="28" font-weight="600" fill="#E2E8F0" letter-spacing="8" opacity="0.85">
    SYSTÈME DE FILE D'ATTENTE HAUTE CONCIERGERIE
  </text>
  <text x="960" y="930" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="18" font-weight="500" fill="#F5B82E" letter-spacing="5" opacity="0.75">
    SYNCHRONISATION UNIFIÉE TEMPS RÉEL • MULTI-ÉCRANS
  </text>
</svg>
`;

async function generateAllAssets() {
  console.log('[Asset Builder] Generating brand SVGs...');
  const emblemBuffer = Buffer.from(daltekEmblemSvg.trim());
  const fullBuffer = Buffer.from(daltekFullLogoSvg.trim());
  const tvBuffer = Buffer.from(daltekTvBannerSvg.trim());

  // Save SVGs
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), emblemBuffer);
  fs.writeFileSync(path.join(publicDir, 'daltek-logo.svg'), emblemBuffer);
  fs.writeFileSync(path.join(publicDir, 'daltek-full-logo.svg'), fullBuffer);
  fs.writeFileSync(path.join(assetsDir, 'daltek-emblem.svg'), emblemBuffer);

  console.log('[Asset Builder] Rendering raster PNGs at native target dimensions...');

  // 1. Master Logo 512x512
  await sharp(emblemBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'daltek-logo.png'));
  await sharp(emblemBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'daltek-logo-dark.png'));

  // 1b. Light variant (with crisp gold border on transparent)
  await sharp(emblemBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'daltek-logo-light.png'));

  // 2. Full Horizontal Brand Banner (1200x400)
  await sharp(fullBuffer)
    .resize(1200, 400)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'daltek-logo-full.png'));

  // 3. Favicons (16x16, 32x32, 48x48)
  await sharp(emblemBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  await sharp(emblemBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(emblemBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon-48x48.png'));

  // Multi-size .ico (Windows & Browser Favicon) using 32x32 PNG as standard favicon.ico
  await sharp(emblemBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));

  // 4. Android Launcher Icons (192x192, 512x512)
  await sharp(emblemBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-android-192.png'));
  await sharp(emblemBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-android-512.png'));

  // 5. Windows Icons (256x256, 48x48)
  await sharp(emblemBuffer)
    .resize(256, 256)
    .png()
    .toFile(path.join(publicDir, 'icon-windows-256.png'));
  await sharp(emblemBuffer)
    .resize(256, 256)
    .png()
    .toFile(path.join(publicDir, 'app.ico'));

  // 6. macOS App Icons (512x512, 1024x1024)
  await sharp(emblemBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-mac-512.png'));
  await sharp(emblemBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(publicDir, 'icon-mac-1024.png'));

  // 7. iPhone / iPad Apple Touch Icons (180x180, 1024x1024 App Store)
  await sharp(emblemBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(emblemBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'icon-ios-180.png'));
  await sharp(emblemBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(publicDir, 'icon-ios-1024.png'));

  // 8. TV Icons (400x400 square badge + 1920x1080 banner)
  await sharp(emblemBuffer)
    .resize(400, 400)
    .png()
    .toFile(path.join(publicDir, 'icon-tv-400.png'));
  await sharp(tvBuffer)
    .resize(1920, 1080)
    .png()
    .toFile(path.join(publicDir, 'icon-tv-banner.png'));

  console.log('[Asset Builder] All native DALTEK brand icons successfully created!');
}

generateAllAssets().catch((err) => {
  console.error('[Asset Builder Error]:', err);
  process.exit(1);
});
