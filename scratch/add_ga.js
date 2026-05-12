const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '../pages');

const gaSnippet = `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-W7RQTL2ND7"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-W7RQTL2ND7');
</script>
`;

function addGA() {
    fs.readdir(pagesDir, (err, files) => {
        if (err) {
            console.error('Could not list directory:', err);
            process.exit(1);
        }

        files.forEach(file => {
            if (path.extname(file) === '.html') {
                const filePath = path.join(pagesDir, file);
                let content = fs.readFileSync(filePath, 'utf8');

                // Check if already injected
                if (content.includes('G-W7RQTL2ND7')) {
                    console.log(`GA already present in ${file}`);
                    return;
                }

                // Inject after <head>
                if (content.includes('<head>')) {
                    content = content.replace('<head>', `<head>\n${gaSnippet}`);
                    fs.writeFileSync(filePath, content, 'utf8');
                    console.log(`Injected GA into ${file}`);
                } else {
                    console.log(`No <head> found in ${file}`);
                }
            }
        });
    });
}

addGA();
