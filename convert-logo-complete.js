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

async function convertSvg() {
  for (const size of sizes) {
    // ic_launcher.png
    const launcherPath = `f:\\Serve\\technician-web\\android\\app\\src\\main\\res\\mipmap-${size.name}\\ic_launcher.png`;
    try {
      await sharp(Buffer.from(svg))
        .resize(size.size, size.size, { 
          fit: 'contain', 
          background: { r: 0, g: 26, b: 77, alpha: 1 } 
        })
        .png()
        .toFile(launcherPath);
      console.log(`✅ Created ${size.name} ic_launcher: ${size.size}x${size.size}`);
    } catch (err) {
      console.error(`Error creating ${size.name} ic_launcher:`, err.message);
    }

    // ic_launcher_round.png (same as launcher for now)
    const roundPath = `f:\\Serve\\technician-web\\android\\app\\src\\main\\res\\mipmap-${size.name}\\ic_launcher_round.png`;
    try {
      await sharp(Buffer.from(svg))
        .resize(size.size, size.size, { 
          fit: 'contain', 
          background: { r: 0, g: 26, b: 77, alpha: 1 } 
        })
        .png()
        .toFile(roundPath);
      console.log(`✅ Created ${size.name} ic_launcher_round: ${size.size}x${size.size}`);
    } catch (err) {
      console.error(`Error creating ${size.name} ic_launcher_round:`, err.message);
    }

    // ic_launcher_foreground.png
    const foregroundPath = `f:\\Serve\\technician-web\\android\\app\\src\\main\\res\\mipmap-${size.name}\\ic_launcher_foreground.png`;
    try {
      await sharp(Buffer.from(svg))
        .resize(size.size, size.size, { 
          fit: 'contain', 
          background: { r: 255, g: 255, b: 255, alpha: 0 } 
        })
        .png()
        .toFile(foregroundPath);
      console.log(`✅ Created ${size.name} ic_launcher_foreground: ${size.size}x${size.size}`);
    } catch (err) {
      console.error(`Error creating ${size.name} ic_launcher_foreground:`, err.message);
    }
  }
  console.log('\n✅ All icons created successfully!');
}

convertSvg();
