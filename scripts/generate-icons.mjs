import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <circle cx="256" cy="256" r="256" fill="#020617"/>
  <rect x="156" y="200" width="200" height="24" rx="12" fill="#76CB3E"/>
  <rect x="120" y="168" width="36" height="88" rx="8" fill="#76CB3E"/>
  <rect x="96" y="180" width="24" height="64" rx="6" fill="#76CB3E" opacity="0.8"/>
  <rect x="356" y="168" width="36" height="88" rx="8" fill="#76CB3E"/>
  <rect x="392" y="180" width="24" height="64" rx="6" fill="#76CB3E" opacity="0.8"/>
  <rect x="80" y="196" width="16" height="32" rx="4" fill="#76CB3E" opacity="0.6"/>
  <rect x="416" y="196" width="16" height="32" rx="4" fill="#76CB3E" opacity="0.6"/>
  <text x="256" y="340" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="8">GYM</text>
</svg>`;

mkdirSync("public/icons", { recursive: true });

const buf = Buffer.from(svg);
await sharp(buf).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(buf).resize(512, 512).png().toFile("public/icons/icon-512.png");

console.log("Icons generated: icon-192.png, icon-512.png");
