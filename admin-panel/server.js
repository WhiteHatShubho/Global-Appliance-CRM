const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve static files from the build directory if it exists
app.use(express.static(path.join(__dirname, 'build')));

// Serve the main index.html for all routes (for React Router)
app.get('*', (req, res) => {
  // Try to serve from build first (production), then public (development)
  const buildPath = path.join(__dirname, 'build', 'index.html');
  const publicPath = path.join(__dirname, 'public', 'index.html');
  
  try {
    res.sendFile(buildPath);
  } catch (error) {
    res.sendFile(publicPath);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Admin panel should be accessible at http://localhost:${PORT}`);
});