let currentView = 'library';

function initApp() {
  initUIAudio();
  initDB().then(() => {
    initLibrary();
    initPlaylists();
    initPlayer();
    setupEventListeners();
  });
}

function setupEventListeners() {
  // Import
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
    playBlip();
  });
  
  document.getElementById('fileInput').addEventListener('change', async (e) => {
    if (e.target.files.length > 0) {
      await importFiles([...e.target.files]);
      await loadLibrary();
      e.target.value = '';
    }
  });
  
  // Navigation
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.nav-btn').forEach(b => b.classList.toggle('active', b === btn));
      currentView = btn.dataset.view;
      document.getElementById('viewTitle').textContent = btn.textContent;
      playBlip();
    });
  });
  
  // Player controls
  document.getElementById('playPauseBtn').addEventListener('click', () => {
    togglePlayPause();
  });
  
  document.getElementById('nextBtn').addEventListener('click', () => {
    next();
  });
  
  document.getElementById('prevBtn').addEventListener('click', () => {
    prev();
  });
  
  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
  });
  
  document.getElementById('muteBtn').addEventListener('click', () => {
    toggleMute();
  });
  
  // Progress bar
  const progressBar = document.getElementById('progressBar');
  progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (audioPlayer.duration) {
      audioPlayer.currentTime = pos * audioPlayer.duration;
    }
  });
  
  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    // Don't interfere with typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.code === 'ArrowRight') {
      next();
    } else if (e.code === 'ArrowLeft') {
      prev();
    }
  });
  
  // Unlock audio on first user interaction
  document.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }, { once: true });
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
