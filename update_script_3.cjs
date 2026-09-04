const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');

code = code.replaceAll(
  'state.customNotes = [];\n      if (el("additionalNoteInput")) el("additionalNoteInput").value = "";',
  'state.customNotes = [];\n      state.requests = [];\n      if (el("additionalNoteInput")) el("additionalNoteInput").value = "";'
);

code = code.replaceAll(
  'state.customNotes = [];\n        if (el("additionalNoteInput")) el("additionalNoteInput").value = "";',
  'state.customNotes = [];\n        state.requests = [];\n        if (el("additionalNoteInput")) el("additionalNoteInput").value = "";'
);

// We need to also add renderRequests() to the cancel logic just like we did with renderCustomNotes()
code = code.replaceAll(
  'if (typeof renderCustomNotes === "function") renderCustomNotes();',
  'if (typeof renderCustomNotes === "function") renderCustomNotes();\n      if (typeof renderRequests === "function") renderRequests();'
);

// Deduplicate renderRequests() calls just in case
code = code.replaceAll(
  'if (typeof renderRequests === "function") renderRequests();\n      if (typeof renderRequests === "function") renderRequests();',
  'if (typeof renderRequests === "function") renderRequests();'
);
code = code.replaceAll(
  'state.requests = [];\n      state.requests = [];',
  'state.requests = [];'
);
code = code.replaceAll(
  'state.requests = [];\n        state.requests = [];',
  'state.requests = [];'
);

fs.writeFileSync('sidepanel.js', code);
console.log('Update part 3 finished.');
