// Saat ikon ekstensi diklik, kirim pesan ke tab aktif untuk menampilkan widget
chrome.action.onClicked.addListener((tab) => {
  // Pastikan ekstensi memiliki izin untuk mengakses tab ini
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_WIDGET' }).catch((error) => {
      console.warn("Gagal mengirim pesan ke tab. Pastikan halaman sudah selesai dimuat.", error);
    });
  }
});
