let audioPlayer;
let currentSong = null;
let queue = [];
let currentIndex = -1;
let isPlaying = false;
let shuffleMode = false;
let repeatMode = 'off'; // off, all, one
let volume = 1;
let isMuted = false;

function initPlayer() {
  audioPlayer = document.getElementById('audioPlayer');
  
  audioPlayer.addEventListener('timeupdate', () => {
    if (currentSong) {
      const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      document.getElementById('progressFill').style.width = progress + '%';
      document.getElementById('progressThumb').style.left = progress + '%';
      document.getElementById('currentTime').textContent = formatTime(audioPlayer.currentTime);
    }
  });
  
  audioPlayer.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audioPlayer.currentTime = 0;
      audioPlayer.play();
    } else if (repeatMode === 'all' || currentIndex < queue.length - 1) {
      next();
    }
  });
  
  audioPlayer.addEventListener('loadedmetadata', () => {
    document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
  });
  
  audioPlayer.volume = volume;
}

function playSong(song, inQueue = true) {
  currentSong = song;
  if (inQueue) {
    const idx = queue.findIndex(s => s.id === song.id);
    if (idx >= 0) currentIndex = idx;
  }
  audioPlayer.src = URL.createObjectURL(song.fileBlob);
  audioPlayer.play().then(() => {
    isPlaying = true;
    updatePlayPauseButton();
    updateNowPlayingUI();
    if (window.library) window.library.updateSelection(song.id);
  });
  
  // Update cover
  const coverImg = document.getElementById('playerCover');
  const placeholder = document.querySelector('.cover-placeholder');
  if (song.coverBlob) {
    if (coverImg.src) URL.revokeObjectURL(coverImg.src);
    coverImg.src = URL.createObjectURL(song.coverBlob);
    coverImg.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    coverImg.style.display = 'none';
    placeholder.style.display = 'block';
  }
  
  document.getElementById('playerTitle').textContent = song.title;
  document.getElementById('playerArtist').textContent = song.artist;
  
  document.title = song.title + ' - ' + song.artist + ' | Project Orpheus';
}

function togglePlayPause() {
  if (!audioPlayer.src) return;
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
  } else {
    audioPlayer.play();
    isPlaying = true;
  }
  updatePlayPauseButton();
  playBlip();
}

function next() {
  if (queue.length === 0) return;
  if (shuffleMode) {
    currentIndex = Math.floor(Math.random() * queue.length);
  } else {
    currentIndex = (currentIndex + 1) % queue.length;
  }
  playSong(queue[currentIndex], false);
  playBlip();
}

function prev() {
  if (queue.length === 0) return;
  currentIndex = (currentIndex - 1 + queue.length) % queue.length;
  playSong(queue[currentIndex], false);
  playBlip();
}

function updatePlayPauseButton() {
  const btn = document.getElementById('playPauseBtn');
  btn.textContent = isPlaying ? '⏸' : '▶';
}

function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  audioPlayer.volume = volume;
  document.getElementById('volumeSlider').value = volume;
  isMuted = false;
  updateMuteButton();
}

function toggleMute() {
  if (isMuted) {
    audioPlayer.volume = volume;
    isMuted = false;
  } else {
    audioPlayer.volume = 0;
    isMuted = true;
  }
  updateMuteButton();
  playBlip();
}

function updateMuteButton() {
  const btn = document.getElementById('muteBtn');
  btn.textContent = isMuted || volume === 0 ? '🔇' : '🔊';
}
