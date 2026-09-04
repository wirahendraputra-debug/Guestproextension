const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');

// Add state.requests
code = code.replace(
  'let state = {\n  categories: [],\n  additionalNote: "",\n  customNotes: [],\n  additionalAttachedImages: []\n};',
  'let state = {\n  categories: [],\n  additionalNote: "",\n  customNotes: [],\n  requests: [],\n  additionalAttachedImages: []\n};'
);

code = code.replace(
  'state.customNotes = [];\n      if (el("additionalNoteInput")) el("additionalNoteInput").value = "";',
  'state.customNotes = [];\n      state.requests = [];\n      if (el("additionalNoteInput")) el("additionalNoteInput").value = "";'
);

code = code.replace(
  'state.customNotes = [];\n        if (el("additionalNoteInput")) el("additionalNoteInput").value = "";',
  'state.customNotes = [];\n        state.requests = [];\n        if (el("additionalNoteInput")) el("additionalNoteInput").value = "";'
);

// Add renderRequests
const renderRequestsStr = `
function renderRequests() {
  const container = el("requestsList");
  if (!container) return;
  container.innerHTML = "";
  
  if (!state.requests) state.requests = [];
  
  state.requests.forEach((req, idx) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "4px";
    wrap.style.padding = "10px";
    wrap.style.border = "1px solid var(--border)";
    wrap.style.borderRadius = "6px";
    wrap.style.background = "var(--bg)";
    
    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.justifyContent = "space-between";
    headerRow.style.alignItems = "center";
    
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Request title...";
    titleInput.value = req.title || "";
    titleInput.style.flex = "1";
    titleInput.style.padding = "6px";
    titleInput.style.border = "1px solid var(--border)";
    titleInput.style.borderRadius = "4px";
    titleInput.style.fontSize = "13px";
    titleInput.style.background = "var(--input-bg)";
    titleInput.style.color = "var(--text)";
    titleInput.addEventListener("input", (e) => {
      req.title = e.target.value;
      saveData();
    });
    
    const delBtn = document.createElement("button");
    delBtn.innerHTML = "&times;";
    delBtn.title = "Hapus request ini";
    delBtn.style.background = "transparent";
    delBtn.style.border = "none";
    delBtn.style.color = "var(--red)";
    delBtn.style.fontSize = "14px";
    delBtn.style.cursor = "pointer";
    delBtn.style.marginLeft = "8px";
    delBtn.addEventListener("click", () => {
      if(confirm("Hapus request ini?")) {
        state.requests.splice(idx, 1);
        saveData();
        renderRequests();
      }
    });
    
    headerRow.appendChild(titleInput);
    headerRow.appendChild(delBtn);
    
    const noteInput = document.createElement("textarea");
    noteInput.placeholder = "Isi detail request (wajib)...";
    noteInput.value = req.note || "";
    noteInput.rows = 2;
    noteInput.style.padding = "6px";
    noteInput.style.border = "1px solid var(--border)";
    noteInput.style.borderRadius = "4px";
    noteInput.style.fontSize = "13px";
    noteInput.style.resize = "vertical";
    noteInput.style.background = "var(--input-bg)";
    noteInput.style.color = "var(--text)";
    noteInput.addEventListener("input", (e) => {
      req.note = e.target.value;
      saveData();
    });
    
    wrap.appendChild(headerRow);
    wrap.appendChild(noteInput);
    
    container.appendChild(wrap);
  });
}
`;

code = code.replace(
  'function renderCustomNotes() {',
  renderRequestsStr + '\nfunction renderCustomNotes() {'
);

// Add event listener for + Add Request
const btnListenerStr = `
  const addRequestBtn = el("addRequestBtn");
  if (addRequestBtn && !addRequestBtn.hasAttribute("data-listener")) {
    addRequestBtn.setAttribute("data-listener", "true");
    addRequestBtn.addEventListener("click", () => {
      if (!state.requests) state.requests = [];
      state.requests.push({ title: "", note: "" });
      saveData();
      renderRequests();
      setTimeout(() => {
        const list = el("requestsList");
        if (list && list.lastElementChild) {
          list.lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 50);
    });
  }
`;

code = code.replace(
  'const addCustomNoteBtn = el("addCustomNoteBtn");',
  btnListenerStr + '\n  const addCustomNoteBtn = el("addCustomNoteBtn");'
);

// Update calls to renderCustomNotes to also call renderRequests
code = code.replaceAll(
  'if (typeof renderCustomNotes === "function") renderCustomNotes();',
  'if (typeof renderCustomNotes === "function") renderCustomNotes();\n      if (typeof renderRequests === "function") renderRequests();'
);
code = code.replaceAll(
  'renderCustomNotes();\n      });\n      \n      headerRow.appendChild(titleInput);',
  'renderCustomNotes();\n      });\n      \n      headerRow.appendChild(titleInput);' // Do nothing, just a safeguard
);

fs.writeFileSync('sidepanel.js', code);
console.log('Update script finished.');
