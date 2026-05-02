const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/modals/AddPackageModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the line with escaped quotes
const oldLine = 'className=\\"w-full border rounded-md px-3 py-2 text-sm bg-card text-white\\"';
const newLine = 'className="w-full border rounded-md px-3 py-2 text-sm bg-card text-white"';

content = content.replace(oldLine, newLine);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed AddPackageModal.jsx');
