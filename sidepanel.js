// ====== Default checklist (fallback jika belum ada dari admin) ======
const DEFAULT_DATA = {
  categories: [
    {
      id: "cat-dasar",
      name: "Dasar & Navigasi Sistem",
      items: [
        { id: "i1", text: "Login & struktur user/role", checked: false },
        { id: "i2", text: "Overview dashboard utama", checked: false },
        { id: "i3", text: "Navigasi menu & layout umum", checked: false },
      ],
    },
    {
      id: "cat-reservasi",
      name: "Reservasi",
      items: [
        { id: "i4", text: "Membuat reservasi baru", checked: false },
        { id: "i5", text: "Edit / modify reservasi", checked: false },
        { id: "i6", text: "Cancel & no-show reservasi", checked: false },
        { id: "i7", text: "Group booking", checked: false },
        { id: "i8", text: "Waitlist", checked: false },
      ],
    },
    {
      id: "cat-frontoffice",
      name: "Front Office",
      items: [
        { id: "i9", text: "Check-in tamu", checked: false },
        { id: "i10", text: "Check-out tamu", checked: false },
        { id: "i11", text: "Walk-in guest", checked: false },
        { id: "i12", text: "Room change / room move", checked: false },
        { id: "i13", text: "Room block", checked: false },
      ],
    },
    {
      id: "cat-housekeeping",
      name: "Housekeeping",
      items: [
        { id: "i14", text: "Update status kamar (clean/dirty/inspected)", checked: false },
        { id: "i15", text: "Housekeeping report", checked: false },
        { id: "i16", text: "Maintenance / Out of Order (OOO)", checked: false },
      ],
    },
    {
      id: "cat-rate",
      name: "Rate & Inventory",
      items: [
        { id: "i17", text: "Rate management", checked: false },
        { id: "i18", text: "Room type & allotment", checked: false },
        { id: "i19", text: "Restriction / close-out", checked: false },
      ],
    },
    {
      id: "cat-kasir",
      name: "Kasir & Billing",
      items: [
        { id: "i20", text: "Posting charges ke folio", checked: false },
        { id: "i21", text: "Split bill", checked: false },
        { id: "i22", text: "Payment & deposit", checked: false },
        { id: "i23", text: "Cetak folio / invoice", checked: false },
      ],
    },
    {
      id: "cat-laporan",
      name: "Laporan",
      items: [
        { id: "i24", text: "Daily report", checked: false },
        { id: "i25", text: "Occupancy & revenue report", checked: false },
        { id: "i26", text: "Night audit", checked: false },
      ],
    },
    {
      id: "cat-lain",
      name: "Lain-lain",
      items: [
        { id: "i27", text: "User management & permission", checked: false },
        { id: "i28", text: "Troubleshooting umum & FAQ client", checked: false },
      ],
    },
  ],
};

let state = { categories: [] };
let session = { trainerName: "", clientName: "", clientId: "", date: "", startTime: null, packageId: "", packageName: "", isEditMode: false, editSessionId: null, startLocation: "", trainingMethod: "Visit Training" };

let notionEditor = null;
let isNotionMode = false;

let timerInterval = null;

// Geolocation Helper
function getCurrentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(`${pos.coords.latitude}, ${pos.coords.longitude}`),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          alert("Izin Akses Lokasi (Location) ditolak!\n\nSistem sangat membutuhkan lokasi Anda untuk bukti report. Mohon izinkan akses lokasi (Location) pada pengaturan peramban/browser Anda (klik ikon 🔒 di sebelah kiri URL address bar).");
        } else if (err.code === err.TIMEOUT) {
          console.warn("Location timeout, using fallback or unknown.");
        }
        resolve(null);
      },
      { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
    );
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const updateTimer = () => {
    if (session.isEditMode) {
      if (el("sessionTimer")) {
        el("sessionTimer").innerText = "Editing";
      }
      return;
    }
    
    if (!session.startTime) return;
    const elapsed = Date.now() - session.startTime;
    if (el("sessionTimer")) {
      el("sessionTimer").innerText = formatDuration(elapsed);
    }
  };
  updateTimer(); // call once immediately
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

const el = (id) => document.getElementById(id);

// ====== View Logic ======
function showAppView() {
  if (el("loginView")) el("loginView").classList.add("hidden");
  if (el("setupView")) el("setupView").classList.add("hidden");
  if (el("editSessionView")) el("editSessionView").classList.add("hidden");
  if (el("appView")) el("appView").classList.remove("hidden");
  
  if (el("displayClientName")) {
    el("displayClientName").textContent = session.clientName + (session.date ? ` (${session.date})` : "");
  }
  if (el("displayPackageName")) {
    el("displayPackageName").textContent = session.packageName ? `📦 ${session.packageName}` : '';
  }
}

let globalClientNames = [];

async function loadClientSuggestions() {
  try {
    let allData = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const headers = { ...supabaseHeaders, "Range": `${offset}-${offset + limit - 1}` };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/guestpro_leads?select=lead_id,property`, { headers });
      const data = await res.json();
      
      if (data && !data.error && data.length > 0) {
        allData = allData.concat(data);
        offset += limit;
        if (data.length < limit) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    if (allData.length > 0) {
      const seen = new Set();
      globalClientNames = [];
      allData.forEach(d => {
        if (!d.property) return;
        const name = d.property.trim();
        const lower = name.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          globalClientNames.push({ id: d.lead_id, name: name });
        }
      });
    }
  } catch(e) {
    console.error("Failed to load client suggestions", e);
  }
}

function showSetupView() {
  if (el("loginView")) el("loginView").classList.add("hidden");
  if (el("appView")) el("appView").classList.add("hidden");
  if (el("editSessionView")) el("editSessionView").classList.add("hidden");
  if (el("setupView")) {
    el("setupView").classList.remove("hidden");
    if (el("setupDate")) el("setupDate").value = session.date || new Date().toISOString().slice(0, 10);
    loadClientSuggestions();
  }
}

function showEditSessionView() {
  if (el("loginView")) el("loginView").classList.add("hidden");
  if (el("appView")) el("appView").classList.add("hidden");
  if (el("setupView")) el("setupView").classList.add("hidden");
  if (el("editSessionView")) {
    el("editSessionView").classList.remove("hidden");
    loadTrainerSessions();
  }
}

function showLoginView() {
  if (el("loginView")) el("loginView").classList.remove("hidden");
  if (el("setupView")) el("setupView").classList.add("hidden");
  if (el("editSessionView")) el("editSessionView").classList.add("hidden");
  if (el("appView")) el("appView").classList.add("hidden");
}

// ====== Storage ======
function loadAll() {
  chrome.storage.local.get(["session", "loggedInTrainer"], async (res) => {
    session = res.session || { trainerName: "", clientName: "", date: new Date().toISOString().slice(0, 10), packageId: "", packageName: "", isEditMode: false, editSessionId: null, startLocation: "", trainingMethod: "Visit Training" };
    
    if (res.loggedInTrainer) {
      session.trainerName = res.loggedInTrainer.name || res.loggedInTrainer.username;
      
      // Update form setup if exist
      if (el("setupClientName")) el("setupClientName").value = session.clientName || "";
      if (el("setupTrainingMethod")) el("setupTrainingMethod").value = session.trainingMethod || "Visit Training";
      // package select will be set after fetch
      
      // Jika clientName belum diisi, tampilkan Setup View
      if (!session.clientName) {
        showSetupView();
      } else {
        showAppView();
        if (session.startTime) startTimer();
      }
    } else {
      showLoginView();
    }

    try {
      const modRes = await fetch(`${SUPABASE_URL}/rest/v1/modules?select=*`, { headers: supabaseHeaders });
      const modData = await modRes.json();
      let allPackages = [];
      if (modData && modData.length > 0) {
        const dataPayload = modData[0].data;
        if (dataPayload.packages) {
          allPackages = dataPayload.packages;
        } else if (dataPayload.categories) {
          allPackages = [{ id: 'pkg-default', name: 'Default Package', categories: dataPayload.categories }];
        }
      }
      
      // Load packages into dropdown
      const pkgSelect = el("setupPackage");
      if (pkgSelect) {
        pkgSelect.innerHTML = '<option value="">Select a package...</option>';
        allPackages.forEach(pkg => {
          const opt = document.createElement("option");
          opt.value = pkg.id;
          opt.textContent = pkg.name;
          pkgSelect.appendChild(opt);
        });
      }

      // Restore active package state based on session
      if (session.packageId) {
        const activePkg = allPackages.find(p => p.id === session.packageId);
        if (activePkg) {
          state = { categories: activePkg.categories };
        } else {
          state = { categories: [] };
        }
      } else {
        state = { categories: [] };
      }

      // Keep reference to all packages in a global variable so we can use it in Setup form submission
      window.allPackages = allPackages;
    } catch(e) {
      console.error(e);
      // Fallback
      chrome.storage.local.get(["checklistData"], (r) => {
        state = r.checklistData || structuredClone(DEFAULT_DATA);
        render();
      });
      return;
    }

    chrome.storage.local.get(["checklistData"], (r) => {
      if(r.checklistData) {
        r.checklistData.categories.forEach(oldCat => {
          const newCat = state.categories.find(c => c.id === oldCat.id);
          if(newCat) {
            oldCat.items.forEach(oldItem => {
              if(oldItem.checked) {
                const newItem = newCat.items.find(i => i.id === oldItem.id);
                if(newItem) newItem.checked = true;
              }
            });
          }
        });
        state.additionalNote = r.checklistData.additionalNote || "";
        state.customNotes = r.checklistData.customNotes || [];
        if (el("additionalNoteInput")) el("additionalNoteInput").value = state.additionalNote;
      }
      render();
    });
  });
}

function saveData() {
  chrome.storage.local.set({ checklistData: state });
}
function saveSession() {
  chrome.storage.local.set({ session });
}

// ====== Rendering ======
function closeAllStatusMenus() {
  document.querySelectorAll('.status-menu').forEach(m => {
    m.classList.remove('open-up');
  });
  document.querySelectorAll('.dropdown-open').forEach(node => {
    node.classList.remove('dropdown-open');
  });
}

function render() {
  const scrollArea = el("appScrollArea");
  const prevScrollTop = scrollArea ? scrollArea.scrollTop : 0;
  const container = el("checklistContainer");
  container.innerHTML = "";

  const searchInputEl = el("searchInput");
  const searchQuery = searchInputEl ? searchInputEl.value.toLowerCase() : "";

  let totalItems = 0;
  let checkedItems = 0;

  state.categories.forEach((cat) => {
    // Filter items based on search query
    const filteredItems = cat.items.filter(i => i.text.toLowerCase().includes(searchQuery));
    
    // Only process category if it has matching items
    if (filteredItems.length === 0) return;

    const isNotesType = cat.type === "notes";
    const isStatusType = cat.type === "status";

    if (!isNotesType) {
      totalItems += filteredItems.length;
      checkedItems += filteredItems.filter((i) => i.checked || (isStatusType && i.statusValue)).length;
    }

    const catDiv = document.createElement("div");
    catDiv.className = "category";

    const catChecked = filteredItems.filter((i) => i.checked || (isStatusType && i.statusValue)).length;
    const header = document.createElement("div");
    header.className = "category-header";
    header.innerHTML = `
      <div class="category-title-wrap">
        <span class="category-title">${escapeHtml(cat.name)}</span>
        ${!isNotesType ? `<span class="category-count">(${catChecked}/${filteredItems.length})</span>` : ''}
      </div>
    `;
    catDiv.appendChild(header);

    const itemList = document.createElement("div");
    itemList.className = "item-list";

    filteredItems.forEach((item) => {
      const wrapper = document.createElement("div");
      
      if (isNotesType) {
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.gap = "4px";
        wrapper.style.padding = "8px";
        wrapper.style.border = "1px solid var(--border)";
        wrapper.style.borderRadius = "6px";
        wrapper.style.background = "var(--bg)";
        wrapper.style.marginBottom = "8px";

        const headerRow = document.createElement("div");
        headerRow.style.display = "flex";
        headerRow.style.justifyContent = "space-between";
        headerRow.style.alignItems = "center";

        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.placeholder = "Request title...";
        titleInput.value = item.text || "";
        titleInput.style.flex = "1";
        titleInput.style.minWidth = "0";
        titleInput.style.padding = "6px";
        titleInput.style.border = "1px solid var(--border)";
        titleInput.style.borderRadius = "4px";
        titleInput.style.fontSize = "13px";
        titleInput.style.background = "var(--input-bg)";
        titleInput.style.color = "var(--text)";
        titleInput.addEventListener("input", (e) => {
          item.text = e.target.value;
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
            cat.items = cat.items.filter(i => i.id !== item.id);
            saveData();
            render();
          }
        });

        headerRow.appendChild(titleInput);
        headerRow.appendChild(delBtn);

        const noteInput = document.createElement("textarea");
        noteInput.placeholder = "Isi catatan khusus (wajib)...";
        noteInput.value = item.note || "";
        noteInput.rows = 2;
        noteInput.style.padding = "6px";
        noteInput.style.border = "1px solid var(--border)";
        noteInput.style.borderRadius = "4px";
        noteInput.style.fontSize = "13px";
        noteInput.style.resize = "vertical";
        noteInput.style.background = "var(--input-bg)";
        noteInput.style.color = "var(--text)";
        noteInput.addEventListener("input", (e) => {
          item.note = e.target.value;
          saveData();
        });

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
                item.attachedImages = item.attachedImages || [];
                item.attachedImages.push(base64Str);
                saveData();
                render();
              } catch (err) {
                alert("Gagal memproses gambar");
              } finally {
                if (submitBtn) { submitBtn.innerText = oldText; submitBtn.disabled = false; }
              }
              break; 
            }
          }
        });

        wrapper.appendChild(headerRow);
        wrapper.appendChild(noteInput);

        // Render Image Previews
        if (item.attachedImages && item.attachedImages.length > 0) {
          const previewWrap = document.createElement("div");
          previewWrap.style.display = "flex";
          previewWrap.style.flexWrap = "wrap";
          previewWrap.style.gap = "8px";
          previewWrap.style.marginTop = "8px";
          
          item.attachedImages.forEach((b64, imgIdx) => {
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
               item.attachedImages.splice(imgIdx, 1);
               saveData();
               render();
            });
            
            imgCont.appendChild(imgEl);
            imgCont.appendChild(rmBtn);
            previewWrap.appendChild(imgCont);
          });
          wrapper.appendChild(previewWrap);
        }

      } else {
        wrapper.className = "item-wrapper";

        const row = document.createElement("div");
        row.className = "item-row" + (isStatusType ? " status-row" : "") + ((item.checked || item.statusValue) ? " checked" : "");

        const content = document.createElement("div");
        content.className = "item-content";
        const mandatoryMark = item.isMandatory ? `<span style="color:#ef4444; margin-left:4px; font-weight:bold;" title="Wajib diisi catatan jika dicentang">*</span>` : "";
        
        if (isStatusType) {
          let bgColor = 'var(--input-bg)';
          let textColor = 'var(--text-muted)';
          let borderColor = 'var(--border)';
          let displayValue = 'Status...';
          
          if (item.statusValue === 'Done') {
            bgColor = 'rgba(34, 197, 94, 0.15)';
            textColor = '#16a34a';
            borderColor = 'rgba(34, 197, 94, 0.3)';
            displayValue = 'Done';
          } else if (item.statusValue === 'No Use') {
            bgColor = 'rgba(107, 114, 128, 0.15)';
            textColor = '#6b7280';
            borderColor = 'rgba(107, 114, 128, 0.3)';
            displayValue = 'No Use';
          } else if (item.statusValue === 'Followup') {
            bgColor = 'rgba(245, 158, 11, 0.15)';
            textColor = '#d97706';
            borderColor = 'rgba(245, 158, 11, 0.3)';
            displayValue = 'Followup';
          }

          content.innerHTML = `
            <span class="item-text" data-cat="${cat.id}" data-item="${item.id}" style="cursor: default;">${escapeHtml(item.text)}${mandatoryMark}</span>
            <div class="custom-status-dropdown">
              <div class="status-pill" data-cat="${cat.id}" data-item="${item.id}" style="background: ${bgColor}; color: ${textColor}; border-color: ${borderColor};">
                <span>${displayValue}</span>
                <svg class="status-pill-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              
              <div class="status-menu">
                <div class="status-option${!item.statusValue ? ' selected' : ''}" data-value="" data-cat="${cat.id}" data-item="${item.id}" style="color: var(--text-muted);">
                   <span style="width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--text-muted); flex-shrink: 0;"></span> Kosongkan
                </div>
                <div class="status-option${item.statusValue === 'Done' ? ' selected' : ''}" data-value="Done" data-cat="${cat.id}" data-item="${item.id}">
                   <span style="width: 8px; height: 8px; border-radius: 50%; background: #16a34a; flex-shrink: 0;"></span> Done
                </div>
                <div class="status-option${item.statusValue === 'No Use' ? ' selected' : ''}" data-value="No Use" data-cat="${cat.id}" data-item="${item.id}">
                   <span style="width: 8px; height: 8px; border-radius: 50%; background: #6b7280; flex-shrink: 0;"></span> No Use
                </div>
                <div class="status-option${item.statusValue === 'Followup' ? ' selected' : ''}" data-value="Followup" data-cat="${cat.id}" data-item="${item.id}">
                   <span style="width: 8px; height: 8px; border-radius: 50%; background: #d97706; flex-shrink: 0;"></span> Followup
                </div>
              </div>
            </div>
          `;
        } else {
          content.innerHTML = `
            <input type="checkbox" data-cat="${cat.id}" data-item="${item.id}" ${item.checked ? "checked" : ""} />
            <span class="item-text" data-cat="${cat.id}" data-item="${item.id}">${escapeHtml(item.text)}${mandatoryMark}</span>
          `;
        }

        row.appendChild(content);

        const noteBtn = document.createElement("button");
        noteBtn.className = "note-btn" + (item.showNote || item.note ? " active" : "");
        noteBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
        noteBtn.title = "Add Note";
        noteBtn.addEventListener("click", () => {
          item.showNote = !item.showNote;
          saveData();
          render();
        });
        row.appendChild(noteBtn);
        
        wrapper.appendChild(row);

        const noteBox = document.createElement("div");
        noteBox.className = "note-box" + (item.showNote || item.note ? " show" : "");

        const textarea = document.createElement("textarea");
        textarea.placeholder = "Note (optional)...";
        textarea.value = item.note || "";
        textarea.rows = 2;
        textarea.addEventListener("input", (e) => {
          item.note = e.target.value;
          saveData();
        });
        
        textarea.addEventListener("paste", async (e) => {
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
                item.attachedImages = item.attachedImages || [];
                item.attachedImages.push(base64Str);
                saveData();
                render();
              } catch (err) {
                alert("Gagal memproses gambar");
              } finally {
                if (submitBtn) { submitBtn.innerText = oldText; submitBtn.disabled = false; }
              }
              break; 
            }
          }
        });
        
        noteBox.appendChild(textarea);
        
        // Render Image Previews
        if (item.attachedImages && item.attachedImages.length > 0) {
          const previewWrap = document.createElement("div");
          previewWrap.style.display = "flex";
          previewWrap.style.flexWrap = "wrap";
          previewWrap.style.gap = "8px";
          previewWrap.style.marginTop = "8px";
          
          item.attachedImages.forEach((b64, imgIdx) => {
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
               item.attachedImages.splice(imgIdx, 1);
               saveData();
               render();
            });
            
            imgCont.appendChild(imgEl);
            imgCont.appendChild(rmBtn);
            previewWrap.appendChild(imgCont);
          });
          noteBox.appendChild(previewWrap);
        }
        
        wrapper.appendChild(noteBox);
      }

      itemList.appendChild(wrapper);
    });


    catDiv.appendChild(itemList);
      
            if (isNotesType) {
        const addBtnWrap = document.createElement("div");
        addBtnWrap.style.padding = "0 14px 10px 14px";
        addBtnWrap.style.display = "flex";
        addBtnWrap.style.justifyContent = "center";
        addBtnWrap.style.background = "var(--bg)";
        addBtnWrap.style.borderRadius = "0 0 7px 7px";
        
        const addBtn = document.createElement("button");
        addBtn.innerHTML = "+ Add Request";
        addBtn.className = "footer-btn";
        addBtn.style.width = "100%";
        addBtn.style.background = "var(--input-bg)";
        addBtn.style.border = "1px dashed var(--primary)";
        addBtn.style.color = "var(--primary)";
        addBtn.style.padding = "8px";
        addBtn.style.fontSize = "13px";
        addBtn.style.cursor = "pointer";
        addBtn.style.borderRadius = "4px";

        addBtn.title = "Add New Request";
        
        addBtn.addEventListener("click", () => {
          cat.items.push({
            id: "req-" + Date.now(),
            text: "",
            note: "",
            checked: true
          });
          saveData();
          render();
        });
        
        addBtnWrap.appendChild(addBtn);
        catDiv.appendChild(addBtnWrap);
      }


      container.appendChild(catDiv);
  });

  if(el("progressFill")) {
    el("progressFill").style.width = totalItems ? `${(checkedItems / totalItems) * 100}%` : "0%";
    el("progressLabel").textContent = `${checkedItems} / ${totalItems} selesai`;
  }

  attachDynamicListeners();
  renderCustomNotes();
  if (scrollArea && prevScrollTop > 0) {
    scrollArea.scrollTop = prevScrollTop;
  }
}


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
    titleInput.style.minWidth = "0";
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

    
    container.appendChild(wrap);
  });
}

function renderCustomNotes() {
  const container = el("customNotesList");
  if (!container) return;
  container.innerHTML = "";
  if (!state.customNotes) state.customNotes = [];
  
  state.customNotes.forEach((cn, idx) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "4px";
    wrap.style.padding = "8px";
    wrap.style.border = "1px solid var(--border)";
    wrap.style.borderRadius = "6px";
    wrap.style.background = "var(--bg)";
    
    const headerRow = document.createElement("div");
    headerRow.style.display = "flex";
    headerRow.style.justifyContent = "space-between";
    headerRow.style.alignItems = "center";
    
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.placeholder = "Judul Catatan Khusus...";
    titleInput.value = cn.title || "";
    titleInput.style.flex = "1";
    titleInput.style.minWidth = "0";
    titleInput.style.padding = "6px";
    titleInput.style.border = "1px solid var(--border)";
    titleInput.style.borderRadius = "4px";
    titleInput.style.fontSize = "13px";
    titleInput.style.background = "var(--input-bg)";
    titleInput.style.color = "var(--text)";
    titleInput.addEventListener("input", (e) => {
      cn.title = e.target.value;
      saveData();
    });
    
    const delBtn = document.createElement("button");
    delBtn.innerHTML = "✖";
    delBtn.title = "Hapus catatan ini";
    delBtn.style.background = "transparent";
    delBtn.style.border = "none";
    delBtn.style.color = "var(--red)";
    delBtn.style.fontSize = "14px";
    delBtn.style.cursor = "pointer";
    delBtn.style.marginLeft = "8px";
    delBtn.addEventListener("click", () => {
      state.customNotes.splice(idx, 1);
      saveData();
      renderCustomNotes();
    });
    
    headerRow.appendChild(titleInput);
    headerRow.appendChild(delBtn);
    
    const noteInput = document.createElement("textarea");
    noteInput.placeholder = "Isi catatan khusus (wajib)...";
    noteInput.value = cn.note || "";
    noteInput.rows = 2;
    noteInput.style.padding = "6px";
    noteInput.style.border = "1px solid var(--border)";
    noteInput.style.borderRadius = "4px";
    noteInput.style.fontSize = "13px";
    noteInput.style.resize = "vertical";
    noteInput.style.background = "var(--input-bg)";
    noteInput.style.color = "var(--text)";
    noteInput.addEventListener("input", (e) => {
      cn.note = e.target.value;
      saveData();
    });

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
            cn.attachedImages = cn.attachedImages || [];
            cn.attachedImages.push(base64Str);
            saveData();
            renderCustomNotes();
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

    // Render Image Previews for Custom Notes
    if (cn.attachedImages && cn.attachedImages.length > 0) {
      const previewWrap = document.createElement("div");
      previewWrap.style.display = "flex";
      previewWrap.style.flexWrap = "wrap";
      previewWrap.style.gap = "8px";
      previewWrap.style.marginTop = "8px";
      
      cn.attachedImages.forEach((b64, imgIdx) => {
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
           cn.attachedImages.splice(imgIdx, 1);
           saveData();
           renderCustomNotes();
        });
        
        imgCont.appendChild(imgEl);
        imgCont.appendChild(rmBtn);
        previewWrap.appendChild(imgCont);
      });
      wrap.appendChild(previewWrap);
    }
    container.appendChild(wrap);
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// ====== Event handling ======
function attachDynamicListeners() {
  document.querySelectorAll('.checklist-container input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const catId = e.target.dataset.cat;
      const itemId = e.target.dataset.item;
      toggleItem(catId, itemId, e.target.checked);
    });
  });

  document.querySelectorAll('.status-pill').forEach((pill) => {
    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      const dropdown = pill.closest('.custom-status-dropdown');
      const menu = dropdown ? dropdown.querySelector('.status-menu') : pill.nextElementSibling;
      const isCurrentlyOpen = dropdown ? dropdown.classList.contains('dropdown-open') : false;

      closeAllStatusMenus();

      if (!isCurrentlyOpen && dropdown && menu) {
        const row = pill.closest('.item-row');
        const wrapper = pill.closest('.item-wrapper');
        const category = pill.closest('.category');

        dropdown.classList.add('dropdown-open');
        if (row) row.classList.add('dropdown-open');
        if (wrapper) wrapper.classList.add('dropdown-open');
        if (category) category.classList.add('dropdown-open');

        const scrollArea = el('appScrollArea') || el('checklistContainer');
        const pillRect = pill.getBoundingClientRect();
        const menuHeight = menu.offsetHeight || 150;
        const bounds = scrollArea ? scrollArea.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
        const spaceBelow = Math.min(bounds.bottom, window.innerHeight) - pillRect.bottom;
        const spaceAbove = pillRect.top - Math.max(bounds.top, 0);

        if (spaceBelow < menuHeight + 10 && spaceAbove > spaceBelow) {
          menu.classList.add('open-up');
        } else {
          menu.classList.remove('open-up');
        }
      }
    });
  });

  document.querySelectorAll('.status-option').forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const catId = opt.dataset.cat;
      const itemId = opt.dataset.item;
      const val = opt.dataset.value;
      const cat = state.categories.find((c) => c.id === catId);
      const item = cat.items.find((i) => i.id === itemId);
      item.statusValue = val;
      item.checked = (val === "Done");
      closeAllStatusMenus();
      saveData();
      render();
    });
  });

  document.querySelectorAll(".item-text").forEach((span) => {
    span.addEventListener("click", (e) => {
      const catId = e.target.dataset.cat;
      const itemId = e.target.dataset.item;
      const cat = state.categories.find((c) => c.id === catId);
      if (cat && cat.type === "status") return; // Do not toggle on text click for status items
      const item = cat.items.find((i) => i.id === itemId);
      toggleItem(catId, itemId, !item.checked);
    });
  });

  // Initial migration for additional notes images
  if (state.additionalAttachedImage && !state.additionalAttachedImages) {
    state.additionalAttachedImages = [];
    state.additionalAttachedImage = null;
  }

  const additionalNoteInput = el("additionalNoteInput");
  if (additionalNoteInput) {
    additionalNoteInput.addEventListener("input", (e) => {
      state.additionalNote = e.target.value;
      saveData();
    });
    
    // Remove old paste listeners to avoid duplicates
    const newAdditionalNoteInput = additionalNoteInput.cloneNode(true);
    additionalNoteInput.parentNode.replaceChild(newAdditionalNoteInput, additionalNoteInput);
    
    newAdditionalNoteInput.addEventListener("input", (e) => {
      state.additionalNote = e.target.value;
      saveData();
    });

    newAdditionalNoteInput.addEventListener("paste", async (e) => {
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
            state.additionalAttachedImages = state.additionalAttachedImages || [];
            state.additionalAttachedImages.push(base64Str);
            saveData();
            render();
          } catch (err) {
            alert("Gagal memproses gambar");
          } finally {
            if (submitBtn) { submitBtn.innerText = oldText; submitBtn.disabled = false; }
          }
          break;
        }
      }
    });

    // Render Additional Previews
    let addPreviewWrap = document.getElementById("addPreviewWrap");
    if (!addPreviewWrap) {
      addPreviewWrap = document.createElement("div");
      addPreviewWrap.id = "addPreviewWrap";
      addPreviewWrap.style.display = "flex";
      addPreviewWrap.style.flexWrap = "wrap";
      addPreviewWrap.style.gap = "8px";
      addPreviewWrap.style.marginTop = "8px";
      addPreviewWrap.style.padding = "0 14px";
      newAdditionalNoteInput.parentNode.parentNode.insertBefore(addPreviewWrap, newAdditionalNoteInput.parentNode.nextSibling);
    }
    
    addPreviewWrap.innerHTML = "";
    if (state.additionalAttachedImages && state.additionalAttachedImages.length > 0) {
      state.additionalAttachedImages.forEach((b64, imgIdx) => {
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
           state.additionalAttachedImages.splice(imgIdx, 1);
           saveData();
           render();
        });
        
        imgCont.appendChild(imgEl);
        imgCont.appendChild(rmBtn);
        addPreviewWrap.appendChild(imgCont);
      });
    }
  }

  
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

  const addCustomNoteBtn = el("addCustomNoteBtn");
  if (addCustomNoteBtn && !addCustomNoteBtn.hasAttribute("data-listener")) {
    addCustomNoteBtn.setAttribute("data-listener", "true");
    addCustomNoteBtn.addEventListener("click", () => {
      if (!state.customNotes) state.customNotes = [];
      state.customNotes.push({ title: "", note: "" });
      saveData();
      renderCustomNotes();
      setTimeout(() => {
        const list = el("customNotesList");
        if (list && list.lastElementChild) {
          list.lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 50);
    });
  }
}

function toggleItem(catId, itemId, checked) {
  const cat = state.categories.find((c) => c.id === catId);
  if (!cat) return;
  const item = cat.items.find((i) => i.id === itemId);
  if (!item) return;
  item.checked = checked;
  
  // Auto-expand note box if item is mandatory and checked
  if (item.isMandatory && checked) {
    item.showNote = true;
  }
  
  saveData();
  render();
}

// ====== Top-level controls ======

// Login Logic
if (el("loginForm")) {
  el("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = el("loginUsername").value.trim();
    const password = el("loginPassword").value.trim();
    const btn = el("loginBtn");
    const err = el("loginError");
    
    try {
      btn.textContent = "Loading...";
      btn.disabled = true;
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=id,username,password,name&username=eq.${encodeURIComponent(username)}`, { headers: supabaseHeaders });
      
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data && data.length > 0 && data[0].password === password) {
        // Success
        const user = data[0];
        chrome.storage.local.set({ loggedInTrainer: user });
        session.trainerName = user.name || user.username;
        saveSession();
        el("loginUsername").value = "";
        el("loginPassword").value = "";
        
        // Cek apakah langsung ke app atau setup
        if (session.clientName) {
          showAppView();
        } else {
          showSetupView();
        }
      } else {
        err.classList.remove("hidden");
      }
    } catch (error) {
      console.error(error);
      err.textContent = "Gagal terhubung ke server.";
      err.classList.remove("hidden");
    } finally {
      btn.textContent = "Masuk";
      btn.disabled = false;
    }
  });
}

// Setup Logic
if (el("setupClientName")) {
  function renderSuggestions() {
    const val = el("setupClientName").value;
    const box = el("clientSuggestionsBox");
    if (!box) return;
    box.innerHTML = '';
    
    const matches = globalClientNames.filter(client => client.name.toLowerCase().includes(val.toLowerCase()));
    
    if (matches.length > 0) {
      box.classList.remove("hidden");
      // Limit to 50 suggestions to avoid performance issues
      matches.slice(0, 50).forEach(match => {
        const item = document.createElement("div");
        item.className = "autocomplete-item";
        item.textContent = match.name;
        item.addEventListener("click", function() {
          el("setupClientName").value = match.name;
          el("setupClientName").dataset.leadId = match.id;
          box.classList.add("hidden");
        });
        box.appendChild(item);
      });
    } else {
      box.classList.add("hidden");
    }
  }

  el("setupClientName").addEventListener("input", (e) => {
    e.target.removeAttribute('data-lead-id');
    renderSuggestions();
  });
  el("setupClientName").addEventListener("focus", renderSuggestions);
  el("setupClientName").addEventListener("click", renderSuggestions);


  document.addEventListener("click", function (e) {
    if (e.target !== el("setupClientName")) {
      el("clientSuggestionsBox")?.classList.add("hidden");
    }
  });
}

if (el("setupForm")) {
  el("setupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const leadId = el("setupClientName").dataset.leadId;
    if (!leadId && el("setupClientName").value.trim() !== "") {
      alert("Please select a valid Client / Hotel Name from the dropdown suggestions.");
      return;
    }

    // Disable button and show loading for GPS
    const submitBtn = el("setupForm").querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Mendeteksi Lokasi...";
    }
    
    // Mendapatkan lokasi Start
    const startLoc = await getCurrentLocation();
    session.startLocation = startLoc || "Unknown";
    
    session.clientName = el("setupClientName").value;
    session.clientId = leadId || "";
    session.date = new Date().toISOString().slice(0, 10);
    session.trainingMethod = el("setupTrainingMethod").value;
    session.packageId = el("setupPackage").value;
    
    // Find selected package name
    const selectedPkg = window.allPackages?.find(p => p.id === session.packageId);
    session.packageName = selectedPkg ? selectedPkg.name : "";
    
    if (selectedPkg) {
      state = { categories: selectedPkg.categories };
      saveData();
      render();
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Start Training";
    }

    session.startTime = Date.now();
    saveSession();
    showAppView();
    startTimer();
  });
}

// Search Logic
if (el("searchInput")) {
  el("searchInput").addEventListener("input", () => {
    render();
  });
}

const closeBtn = el("closeWidgetBtn");
if (closeBtn) {
  closeBtn.addEventListener("click", () => {
    window.parent.postMessage({ action: 'CLOSE_GUESTPRO_WIDGET' }, '*');
  });
}

// Session Submission Logic
if (el("modeToggleBtn")) {
  el("modeToggleBtn").addEventListener("click", () => {
    isNotionMode = !isNotionMode;
    const checklistCont = el("checklistContainer");
    const footerCont = el("checklistFooter");
    const notionCont = el("notionContainer");
    
    if (isNotionMode) {
      el("modeToggleBtn").innerText = "☑️ Checklist Mode";
      if (checklistCont) checklistCont.classList.add("hidden");
      if (footerCont) footerCont.classList.add("hidden");
      if (notionCont) notionCont.classList.remove("hidden");
      
      if (!notionEditor) {
        if (!window.EditorJS) {
           el('editorjs').innerHTML = '<div style="color:red; padding:10px;">Editor.js library not found! Script might not be loaded.</div>';
        } else {
          try {
            const toolsConfig = {};
            if (window.Header) toolsConfig.header = window.Header;
            
            if (window.EditorjsList) {
              const oldListGetter = Object.getOwnPropertyDescriptor(window.EditorjsList, 'toolbox').get;
              if (oldListGetter) {
                Object.defineProperty(window.EditorjsList, 'toolbox', {
                  get: function() {
                    const tools = oldListGetter.call(this);
                    if (Array.isArray(tools)) {
                      if (tools[0]) tools[0].title = 'Bulleted list';
                      if (tools[1]) tools[1].title = 'Numbered list';
                      return tools.slice(0, 2);
                    }
                    if (tools) tools.title = 'Bulleted list';
                    return tools;
                  }
                });
              }
              toolsConfig.list = { class: window.EditorjsList, inlineToolbar: true };
            }
            if (window.SimpleImage) toolsConfig.image = window.SimpleImage;
            
            if (window.Checklist) {
              const oldChecklistGetter = Object.getOwnPropertyDescriptor(window.Checklist, 'toolbox').get;
              if (oldChecklistGetter) {
                Object.defineProperty(window.Checklist, 'toolbox', {
                  get: function() {
                    const tb = oldChecklistGetter.call(this);
                    tb.title = 'To-do list';
                    return tb;
                  }
                });
              }
              toolsConfig.checklist = { class: window.Checklist, inlineToolbar: true };
            }
            
            if (window.Quote) toolsConfig.quote = { class: window.Quote, inlineToolbar: true };
            if (window.Warning) toolsConfig.warning = { class: window.Warning, inlineToolbar: true };
            if (window.Delimiter) toolsConfig.delimiter = window.Delimiter;
            if (window.Marker) toolsConfig.Marker = { class: window.Marker, shortcut: 'CMD+SHIFT+M' };
            if (window.Table) toolsConfig.table = { class: window.Table, inlineToolbar: true };
            if (window.ToggleBlock) toolsConfig.toggle = { class: window.ToggleBlock, inlineToolbar: true };
            
            notionEditor = new EditorJS({
              holder: 'editorjs',
              placeholder: 'Tulis catatan, request, atau notes sesi di sini... (Ketik / untuk command atau paste gambar)',
              tools: toolsConfig,
              data: session.notionData || undefined,
              onReady: () => {
                let deleteBtn = document.getElementById('ce-quick-delete');
                if (!deleteBtn) {
                  deleteBtn = document.createElement('div');
                  deleteBtn.id = 'ce-quick-delete';
                  deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>';
                  deleteBtn.style.position = 'absolute';
                  deleteBtn.style.right = '10px';
                  deleteBtn.style.cursor = 'pointer';
                  deleteBtn.style.display = 'none';
                  deleteBtn.style.color = '#ff4d4f';
                  deleteBtn.style.padding = '6px';
                  deleteBtn.style.borderRadius = '4px';
                  deleteBtn.style.zIndex = '999';
                  deleteBtn.style.transition = 'all 0.2s';
                  
                  deleteBtn.addEventListener('mouseenter', () => { deleteBtn.style.backgroundColor = 'rgba(255, 77, 79, 0.1)'; });
                  deleteBtn.addEventListener('mouseleave', () => { deleteBtn.style.backgroundColor = 'transparent'; });
                  
                  const editorContainer = document.getElementById('editorjs');
                  editorContainer.style.position = 'relative';
                  editorContainer.appendChild(deleteBtn);
                  
                  let activeBlock = null;
                  
                  editorContainer.addEventListener('mousemove', (e) => {
                    const block = e.target.closest('.ce-block');
                    if (block) {
                      activeBlock = block;
                      deleteBtn.style.display = 'block';
                      deleteBtn.style.top = block.offsetTop + 5 + 'px';
                    } else if (e.target.closest('#ce-quick-delete')) {
                      // Do nothing, keep showing
                    } else {
                      deleteBtn.style.display = 'none';
                      activeBlock = null;
                    }
                  });
                  
                  editorContainer.addEventListener('mouseleave', () => {
                    deleteBtn.style.display = 'none';
                  });
                  
                  deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (activeBlock && notionEditor) {
                      const blocks = Array.from(editorContainer.querySelectorAll('.ce-block'));
                      const index = blocks.indexOf(activeBlock);
                      if (index !== -1) {
                        notionEditor.blocks.delete(index);
                        deleteBtn.style.display = 'none';
                        activeBlock = null;
                        
                        // Trigger save manually since deletion from api might not trigger onChange instantly
                        setTimeout(async () => {
                          const savedData = await notionEditor.saver.save();
                          session.notionData = savedData;
                          saveSession();
                        }, 100);
                      }
                    }
                  });
                }
              },
              onChange: async (api, event) => {
                const savedData = await api.saver.save();
                session.notionData = savedData;
                saveSession();
              }
            });
          } catch (err) {
            console.error("Failed to initialize EditorJS:", err);
            el('editorjs').innerHTML = '<div style="color:red; padding:10px;">Failed to load Editor.js. Please check console.</div>';
          }
        }
      }
    } else {
      el("modeToggleBtn").innerText = "📝 Notion Mode";
      if (checklistCont) checklistCont.classList.remove("hidden");
      if (footerCont) footerCont.classList.remove("hidden");
      if (notionCont) notionCont.classList.add("hidden");
    }
  });
}

async function submitSession(statusStr) {
  if (!session.trainerName || !session.clientName) {
    alert("Please fill in the Client Name first!");
    return;
  }
  
  const actionText = statusStr === 'Completed' ? "Save this session and log out?" : "Cancel this session and log out?";
  if (!confirm(actionText)) return;

  // Validasi mandatory jika Completed
  if (statusStr === 'Completed') {
    let missingNotes = [];
    state.categories.forEach(cat => {
      cat.items.forEach(i => {
        if (i.checked && i.isMandatory) {
          if (!i.note || i.note.trim() === "") {
            missingNotes.push(i.text);
          }
        }
      });
    });

    if (missingNotes.length > 0) {
      alert(`[VALIDATION FAILED]\nYou have checked Mandatory items but left their notes empty:\n- ${missingNotes.join('\\n- ')}\n\nPlease fill in the notes first!`);
      return;
    }
  }
  
  let totalItems = 0;
  let checkedItems = 0;
  state.categories.forEach(cat => {
    totalItems += cat.items.length;
    checkedItems += cat.items.filter(i => i.checked).length;
  });

  const progressStr = `${checkedItems}/${totalItems}`;

  const notesPayload = [];

  let editorData = null;
  if (notionEditor) {
    try {
      editorData = await notionEditor.save();
    } catch(e) {
      console.error("Editor.js save error:", e);
    }
  }

  if (editorData && editorData.blocks && editorData.blocks.length > 0) {
    let compiledNote = "";
    editorData.blocks.forEach(block => {
      if (block.type === 'paragraph') {
        compiledNote += block.data.text + "\\n\\n";
      } else if (block.type === 'header') {
        let hashes = '#'.repeat(block.data.level || 2);
        compiledNote += hashes + " " + block.data.text + "\\n\\n";
      } else if (block.type === 'list') {
        block.data.items.forEach(item => {
          compiledNote += (block.data.style === 'ordered' ? '1. ' : '- ') + item + "\\n";
        });
        compiledNote += "\\n";
      } else if (block.type === 'image') {
        compiledNote += `\\n[IMAGE:${block.data.url}]\\n\\n`; 
      } else if (block.type === 'checklist') {
        block.data.items.forEach(item => {
          compiledNote += (item.checked ? '[x] ' : '[ ] ') + item.text + "\\n";
        });
        compiledNote += "\\n";
      } else if (block.type === 'quote') {
        compiledNote += "> " + block.data.text + "\\n";
        if (block.data.caption) compiledNote += "> — " + block.data.caption + "\\n";
        compiledNote += "\\n";
      } else if (block.type === 'warning') {
        compiledNote += "⚠️ **" + block.data.title + "**\\n" + block.data.message + "\\n\\n";
      } else if (block.type === 'delimiter') {
        compiledNote += "---\\n\\n";
      } else if (block.type === 'table') {
        block.data.content.forEach(row => {
          compiledNote += "| " + row.join(" | ") + " |\\n";
        });
        compiledNote += "\\n";
      }
    });
    compiledNote = compiledNote.trim();
    if (compiledNote) {
      notesPayload.push({
        category: "Notion Mode Notes",
        item: "Detailed Notes",
        checked: true,
        note: compiledNote
      });
      notesPayload.push({
        category: "Notion Mode Data",
        item: "Raw JSON",
        checked: true,
        note: JSON.stringify(editorData)
      });
    }
    // Update session data so it can be reloaded when editing
    session.notionData = editorData;
  }

  state.categories.forEach(cat => {
    cat.items.forEach(i => {
      let finalNote = i.note || "";
      // Remove old placeholder if exists
      finalNote = finalNote.replace(/\[📸 Gambar Terlampir\]/g, "");
      
      if (i.attachedImages && i.attachedImages.length > 0) {
        i.attachedImages.forEach(b64 => {
          finalNote += `\n[IMAGE:${b64}]\n`;
        });
      } else if (i.attachedImage) {
        finalNote += i.attachedImage;
      }
      
      finalNote = finalNote.trim();

      if (finalNote || i.checked || i.statusValue) {
        notesPayload.push({
          category: cat.name,
          item: i.text,
          checked: !!i.checked,
          statusValue: i.statusValue || null,
          note: finalNote
        });
      }
    });
  });

  if (state.additionalNote && state.additionalNote.trim() !== "" || (state.additionalAttachedImages && state.additionalAttachedImages.length > 0)) {
    let finalAddNote = state.additionalNote ? state.additionalNote.replace(/\[📸 Gambar Terlampir\]/g, "").trim() : "";
    
    if (state.additionalAttachedImages && state.additionalAttachedImages.length > 0) {
      state.additionalAttachedImages.forEach(b64 => {
        finalAddNote += `\n[IMAGE:${b64}]\n`;
      });
    } else if (state.additionalAttachedImage) {
      finalAddNote += state.additionalAttachedImage;
    }
    
    finalAddNote = finalAddNote.trim();

    notesPayload.push({
      category: "Additional Notes",
      item: "General",
      checked: true,
      note: finalAddNote
    });
  }

  if (state.customNotes && state.customNotes.length > 0) {
    state.customNotes.forEach(cn => {
      let finalNote = cn.note ? cn.note.replace(/\[📸 Gambar Terlampir\]/g, "").trim() : "";
      
      if (cn.attachedImages && cn.attachedImages.length > 0) {
        cn.attachedImages.forEach(b64 => {
          finalNote += `\n[IMAGE:${b64}]\n`;
        });
      } else if (cn.attachedImage) {
        finalNote += cn.attachedImage;
      }
      
      finalNote = finalNote.trim();

      if (cn.title.trim() || finalNote) {
        notesPayload.push({
          category: "Custom Notes",
          item: cn.title.trim() || "Untitled Note",
          checked: true,
          note: finalNote
        });
      }
    });
  }
  

    if (state.requests && state.requests.length > 0) {
      state.requests.forEach(req => {
        let finalNote = req.note ? req.note.replace(/\[dY", Gambar Terlampir\]/g, "").trim() : "";
        
        if (req.attachedImages && req.attachedImages.length > 0) {
          req.attachedImages.forEach(b64 => {
            finalNote += "\n[IMAGE:" + b64 + "]\n";
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

  if (session.trainingMethod) {
      notesPayload.push({
        category: "Additional Notes",
      item: "Status Training",
      checked: true,
      note: session.trainingMethod
    });
  }

  let oldFinishHTML = "";
  let oldCancelHTML = "";

  try {
    if (!document.getElementById("loading-spin-style")) {
      const style = document.createElement("style");
      style.id = "loading-spin-style";
      style.textContent = "@keyframes rotate-spin { 100% { transform: rotate(360deg); } } .loading-spinner { display: inline-block; animation: rotate-spin 1s linear infinite; margin-right: 6px; }";
      document.head.appendChild(style);
    }

    if (el("finishSessionBtn")) {
      oldFinishHTML = el("finishSessionBtn").innerHTML;
      if (statusStr === 'Completed') {
        el("finishSessionBtn").innerHTML = `<span class="loading-spinner">↻</span> Menyimpan...`;
      }
      el("finishSessionBtn").disabled = true;
    }
    
    if (el("cancelSessionBtn")) {
      oldCancelHTML = el("cancelSessionBtn").innerHTML;
      if (statusStr === 'Cancelled') {
        el("cancelSessionBtn").innerHTML = `<span class="loading-spinner">↻</span> Membatalkan...`;
      }
      el("cancelSessionBtn").disabled = true;
    }

    // Get finish location for new sessions
    if (!session.isEditMode) {
      const finishLoc = (await getCurrentLocation()) || "Unknown";
      
      notesPayload.push({
        category: "Location Data",
        item: "Start Location",
        checked: true,
        note: session.startLocation || "Unknown"
      });
      notesPayload.push({
        category: "Location Data",
        item: "Finish Location",
        checked: true,
        note: finishLoc
      });
    }
    
    stopTimer();
    const wasEditMode = session.isEditMode;
    let finalDurationMs = session.startTime ? (Date.now() - session.startTime) : 0;
    let finalDurationFormatted = formatDuration(finalDurationMs);

    const fetchUrl = session.isEditMode 
      ? `${SUPABASE_URL}/rest/v1/sessions?id=eq.${session.editSessionId}`
      : `${SUPABASE_URL}/rest/v1/sessions`;
      
    const fetchMethod = session.isEditMode ? "PATCH" : "POST";

    const bodyPayload = {
      trainer_name: session.trainerName,
      client_name: session.packageName ? `${session.clientName}|||${session.packageName}` : session.clientName,
      session_date: session.date,
      progress: progressStr,
      notes: notesPayload
    };
    
    // Only update duration and status if this is a new session
    if (!session.isEditMode) {
      bodyPayload.duration = finalDurationFormatted;
      bodyPayload.status = statusStr;
    }

    const res = await fetch(fetchUrl, {
      method: fetchMethod,
      headers: supabaseHeaders,
      body: JSON.stringify(bodyPayload)
    });
    
    if (!res.ok) {
      const errData = await res.text();
      throw new Error(`[${res.status}] ${errData}`);
    }
    
    // Reset checklist centang dan notes
    state.categories.forEach((cat) => cat.items.forEach((i) => {
      i.checked = false;
      i.note = "";
      i.showNote = false;
    }));
    state.additionalNote = "";
    state.customNotes = [];
    if (el("additionalNoteInput")) el("additionalNoteInput").value = "";
    if (typeof renderCustomNotes === "function") renderCustomNotes();
      if (typeof renderRequests === "function") renderRequests();
    session.clientName = ""; 
    // session.trainerName = ""; // Do NOT reset trainer name so they stay logged in if we don't force logout
    session.date = new Date().toISOString().slice(0, 10);
    session.startTime = null;
    session.packageId = "";
    session.packageName = "";
    session.isEditMode = false;
    session.editSessionId = null;
    session.startLocation = "";
    session.notionData = null;
    if (notionEditor) notionEditor.clear();
    if(el("setupClientName")) el("setupClientName").value = "";
    if(el("setupPackage")) el("setupPackage").value = "";
    saveData();
    saveSession();
    render();
    if (wasEditMode) {
      showSetupView();
      alert(`Session successfully updated in Cloud!`);
    } else {
      // Auto Logout only for new sessions
      chrome.storage.local.remove('loggedInTrainer');
      showLoginView();
      alert(`Session successfully ${statusStr === 'Completed' ? 'saved' : 'cancelled'} in Cloud! You have been logged out.`);
    }
  } catch(e) {
    console.error("Fetch Error:", e);
    alert("Failed to send session to Cloud.\nPlease ensure you have added the 'status' column in the Supabase sessions table.\nDetails: " + e.message);
  } finally {
    if (el("finishSessionBtn")) {
      el("finishSessionBtn").disabled = false;
      if (oldFinishHTML) el("finishSessionBtn").innerHTML = oldFinishHTML;
    }
    if (el("cancelSessionBtn")) {
      el("cancelSessionBtn").disabled = false;
      if (oldCancelHTML) el("cancelSessionBtn").innerHTML = oldCancelHTML;
    }
  }
}

if (el("finishSessionBtn")) {
  el("finishSessionBtn").addEventListener("click", () => submitSession('Completed'));
}

if (el("cancelSessionBtn")) {
  el("cancelSessionBtn").addEventListener("click", () => {
    if (session.isEditMode) {
      // Batal edit, reset state dan kembali ke halaman list
      state.categories.forEach((cat) => cat.items.forEach((i) => {
        i.checked = false;
        i.note = "";
        i.showNote = false;
      }));
      state.additionalNote = "";
      state.customNotes = [];
      state.requests = [];
      if (el("additionalNoteInput")) el("additionalNoteInput").value = "";
      if (typeof renderCustomNotes === "function") renderCustomNotes();
      if (typeof renderRequests === "function") renderRequests();
      session.clientName = ""; 
      session.date = new Date().toISOString().slice(0, 10);
      session.startTime = null;
      session.packageId = "";
      session.packageName = "";
      session.isEditMode = false;
      session.editSessionId = null;
      session.startLocation = "";
      session.notionData = null;
      if (notionEditor) notionEditor.clear();
      if(el("setupClientName")) el("setupClientName").value = "";
      if(el("setupPackage")) el("setupPackage").value = "";
      saveData();
      saveSession();
      render();
      showSetupView();
    } else {
      submitSession('Cancelled');
    }
  });
}

if (el("showEditSessionBtn")) {
  el("showEditSessionBtn").addEventListener("click", showEditSessionView);
}

if (el("backToSetupBtn")) {
  el("backToSetupBtn").addEventListener("click", showSetupView);
}

if (el("refreshSessionsBtn")) {
  el("refreshSessionsBtn").addEventListener("click", () => {
    if (el("searchSessionInput")) el("searchSessionInput").value = "";
    loadTrainerSessions();
  });
}

let allTrainerSessions = [];
async function loadTrainerSessions() {
  const container = el("sessionListContainer");
  if (!container) return;
  container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">Loading your sessions...</div>';
  
  const refreshBtn = el("refreshSessionsBtn");
  const refreshSvg = refreshBtn ? refreshBtn.querySelector("svg") : null;
  if (refreshSvg) {
    refreshSvg.classList.add("spin-animation");
  }
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?trainer_name=ilike.${session.trainerName}&order=created_at.desc`, {
      headers: supabaseHeaders
    });
    const data = await res.json();
    allTrainerSessions = data || [];
    renderSessionList(allTrainerSessions);
    
    if (refreshSvg) {
      refreshSvg.style.color = "var(--green, #22c55e)";
      setTimeout(() => {
        refreshSvg.style.color = "";
      }, 1000);
    }
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--red); font-size: 13px;">Failed to load sessions.</div>';
  } finally {
    if (refreshSvg) {
      refreshSvg.classList.remove("spin-animation");
    }
  }
}

function renderSessionList(sessionsToRender) {
  const container = el("sessionListContainer");
  if (!container) return;
  container.innerHTML = "";
  
  if (sessionsToRender.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">No sessions found.</div>';
    return;
  }
  
  sessionsToRender.forEach(sess => {
    const card = document.createElement("div");
    card.style.cssText = "padding: 12px 10px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; display: flex; justify-content: space-between; align-items: center; gap: 8px;";
    card.onmouseover = () => card.style.backgroundColor = "var(--hover-bg)";
    card.onmouseout = () => card.style.backgroundColor = "transparent";
    
    let clientPart = sess.client_name;
    let packagePart = "";
    if (clientPart && clientPart.includes("|||")) {
      const parts = clientPart.split("|||");
      clientPart = parts[0];
      packagePart = parts[1];
    }
    
    let displayClientName = clientPart;
    const leadMatch = globalClientNames.find(c => c.id === clientPart);
    if (leadMatch) {
      displayClientName = leadMatch.name;
    }
    
    const statusColor = sess.status === 'Cancelled' ? 'var(--red)' : 'var(--green)';
    
    card.innerHTML = `
      <div style="min-width: 0; flex: 1;">
        <div style="font-weight: 600; font-size: 13px; color: var(--text-main); margin-bottom: 2px; overflow-wrap: anywhere;">${displayClientName}</div>
        <div style="font-size: 11px; color: var(--primary); font-weight: 500; overflow-wrap: anywhere;">${packagePart}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${sess.session_date} • <span style="color: ${statusColor};">${sess.status || 'Completed'}</span></div>
      </div>
      <div style="display: flex; gap: 4px; flex-shrink: 0;">
        <button class="icon-btn share-btn" style="color: var(--primary); border: none; font-size: 14px; padding: 4px; display: flex; align-items: center;" title="Copy Public Share Link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
        </button>
        <button class="icon-btn" style="color: var(--primary); border: none; font-size: 14px; padding: 4px;" title="Edit Session">✎</button>
      </div>
    `;
    
    const shareBtn = card.querySelector('.share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Gunakan localhost:5173 untuk testing lokal. Ganti dengan domain production nanti.
        const adminUrl = "http://localhost:5173"; 
        const url = `${adminUrl}/?share_id=${sess.id}`;
        navigator.clipboard.writeText(url).then(() => {
          const originalHtml = shareBtn.innerHTML;
          shareBtn.innerHTML = '<span style="font-size: 12px; font-weight: bold;">✓ Copied</span>';
          setTimeout(() => { shareBtn.innerHTML = originalHtml; }, 2000);
        }).catch(err => {
          console.error("Failed to copy", err);
        });
      });
    }
    
    card.addEventListener("click", () => handleEditSession(sess, clientPart, displayClientName, packagePart));
    container.appendChild(card);
  });
}

if (el("searchSessionInput")) {
  el("searchSessionInput").addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase();
    const filtered = allTrainerSessions.filter(sess => (sess.client_name || "").toLowerCase().includes(val));
    renderSessionList(filtered);
  });
}

function extractImagesFromNote(noteString) {
  let text = noteString || "";
  let attachedImages = [];
  const regex = /\[IMAGE:(data:image\/[^;]+;base64,[^\]]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    attachedImages.push(match[1]);
  }
  // Remove the image tags from the text
  text = text.replace(/\[IMAGE:data:image\/[^;]+;base64,[^\]]+\]\n?/g, "").trim();
  return { text, attachedImages };
}

function handleEditSession(sess, clientId, displayClientName, packagePart) {
  // Find the package structure from window.allPackages
  const pkg = (window.allPackages || []).find(p => p.name === packagePart);
  if (pkg) {
    session.packageId = pkg.id;
    state.categories = JSON.parse(JSON.stringify(pkg.categories));
  } else if (window.allPackages && window.allPackages.length > 0) {
    // Fallback to first package if name doesn't match perfectly
    session.packageId = window.allPackages[0].id;
    state.categories = JSON.parse(JSON.stringify(window.allPackages[0].categories));
  }

  // Hydrate session object
  session.isEditMode = true;
  session.editSessionId = sess.id;
  session.clientId = clientId;
  session.clientName = displayClientName;
  session.packageName = packagePart;
  session.date = sess.session_date;
  session.trainingMethod = "Visit Training"; // Default if not found
  session.startTime = new Date().getTime(); // Reset timer for edit
  
  // Hydrate state
  const savedNotes = sess.notes || [];
  
  // Find Status Training
  const statusTrainingObj = savedNotes.find(n => n.category === "Additional Notes" && n.item === "Status Training");
  if (statusTrainingObj) {
    session.trainingMethod = statusTrainingObj.note;
  }
  
  // Find Notion Data
  const rawNotionObj = savedNotes.find(n => n.category === "Notion Mode Data");
  if (rawNotionObj) {
    try {
      session.notionData = JSON.parse(rawNotionObj.note);
    } catch(e) {}
  } else {
    session.notionData = null;
  }
  if (notionEditor && session.notionData) {
     notionEditor.isReady.then(() => {
        notionEditor.render(session.notionData);
     });
  }

  // Find additional notes
  const additionalNoteObj = savedNotes.find(n => n.category === "Additional Notes" && n.item !== "Status Training");
  if (additionalNoteObj) {
    const parsedAddNote = extractImagesFromNote(additionalNoteObj.note);
    state.additionalNote = parsedAddNote.text;
    state.additionalAttachedImages = parsedAddNote.attachedImages;
  } else {
    state.additionalNote = "";
    state.additionalAttachedImages = [];
  }
  if (el("additionalNoteInput")) el("additionalNoteInput").value = state.additionalNote;
  
  state.customNotes = [];
  
  // Pastikan item lama yang pernah dicentang tetap muncul meskipun package-nya berubah/dihapus
  savedNotes.forEach(n => {
    if (n.category === "Additional Notes") return; // skip additional notes
    if (n.category === "Location Data") return; // skip location data, don't render it in the UI
    if (n.category === "Notion Mode Notes" || n.category === "Notion Mode Data") return; // skip notion data, handled separately
    
    const parsed = extractImagesFromNote(n.note);
    
    if (n.category === "Custom Notes") {
      state.customNotes.push({
        title: n.item,
        note: parsed.text,
        attachedImages: parsed.attachedImages
      });
      return;
    }
    
    let cat = state.categories.find(c => c.name === n.category);
    if (!cat) {
      cat = { name: n.category, items: [] };
      state.categories.push(cat);
    }
    
    let item = cat.items.find(i => i.text === n.item);
    if (!item) {
      item = { 
        text: n.item, 
        checked: n.checked, 
        note: parsed.text, 
        showNote: !!parsed.text || parsed.attachedImages.length > 0,
        attachedImages: parsed.attachedImages
      };
      cat.items.push(item);
    }
  });
  
  // Set checked and notes for existing categories
  state.categories.forEach(cat => {
    cat.items.forEach(item => {
      const savedItem = savedNotes.find(n => n.category === cat.name && n.item === item.text);
      if (savedItem) {
        const parsed = extractImagesFromNote(savedItem.note);
        item.checked = savedItem.checked;
        item.note = parsed.text;
        item.attachedImages = parsed.attachedImages;
        item.showNote = !!parsed.text || parsed.attachedImages.length > 0;
      } else {
        item.checked = false;
        item.note = "";
        item.showNote = false;
        item.attachedImages = [];
      }
    });
  });
  
  saveSession();
  saveData();
  render();
  if (typeof renderCustomNotes === "function") renderCustomNotes();
      if (typeof renderRequests === "function") renderRequests();
  startTimer();
  showAppView();
}

// ====== Theme Logic ======
const sunIcon = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
const moonIcon = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;

function updateThemeIcon(theme) {
  const iconEl = el("globalThemeIcon");
  if (iconEl) {
    iconEl.innerHTML = theme === "dark" ? sunIcon : moonIcon;
  }
}

function initTheme() {
  chrome.storage.local.get(["theme"], (res) => {
    if (res.theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    updateThemeIcon(res.theme || "light");
  });
}

const themeToggleBtn = el("globalThemeBtn");
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    if (newTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    chrome.storage.local.set({ theme: newTheme });
    updateThemeIcon(newTheme);
  });
}

const globalReloadBtn = el("globalReloadBtn");
if (globalReloadBtn) {
  globalReloadBtn.addEventListener("click", () => {
    chrome.runtime.reload();
  });
}

const globalCloseBtn = el("globalCloseBtn");
if (globalCloseBtn) {
  globalCloseBtn.addEventListener("click", () => {
    window.parent.postMessage({ action: 'CLOSE_GUESTPRO_WIDGET' }, '*');
  });
}

initTheme();
loadAll();

// Helper for image compression
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.7 quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// Image Modal Logic
function openImageModal(src) {
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("imageModalSrc");
  if (modal && modalImg) {
    modalImg.src = src;
    modal.style.display = "flex";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("closeImageModal");
  const modal = document.getElementById("imageModal");
  
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
      }
    });
  }

  // Global click listener to close custom dropdown menus
  document.addEventListener("click", (e) => {
    if (!e.target.closest('.custom-status-dropdown')) {
      closeAllStatusMenus();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllStatusMenus();
    }
  });
});
