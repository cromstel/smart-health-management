import fs from 'fs';
import path from 'path';
import showdown from 'showdown';

const converter = new showdown.Converter();
const docsDir = './';
const outputDir = './dist/';
const structureFile = 'docs-structure.json';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const structure = JSON.parse(fs.readFileSync(path.join(docsDir, structureFile), 'utf8'));
const searchIndex = [];

const generateNav = (currentFile) => {
  let navHtml = '<nav id="nav-links" class="space-y-4">';
  structure.categories.forEach(category => {
    navHtml += `<div class="nav-category"><h2 class="text-lg font-semibold text-accent">${category.title}</h2>`;
    navHtml += '<ul class="space-y-2">';
    category.files.forEach(file => {
      const href = `${path.basename(file.file, '.md')}.html`;
      const isActive = currentFile === href;
      navHtml += `<li class="nav-item"><a href="${href}" class="hover:text-accent ${isActive ? 'text-accent font-bold' : ''}">${file.title}</a></li>`;
    });
    navHtml += '</ul></div>';
  });
  navHtml += '</nav>';
  return navHtml;
};

const template = (title, content, nav) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Smart Health Manager</title>
  <link href="../output.css" rel="stylesheet">
</head>
<body class="bg-navy-blue text-gray-300 font-sans">
  <div class="flex">
    <aside class="w-64 h-screen p-8 bg-sidebar-bg flex flex-col">
      <h1 class="text-2xl font-bold mb-4"><a href="index.html" class="text-white hover:text-accent">Smart Health Manager</a></h1>
      <input type="text" id="search-input" placeholder="Search docs..." class="w-full px-2 py-1 mb-4 bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:border-accent">
      <div class="overflow-y-auto">
        ${nav}
      </div>
    </aside>
    <main class="flex-1 p-8 h-screen overflow-y-auto">
      <article class="prose prose-invert lg:prose-xl prose-headings:text-accent prose-a:text-accent prose-strong:text-white">
        ${content}
      </article>
    </main>
  </div>
  <script src="search.js"></script>
</body>
</html>
`;

// Generate individual doc pages
structure.categories.forEach(category => {
  category.files.forEach(file => {
    const mdContent = fs.readFileSync(path.join(docsDir, file.file), 'utf8');
    const htmlContent = converter.makeHtml(mdContent);
    const nav = generateNav(`${path.basename(file.file, '.md')}.html`);
    const finalHtml = template(file.title, htmlContent, nav);
    fs.writeFileSync(path.join(outputDir, `${path.basename(file.file, '.md')}.html`), finalHtml);

    searchIndex.push({
      title: file.title,
      href: `${path.basename(file.file, '.md')}.html`,
      content: mdContent,
    });
  });
});

// Generate index page
const indexContent = `
  <h1>Welcome to the Smart Health Manager Documentation</h1>
  <p>This documentation provides a comprehensive guide to using, developing, and maintaining the Smart Health Manager application. Please use the navigation on the left to explore the different sections, or use the search bar to find specific information.</p>
`;
const indexNav = generateNav('index.html');
const indexHtml = template('Welcome', indexContent, indexNav);
fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);

// Write search index
fs.writeFileSync(path.join(outputDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2));