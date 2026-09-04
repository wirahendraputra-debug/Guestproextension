let iframe = null;
let floatBtn = null;

function createFloatingButton() {
  floatBtn = document.createElement('div');
  floatBtn.id = 'guestpro-widget-btn';
  // Ikon checklist sederhana
  floatBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  `;
  floatBtn.title = 'Buka Training Checklist';
  
  let isDragging = false;
  let startX, startY, initialX, initialY;

  floatBtn.addEventListener('mousedown', (e) => {
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = floatBtn.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    const onMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
        floatBtn.style.right = 'auto';
        floatBtn.style.bottom = 'auto';
        floatBtn.style.left = `${initialX + dx}px`;
        floatBtn.style.top = `${initialY + dy}px`;
      }
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  floatBtn.addEventListener('click', (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    toggleWidget();
  });
  
  document.body.appendChild(floatBtn);
}

function createIframe() {
  iframe = document.createElement('iframe');
  iframe.id = 'guestpro-widget-iframe';
  iframe.src = chrome.runtime.getURL('sidepanel.html');
  iframe.allow = 'geolocation';
  document.body.appendChild(iframe);
}

function toggleWidget() {
  if (!iframe) {
    createIframe();
    // Beri sedikit jeda agar transisi CSS berjalan mulus saat pertama kali dibuat
    setTimeout(() => {
      iframe.classList.add('guestpro-show');
    }, 50);
  } else {
    iframe.classList.toggle('guestpro-show');
  }
}

// Inisialisasi awal
createFloatingButton();

// Mendengarkan pesan dari background.js (saat ikon ekstensi diklik)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TOGGLE_WIDGET') {
    toggleWidget();
  }
});

// Mendengarkan pesan dari dalam iframe (misal: jika ada tombol Tutup/X di dalam iframe)
window.addEventListener('message', (event) => {
  // Pastikan pesan aman dan formatnya dikenali
  if (event.data && event.data.action === 'CLOSE_GUESTPRO_WIDGET') {
    if (iframe) {
      iframe.classList.remove('guestpro-show');
    }
  }
});

// Menutup widget ketika user klik area halaman web di luar widget
document.addEventListener('click', (event) => {
  if (iframe && iframe.classList.contains('guestpro-show')) {
    // Jika klik bukan pada tombol floating, tutup iframe
    if (!floatBtn.contains(event.target)) {
      iframe.classList.remove('guestpro-show');
    }
  }
});
