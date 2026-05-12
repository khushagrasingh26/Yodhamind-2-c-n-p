const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../pages');

const extraScript = `
<script>
function trackEvent(action) {
  if (typeof gtag === 'function') {
    gtag('event', action, {
      event_category: 'engagement',
      event_label: action
    });
  }
}
</script>
`;

fs.readdir(pagesDir, (err, files) => {
    if (err) throw err;
    files.forEach(file => {
        if (path.extname(file) === '.html') {
            const filePath = path.join(pagesDir, file);
            let content = fs.readFileSync(filePath, 'utf8');

            // Replace existing block or just append if not there
            if (!content.includes('function trackEvent(action)')) {
                const target = "gtag('config', 'G-W7RQTL2ND7');\n</script>";
                if (content.includes(target)) {
                    content = content.replace(target, target + extraScript);
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log(`Added trackEvent to ${file}`);
                }
            }
        }
    });
});
