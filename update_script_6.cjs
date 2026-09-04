const fs = require('fs');
let code = fs.readFileSync('sidepanel.js', 'utf8');

const pasteListenerStr = `
      noteInput.addEventListener("paste", async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let idx = 0; idx < items.length; idx++) {
          if (items[idx].type.indexOf("image") === 0) {
            e.preventDefault();
            const file = items[idx].getAsFile();
            const submitBtn = el("finishSessionBtn");
            const oldText = submitBtn ? submitBtn.innerText : "";
            if (submitBtn) { submitBtn.innerText = "Processing Image..."; submitBtn.disabled = true; }
            
            try {
              const base64Str = await compressImage(file);
              req.attachedImages = req.attachedImages || [];
              req.attachedImages.push(base64Str);
              saveData();
              renderRequests();
            } catch (err) {
              alert("Gagal memproses gambar");
            } finally {
              if (submitBtn) { submitBtn.innerText = oldText; submitBtn.disabled = false; }
            }
            break; // only handle one image at a time
          }
        }
      });
      
      wrap.appendChild(headerRow);
      wrap.appendChild(noteInput);
  
      // Render Image Previews for Requests
      if (req.attachedImages && req.attachedImages.length > 0) {
        const previewWrap = document.createElement("div");
        previewWrap.style.display = "flex";
        previewWrap.style.flexWrap = "wrap";
        previewWrap.style.gap = "8px";
        previewWrap.style.marginTop = "4px";
        
        req.attachedImages.forEach((b64, imgIdx) => {
          const imgCont = document.createElement("div");
          imgCont.className = "image-preview-container";
          
          const imgEl = document.createElement("img");
          imgEl.src = b64;
          imgEl.className = "image-preview-thumbnail";
          imgEl.addEventListener("click", () => openImageModal(b64));
          
          const rmBtn = document.createElement("button");
          rmBtn.className = "btn-remove-image";
          rmBtn.innerHTML = "&times;";
          rmBtn.addEventListener("click", (e) => {
             e.stopPropagation();
             req.attachedImages.splice(imgIdx, 1);
             saveData();
             renderRequests();
          });
          
          imgCont.appendChild(imgEl);
          imgCont.appendChild(rmBtn);
          previewWrap.appendChild(imgCont);
        });
        wrap.appendChild(previewWrap);
      }
`;

const lines = code.split('\n');
let newLines = [];
let insideRenderRequests = false;
let foundWrapAppend = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function renderRequests()')) {
    insideRenderRequests = true;
  }
  
  if (insideRenderRequests && lines[i].includes('wrap.appendChild(headerRow);') && !foundWrapAppend) {
    foundWrapAppend = true;
    newLines.push(pasteListenerStr);
    insideRenderRequests = false; // Done processing
  } else if (!foundWrapAppend || !lines[i].includes('wrap.appendChild(headerRow);') && !lines[i].includes('wrap.appendChild(noteInput);')) {
     if (!(foundWrapAppend && lines[i].includes('wrap.appendChild(noteInput);'))) {
        newLines.push(lines[i]);
     }
  }
}

fs.writeFileSync('sidepanel.js', newLines.join('\n'));
console.log('Update renderRequests paste logic strictly line-by-line finished.');
