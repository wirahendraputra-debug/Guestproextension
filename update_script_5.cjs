const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');

const requestsPayloadStr = `
    if (state.requests && state.requests.length > 0) {
      state.requests.forEach(req => {
        let finalNote = req.note ? req.note.replace(/\\[dY", Gambar Terlampir\\]/g, "").trim() : "";
        
        if (req.attachedImages && req.attachedImages.length > 0) {
          req.attachedImages.forEach(b64 => {
            finalNote += \`\\n[IMAGE:\${b64}]\\n\`;
          });
        }
        
        finalNote = finalNote.trim();
  
        if (req.title.trim() || finalNote) {
          notesPayload.push({
            category: "REQUEST",
            item: req.title.trim() || "Untitled Request",
            checked: true,
            note: finalNote
          });
        }
      });
    }
`;

const targetStr = `    if (session.trainingMethod) {
      notesPayload.push({
        category: "Additional Notes",
        item: "Status Training",
        checked: true,
        note: session.trainingMethod
      });
    }`;

code = code.replace(targetStr, requestsPayloadStr + '\n' + targetStr);

fs.writeFileSync('sidepanel.js', code);
console.log('Requests payload added.');
