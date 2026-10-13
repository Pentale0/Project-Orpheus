export class AudioPlayer {
  constructor(onStateChange) {
    this.audio = new Audio();
    this.onStateChange = onStateChange || (() => {});
    this.current = null;
    this.playlist = [];
    this.idx = -1;
    this.volume = Number(localStorage.getItem('orpheus:volume') || 1);
    this.audio.volume = this.volume;
    this.audio.addEventListener('timeupdate', () => this.onStateChange('time'));
    this.audio.addEventListener('ended', () => this.next());
    this.audio.addEventListener('play', () => this.onStateChange('play'));
    this.audio.addEventListener('pause', () => this.onStateChange('pause'));
    this.audio.addEventListener('error', () => this.onStateChange('error'));
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v) || 0));
    this.audio.volume = this.volume;
    try { localStorage.setItem('orpheus:volume', String(this.volume)); } catch (e) {}
    this.onStateChange('volume');
    return this.volume;
  }
  getVolume() {
    return this.volume;
  }
  setPlaylist(songs, startIndex = 0) {
    this.playlist = songs || [];
    this.idx = Math.max(0, Math.min(startIndex, this.playlist.length - 1));
    if (this.idx >= 0) this.load(this.playlist[this.idx]);
  }
  load(song) {
    if (!song) return;
    this.current = song;
    this.audio.src = song.src;
    this.audio.load();
    this.onStateChange('load');
  }
  play() {
    const p = this.audio.play();
    if (p) p.catch(() => {});
    this.onStateChange('play');
  }
  pause() {
    this.audio.pause();
    this.onStateChange('pause');
  }
  toggle() {
    if (this.audio.paused) this.play();
    else this.pause();
  }
  next() {
    if (this.playlist.length === 0) return;
    this.idx = (this.idx + 1) % this.playlist.length;
    this.load(this.playlist[this.idx]);
    this.play();
  }
  prev() {
    if (this.playlist.length === 0) return;
    this.idx = (this.idx - 1 + this.playlist.length) % this.playlist.length;
    this.load(this.playlist[this.idx]);
    this.play();
  }
  seek(time) {
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || time, time));
  }
  get currentTime() {
    return this.audio.currentTime || 0;
  }
  get duration() {
    return this.audio.duration || 0;
  }
  get paused() {
    return this.audio.paused;
  }
}
