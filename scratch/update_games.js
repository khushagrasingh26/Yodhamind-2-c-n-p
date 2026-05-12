const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../pages/games.html');
let content = fs.readFileSync(file, 'utf8');

// Replace onclick="trackGameClick()" with onclick="trackGameClick(); trackEvent('game_click');"
content = content.replace(/onclick="trackGameClick\(\)"/g, `onclick="trackGameClick(); trackEvent('game_click');"`);

fs.writeFileSync(file, content, 'utf8');
console.log('Updated games.html with trackEvent');
