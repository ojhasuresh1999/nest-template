const fs = require('fs');
const content = fs.readFileSync('src/app.module.ts', 'utf8');
const match = content.match(/@Module\(\{(?:[^}]|\n)*?imports:\s*\[([\s\S]*?)\]\s*,\s*controllers/);
if (match) {
  console.log("Matched imports array length:", match[1].length);
} else {
  console.log("No match found.");
}
