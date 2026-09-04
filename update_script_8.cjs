const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');

const targetStr = "    if (session.trainingMethod) {";
const requestsPayloadStr = `
    if (state.requests && state.requests.length > 0) {
      state.requests.forEach(req => {
        let finalNote = req.note ? req.note.replace(/\\[dY", Gambar Terlampir\\]/g, "").trim() : "";
        
        if (req.attachedImages && req.attachedImages.length > 0) {
          req.attachedImages.forEach(b64 => {
            finalNote += "\\n[IMAGE:" + b64 + "]\\n";
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

    if (session.trainingMethod) {`;

code = code.replace(targetStr, requestsPayloadStr);
fs.writeFileSync('sidepanel.js', code);
console.log('Update renderRequests payload injected successfully!');
