const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');
const replacement = fs.readFileSync('replacement_btn.txt', 'utf8');

const startStr = 'if (isNotesType) {\n        const addBtnWrap = document.createElement("div");';
const endStr = 'catDiv.appendChild(addBtnWrap);\n      }';

let start = code.indexOf(startStr);
let end = code.indexOf(endStr, start);

if (start !== -1 && end !== -1) {
  code = code.substring(0, start) + replacement + code.substring(end + endStr.length);
  fs.writeFileSync('sidepanel.js', code);
  console.log('Replaced successfully');
} else {
  console.log('Could not find boundaries');
}
