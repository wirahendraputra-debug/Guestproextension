const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');

// Update submitSession
code = code.replace(
  'if (cn.title.trim() || finalNote) {\n          notesPayload.push({\n            category: "Custom Notes",\n            item: cn.title.trim() || "Untitled Note",\n            checked: true,\n            note: finalNote\n          });\n        }\n      });\n    }',
  'if (cn.title.trim() || finalNote) {\n          notesPayload.push({\n            category: "Custom Notes",\n            item: cn.title.trim() || "Untitled Note",\n            checked: true,\n            note: finalNote\n          });\n        }\n      });\n    }\n\n    // Append requests to payload\n    if (state.requests && state.requests.length > 0) {\n      state.requests.forEach(req => {\n        if (req.title.trim() || req.note.trim()) {\n          notesPayload.push({\n            category: "REQUEST",\n            item: req.title.trim() || "Untitled Request",\n            checked: true,\n            note: req.note\n          });\n        }\n      });\n    }'
);

// Update render function to exclude dynamic REQUEST
code = code.replace(
  'state.categories.forEach((cat, catIndex) => {',
  'state.categories.forEach((cat, catIndex) => {\n    if (cat.name === "REQUEST") return; // Ignore dynamic REQUEST category since it is handled statically'
);

// Update load session logic for Edit Mode
code = code.replace(
  'if (n.category === "Custom Notes") {\n        state.customNotes.push({\n          title: n.item,\n          note: parsed.text,\n          attachedImages: parsed.attachedImages\n        });\n        return;\n      }',
  'if (n.category === "Custom Notes") {\n        state.customNotes.push({\n          title: n.item,\n          note: parsed.text,\n          attachedImages: parsed.attachedImages\n        });\n        return;\n      }\n      \n      if (n.category === "REQUEST") {\n        if(!state.requests) state.requests = [];\n        state.requests.push({\n          title: n.item,\n          note: parsed.text\n        });\n        return;\n      }'
);

fs.writeFileSync('sidepanel.js', code);
console.log('Update part 2 script finished.');
