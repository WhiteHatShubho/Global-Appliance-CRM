const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Read the SVG - using the TECHNICIAN logo, not admin logo
const svg = fs.readFileSync('f:\\Serve\\technician-web\\public\\logo.svg', 'utf8');

// Create output directories if they don't exist
const sizes = [
  { name: 'mdpi', size: 192 },
  { name: 'hdpi', size: 288 },
  { name: 'xhdpi', size: 384 },
  { name: 'xxhdpi', size: 512 },
  { name: 'xxxhdpi', size: 512 }
];

sizes.forEach(s => {
  const dir = `f:\\Serve\\technician-web\\android\\app\\src\\main\\res\\mipmap-${s.name}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Convert SVG to PNG for each size
async function convertSvg() {
  for (const size of sizes) {
    const outPath = `f:\\Serve\\technician-web\\android\\app\\src\\main\\res\\mipmap-${size.name}\\ic_launcher.png`;
    try {
      await sharp(Buffer.from(svg))
        .resize(size.size, size.size, { 
          fit: 'contain', 
          background: { r: 0, g: 26, b: 77, alpha: 1 } 
        })
        .png()
        .toFile(outPath);
      console.log(`✅ Created ${size.name}: ${size.size}x${size.size}`);
    } catch (err) {
      console.error(`Error creating ${size.name}:`, err.message);
    }
  }
  console.log('All icons created successfully!');
}

convertSvg();
