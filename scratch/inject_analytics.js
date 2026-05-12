const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'pages');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(f => {
    const p = path.join(dir, f);
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('_vercel/insights')) {
        content = content.replace('</head>', `    <!-- Vercel Analytics -->\n    <script>\n      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };\n    </script>\n    <script defer src="/_vercel/insights/script.js"></script>\n</head>`);
        fs.writeFileSync(p, content);
        console.log('Updated ' + f);
    }
});
