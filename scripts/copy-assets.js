const fs = require('fs');
const path = require('path');

// Ensure dist directories exist
if (!fs.existsSync('dist/ui')) {
  fs.mkdirSync('dist/ui', { recursive: true });
}
if (!fs.existsSync('dist/content')) {
  fs.mkdirSync('dist/content', { recursive: true });
}

// Copy HTML and CSS files from src/ui to dist/ui
const uiFiles = fs.readdirSync('src/ui').filter(f => f.endsWith('.html') || f.endsWith('.css'));
uiFiles.forEach(file => {
  fs.copyFileSync(
    path.join('src/ui', file),
    path.join('dist/ui', file)
  );
  console.log(`Copied ${file} to dist/ui/`);
});

// Copy CSS files from src/content to dist/content
if (fs.existsSync('src/content')) {
  const cssFiles = fs.readdirSync('src/content').filter(f => f.endsWith('.css'));
  cssFiles.forEach(file => {
    fs.copyFileSync(
      path.join('src/content', file),
      path.join('dist/content', file)
    );
    console.log(`Copied ${file} to dist/content/`);
  });
}

console.log('All assets copied successfully!');
