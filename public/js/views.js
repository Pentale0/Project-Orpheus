import { api } from './api.js';
import {
  S,
  albumByKey,
  allTracks,
  artistsWithMeta,
  historyCounts,
  ingest,
  libraryTracks,
  likedTracks,
  newTracks,
  playlistsWithMeta,
  recentTracks,
  searchAll,
  topTracks,
  track as getTrack,
  tracksOf
} from './state.js';
import { $, $$, ago, artHTML, day, esc, fillIcons, fmt, fmtCount, fmtLong, hash, ICON, toast } from './util.js';

const NAV = [
  ['home', 'Home'],
  ['search', 'Search'],
  ['library', 'All tracks'],
  ['albums', 'Albums'],
  ['artists', 'Artists'],
  ['liked', 'Liked'],
  ['stats', 'Listening']
];

const SORTS = [
  ['added', 'Recently added'],
  ['title', 'Title'],
  ['artist', 'Artist'],
  ['album', 'Album'],
  ['plays', 'Most played'],
  ['duration', 'Longest']
];

export const ACTS_DEFAULT = '110px';
export const ACTS_PLAYLIST = '148px';

export function renderSidebar() {
  const counts = {
    library: S.tracks.size,
    albums: S.albums.length,
    artists: S.artists.length,
    liked: likedTracks().length,
    playlists: S.playlists.length
  };
  $('#side-nav').innerHTML = NAV.map(([key, label]) => {
    const on = S.route.name === key;
    const sup = counts[key] ? `<sup>${counts[key]}</sup>` : '';
    return `<button class="mi${on ? ' is-on' : ''}" type="button" data-nav="${key}"${on ? ' aria-current="page"' : ''}>${esc(label)}${sup}</button>`;
  }).join('');

  const playlists = playlistsWithMeta();
  $('#pl-list').innerHTML = playlists.length
    ? playlists
        .map(
          (p) => `<button class="pl-row${S.route.name === 'playlist' && S.route.param === p.id ? ' is-on' : ''}" type="button" data-nav="playlist" data-param="${esc(p.id)}" title="${esc(p.name)}">
        <span class="pl-art">${ICON.disc}</span>
        <span><span class="pl-name">${esc(p.name)}</span><span class="pl-sub"> ${p.count} track${p.count === 1 ? '' : 's'}</span></span>
      </button>`
        )
        .join('')
    : '<p class="pl-sub" style="padding:8px 10px">No playlists yet.</p>';

  $('#folders').innerHTML = S.folders.length
    ? `Music folder<br><code>${esc(S.folders.join(' | '))}</code><br>${fmtCount(allTracks().length)} tracks on disk`
    : 'No music folder found.<br>Set <code>ORPHEUS_MUSIC_DIR</code> and restart.';

  $('#giant').textContent = S.route.name === 'stats' ? 'Listening' : S.route.name;
}

function hero({ kind, title, meta, actions = '', long = false }) {
  return `<div class="top-kind">${esc(kind)}</div>
    <h1 class="top-title${long ? ' long' : ''}">${esc(title)}</h1>
    <div class="top-meta">${meta.map((m) => `<span>${m}</span>`).join('<span class="dot">&middot;</span>')}</div>
    ${actions ? `<div class="top-actions">${actions}</div>` : ''}`;
}

function playActions(ctxIds) {
  if (!ctxIds.length) return '';
  return `<button class="big-play" type="button" data-act="play-context" title="Play"><span data-ic="play"></span></button>
    <button class="btn" type="button" data-act="shuffle-context"><span data-ic="shuffle"></span>&nbsp;Shuffle</button>`;
}

export function renderTop() {
  const name = S.route.name;
  const param = S.route.param;
  const totalTime = allTracks().reduce((a, t) => a + t.duration, 0);
  let html = '';

  if (name === 'home') {
    html = hero({
      kind: 'Project Orpheus',
      title: 'Orpheus',
      meta: [`${fmtCount(S.tracks.size)} tracks`, fmtLong(totalTime), `${fmtCount(S.totals.plays)} plays recorded`, `${S.albums.length} albums`],
      actions: `${playActions(allTracks().map((t) => t.id))}<button class="btn ghost" type="button" data-act="rescan"><span data-ic="refresh"></span>&nbsp;Rescan folder</button>`
    });
  } else if (name === 'library') {
    html = hero({
      kind: 'Library',
      title: 'All tracks',
      meta: [`${fmtCount(S.tracks.size)} tracks`, fmtLong(totalTime), `${fmtCount(S.totals.plays)} plays`],
      actions: playActions(libraryTracks().map((t) => t.id))
    });
  } else if (name === 'albums') {
    html = hero({ kind: 'Collection', title: 'Albums', meta: [`${S.albums.length} albums`, `${S.artists.length} artists`] });
  } else if (name === 'artists') {
    html = hero({ kind: 'Collection', title: 'Artists', meta: [`${S.artists.length} artists`, `${fmtCount(S.totals.plays)} plays`] });
  } else if (name === 'liked') {
    const liked = likedTracks();
    html = hero({
      kind: 'Your picks',
      title: 'Liked Songs',
      meta: [`${liked.length} track${liked.length === 1 ? '' : 's'}`, fmtLong(liked.reduce((a, t) => a + t.duration, 0))],
      actions: playActions(liked.map((t) => t.id))
    });
  } else if (name === 'search') {
    html = hero({ kind: 'Search', title: 'Find music', meta: [`Searched titles, artists, albums and playlists`] });
  } else if (name === 'stats') {
    html = hero({
      kind: 'Statistics',
      title: 'Listening',
      meta: ['Every play, counted by this machine'],
      actions: `<button class="btn" type="button" data-act="rescan"><span data-ic="refresh"></span>&nbsp;Rescan folder</button>
        <button class="btn danger" type="button" data-act="reset-stats"><span data-ic="trash"></span>&nbsp;Reset counts</button>`
    });
  } else if (name === 'playlist') {
    const list = playlistsWithMeta().find((p) => p.id === param);
    if (!list) {
      html = hero({ kind: 'Playlist', title: 'Missing playlist', meta: [] });
    } else {
      html = hero({
        kind: 'Playlist',
        title: list.name,
        long: list.name.length > 18,
        meta: [`${list.count} track${list.count === 1 ? '' : 's'}`, fmtLong(list.duration), `${fmtCount(list.plays)} plays`, `edited ${ago(list.updated || list.created)}`],
        actions: `${playActions(list.tracks)}<button class="btn ghost" type="button" data-act="rename-playlist"><span data-ic="edit"></span>&nbsp;Rename</button>
        <button class="btn danger" type="button" data-act="delete-playlist"><span data-ic="trash"></span>&nbsp;Delete</button>`
      });
    }
  } else if (name === 'album') {
    const album = albumByKey(param);
    if (!album) {
      html = hero({ kind: 'Album', title: 'Album not found', meta: [] });
    } else {
      html = hero({
        kind: 'Album',
        title: album.name,
        long: album.name.length > 18,
        meta: [album.artist, `${album.tracks.length} track${album.tracks.length === 1 ? '' : 's'}`, album.year || '', `${fmtCount(album.plays)} plays`],
        actions: playActions(album.tracks)
      });
    }
  } else if (name === 'artist') {
    const artist = artistsWithMeta().find((a) => a.name === param);
    if (!artist) {
      html = hero({ kind: 'Artist', title: 'Artist not found', meta: [] });
    } else {
      html = hero({
        kind: 'Artist',
        title: artist.name,
        long: artist.name.length > 18,
        meta: [`${artist.count} track${artist.count === 1 ? '' : 's'}`, `${artist.albums.length} album${artist.albums.length === 1 ? '' : 's'}`, fmtLong(artist.duration), `${fmtCount(artist.plays)} plays`],
        actions: playActions(artist.tracks.map((t) => t.id))
      });
    }
  }

  $('#top').innerHTML = html;
  fillIcons($('#top'));
}

function tableHead() {
  return `<div class="th" aria-hidden="true">
    <span>#</span><span></span><span>Title</span><span class="alb">Album</span>
    <span class="num">Plays</span><span class="num">Time</span><span class="acts"></span>
  </div>`;
}

function rowHTML(track, index, acts) {
  return `<div class="tr${S.current === track.id ? ' is-cur' : ''}${index === S.cursor ? ' is-cursor' : ''}" data-id="${track.id}" data-i="${index}" style="--i:${Math.min(index, 14)}">
    <span class="idx"><span>${index + 1}</span><button class="pbtn" type="button" data-act="row-play" aria-label="Play ${esc(track.title)}">${ICON.play}</button></span>
    ${artHTML(track)}
    <button class="ttl" type="button" data-act="row-play" aria-label="Play ${esc(track.title)}">
      <b>${esc(track.title)}</b><small>${esc(track.artist)}</small>
    </button>
    <span class="alb">${esc(track.album)}</span>
    <span class="num">${track.plays ? fmtCount(track.plays) : '&middot;'}</span>
    <span class="dur">${track.duration ? fmt(track.duration) : '--:--'}</span>
    <span class="acts">${acts(track, index)}</span>
    <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
  </div>`;
}

function actsDefault(track) {
  return `<button class="ib${track.liked ? ' on' : ''}" type="button" data-act="like" data-id="${track.id}" aria-label="Like ${esc(track.title)}" title="Like">${ICON.heart}</button>
    <button class="ib" type="button" data-act="add" data-id="${track.id}" aria-label="Add ${esc(track.title)} to a playlist" title="Add to playlist">${ICON.plus}</button>
    <button class="ib" type="button" data-act="edit" data-id="${track.id}" aria-label="Edit info for ${esc(track.title)}" title="Edit song info">${ICON.edit}</button>`;
}

function table(list, options = {}) {
  const tracks = (list || []).map((t) => (typeof t === 'string' ? getTrack(t) : t)).filter(Boolean);
  const acts = options.acts || actsDefault;
  const actsWidth = options.actsWidth || ACTS_DEFAULT;
  S.rows = tracks.map((t) => t.id);
  if (options.resetCursor) S.cursor = Math.max(0, S.rows.indexOf(S.current));
  S.cursor = Math.min(S.cursor, Math.max(0, S.rows.length - 1));
  if (!tracks.length) return options.empty || '<div class="empty"><b>Nothing here</b><span>Add music from the library to fill this up.</span></div>';
  return `<div class="tbl${options.animate ? ' anim' : ''}" style="--acts:${actsWidth}">${tableHead()}${tracks
    .map((t, i) => rowHTML(t, i, acts))
    .join('')}</div>`;
}

function actsPlaylist(track, index) {
  const list = S.rows;
  return `<button class="ib" type="button" data-act="move-up" data-id="${track.id}" aria-label="Move up"${index === 0 ? ' disabled' : ''}>${ICON.up}</button>
    <button class="ib" type="button" data-act="move-down" data-id="${track.id}" aria-label="Move down"${index === list.length - 1 ? ' disabled' : ''}>${ICON.down}</button>
    <button class="ib" type="button" data-act="like" data-id="${track.id}" aria-label="Like ${esc(track.title)}">${ICON.heart}</button>
    <button class="ib" type="button" data-act="remove-track" data-id="${track.id}" aria-label="Remove from playlist">${ICON.x}</button>`;
}

function shelf(title, tracks, sub) {
  if (!tracks.length) return '';
  return `<h2 class="sh">${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h2>
    <div class="shelves">${tracks.map((t) => cardHTML(t, tracks.map((x) => x.id))).join('')}</div>`;
}

function cardHTML(track, ctx) {
  const playing = S.current === track.id;
  return `<button class="card${playing ? ' playing' : ''}" type="button" data-act="card-play" data-id="${track.id}" data-ctx="${(ctx || []).join(',')}">
    ${artHTML(track, 'big')}
    <b>${esc(track.title)}</b>
    <small>${esc(track.artist)} &middot; ${fmtCount(track.plays)} plays</small>
  </button>`;
}

function albumCard(album) {
  const cover = tracksOf(album.tracks)[0];
  const hue = (hash(album.key) % 50) + 200;
  const art = cover && cover.cover ? artHTML(cover, 'big') : `<span class="art big rnd" style="--h:${hue};--a:${((hash(album.key) >> 8) % 180) + 90}deg"></span>`;
  return `<button class="card" type="button" data-nav="album" data-param="${esc(album.key)}">
    ${art}
    <b>${esc(album.name)}</b><small>${esc(album.artist)}${album.year ? ` · ${esc(album.year)}` : ''}</small>
  </button>`;
}

function artistCard(artist) {
  const cover = artist.cover;
  const art = cover && cover.cover ? artHTML(cover, 'big') : `<span class="art big rnd" style="--h:${(hash(artist.name) % 50) + 200};--a:${((hash(artist.name) >> 8) % 180) + 90}deg"></span>`;
  return `<button class="card round" type="button" data-nav="artist" data-param="${esc(artist.name)}">
    ${art}
    <b>${esc(artist.name)}</b><small>${artist.count} tracks &middot; ${fmtCount(artist.plays)} plays</small>
  </button>`;
}

function playlistCard(list) {
  const cover = list.cover;
  const art = cover && cover.cover ? artHTML(cover, 'big') : `<span class="art big rnd" style="--h:${(hash(list.id) % 50) + 200};--a:${((hash(list.id) >> 8) % 180) + 90}deg"></span>`;
  return `<button class="card" type="button" data-nav="playlist" data-param="${esc(list.id)}">
    ${art}<b>${esc(list.name)}</b><small>${list.count} tracks &middot; ${fmtCount(list.plays)} plays</small>
  </button>`;
}

function toolbar() {
  return `<div class="tools">
    <label class="sr" for="q">Search your library</label>
    <input class="field search" id="q" type="search" placeholder="Search title, artist or album" value="${esc(S.search)}" autocomplete="off">
    <label class="sr" for="sort">Sort by</label>
    <select class="field" id="sort">${SORTS.map(([key, label]) => `<option value="${key}"${S.sort === key ? ' selected' : ''}>${label}</option>`).join('')}</select>
    <span class="count">${fmtCount(libraryTracks().length)} shown</span>
  </div>`;
}

function statsView() {
  const tracks = allTracks();
  const artists = artistsWithMeta();
  const totalListens = tracks.reduce((a, t) => a + t.listenSec, 0);
  const topArtist = artists.find((a) => a.plays > 0);
  const never = tracks.filter((t) => t.plays === 0).length;
  const best = topTracks(1)[0];
  const maxPlays = Math.max(1, ...artists.map((a) => a.plays));
  const days = historyCounts();
  const maxDay = Math.max(1, ...days.map((d) => d.plays));
  const bestTracks = topTracks(10);
  const bestList = bestTracks[0] ? bestTracks[0].plays : 1;
  const bestCtx = bestTracks.map((t) => t.id);

  return `<div class="kpis">
    <div class="kpi"><b>${fmtCount(S.totals.plays)}</b><small>Total plays</small></div>
    <div class="kpi"><b>${fmtLong(totalListens)}</b><small>Time listened</small></div>
    <div class="kpi"><b>${fmtCount(tracks.length)}</b><small>Tracks in library</small></div>
    <div class="kpi"><b class="txt">${best ? esc(best.title) : 'Nothing yet'}</b><small>${best ? `Most played &middot; ${fmtCount(best.plays)} plays` : 'Most played track'}</small></div>
    <div class="kpi"><b class="txt">${topArtist ? esc(topArtist.name) : 'Nothing yet'}</b><small>${topArtist ? `Top artist &middot; ${fmtCount(topArtist.plays)} plays` : 'Top artist'}</small></div>
    <div class="kpi"><b>${fmtCount(never)}</b><small>Never played</small></div>
  </div>

  <h2 class="sh">Most played</h2>
  ${bestTracks.length
    ? bestTracks
        .map(
          (t, i) => `<div class="rk"><span class="rank">${i + 1}</span>${artHTML(t)}
      <button class="ttl" type="button" data-act="card-play" data-id="${t.id}" data-ctx="${bestCtx.join(',')}"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></button>
      <span class="bar"><i class="fill" style="width:${Math.round((t.plays / Math.max(1, bestList)) * 100)}%"></i></span>
      <span class="num">${fmtCount(t.plays)}</span></div>`
        )
        .join('')
    : '<div class="empty"><b>No plays yet</b><span>Play a track for a few seconds and the numbers appear here.</span></div>'}

  <h2 class="sh">Top artists</h2>
  ${artists.length
    ? artists
        .slice(0, 10)
        .map(
          (a) => `<div class="rk"><span class="rank">${a.plays || '&middot;'}</span>${artHTML(a.cover || { id: a.name })}
      <button class="ttl" type="button" data-nav="artist" data-param="${esc(a.name)}"><b>${esc(a.name)}</b><small>${a.count} tracks</small></button>
      <span class="bar"><i class="fill" style="width:${Math.round((a.plays / maxPlays) * 100)}%"></i></span>
      <span class="num">${fmtCount(a.plays)}</span></div>`
        )
        .join('')
    : '<div class="empty"><b>No artists yet</b><span>Scan a music folder to fill the library.</span></div>'}

  <h2 class="sh">Last 7 days</h2>
  <div class="hits">${days
    .map(
      (d) => `<div class="hit-row"><span>${esc(day(new Date(d.key)))}</span>
      <span class="bar"><i class="fill" style="width:${Math.round((d.plays / maxDay) * 100)}%"></i></span>
      <span>${fmtCount(d.plays)} plays</span></div>`
    )
    .join('')}</div>

  <h2 class="sh">Listening history</h2>
  ${S.history.length
    ? table(
        S.history
          .slice(0, 20)
          .map((row) => getTrack(row.id))
          .filter(Boolean),
        { animate: false, actsWidth: ACTS_DEFAULT }
      )
    : '<div class="empty"><b>No history yet</b><span>Every play lands here with its timestamp.</span></div>'}`;
}

function searchView() {
  const query = S.search;
  const found = searchAll(query);
  const total = found.tracks.length + found.albums.length + found.artists.length + found.playlists.length;
  if (!query.trim()) {
    return `<div class="empty"><b>Type to search</b><span>Titles, artists, albums, genres and your playlists are all searched at once.</span>
      <span>${fmtCount(S.tracks.size)} tracks from ${esc(S.folders[0] || 'no folder')} are loaded.</span></div>`;
  }
  if (!total) return `<div class="empty"><b>No hits for &ldquo;${esc(query)}&rdquo;</b><span>Try a shorter word or a different spelling.</span></div>`;
  return `${found.tracks.length ? `<h2 class="sh">Tracks <small>${found.tracks.length}</small></h2>${table(found.tracks, { animate: true })}` : ''}
    ${found.albums.length ? `<h2 class="sh">Albums <small>${found.albums.length}</small></h2><div class="shelves">${found.albums.map(albumCard).join('')}</div>` : ''}
    ${found.artists.length ? `<h2 class="sh">Artists <small>${found.artists.length}</small></h2><div class="shelves">${found.artists.map((a) => artistCard(artistsWithMeta().find((x) => x.name === a.name) || { name: a.name, count: 0, plays: a.plays, cover: null })).join('')}</div>` : ''}
    ${found.playlists.length ? `<h2 class="sh">Playlists <small>${found.playlists.length}</small></h2><div class="shelves">${playlistsWithMeta().filter((p) => found.playlists.some((q2) => q2.id === p.id)).map(playlistCard).join('')}</div>` : ''}`;
}

export function renderView(animate = false) {
  const name = S.route.name;
  const param = S.route.param;
  let html = '';

  if (!S.ready) {
    html = '<div class="empty"><b>Reading your music folder</b><span>Scanning files and tags, this takes a moment.</span></div>';
  } else if (name === 'home') {
    html = `${shelf('Recently played', recentTracks(10))}
      ${shelf('Most played', topTracks(10))}
      ${shelf('Recently added', newTracks(10))}
      <h2 class="sh">Everything <small>${fmtCount(S.tracks.size)} tracks</small></h2>
      ${table(libraryTracks().slice(0, 40), { animate })}`;
  } else if (name === 'library') {
    html = `${toolbar()}${table(libraryTracks(), { animate, resetCursor: true })}`;
  } else if (name === 'albums') {
    html = S.albums.length
      ? `<div class="shelves">${S.albums.map(albumCard).join('')}</div>`
      : '<div class="empty"><b>No albums found</b><span>Point the server at a folder with music and rescan.</span></div>';
  } else if (name === 'artists') {
    const artists = artistsWithMeta();
    html = artists.length
      ? `<div class="shelves">${artists.map(artistCard).join('')}</div>`
      : '<div class="empty"><b>No artists yet</b><span>Rescan the folder once music is in place.</span></div>';
  } else if (name === 'liked') {
    const liked = likedTracks();
    html = liked.length
      ? table(liked, { animate, resetCursor: true })
      : '<div class="empty"><b>No liked songs</b><span>Tap the heart on any track and it lands here.</span></div>';
  } else if (name === 'search') {
    html = `${toolbar()}${searchView()}`;
  } else if (name === 'stats') {
    html = statsView();
  } else if (name === 'playlist') {
    const list = playlistsWithMeta().find((p) => p.id === param);
    if (!list) html = '<div class="empty"><b>That playlist is gone</b><span>It may have been deleted.</span></div>';
    else if (!list.count) html = '<div class="empty"><b>This playlist is empty</b><span>Use the + button on any track to add it.</span><button class="btn primary" type="button" data-nav="library">Open all tracks</button></div>';
    else
      html = table(list.tracks, {
        animate,
        resetCursor: true,
        acts: actsPlaylist,
        actsWidth: ACTS_PLAYLIST,
        empty: '<div class="empty"><b>Empty playlist</b></div>'
      });
  } else if (name === 'album') {
    const album = albumByKey(param);
    html = album
      ? table(album.tracks, { animate, resetCursor: true })
      : '<div class="empty"><b>Album not found</b></div>';
  } else if (name === 'artist') {
    const artist = artistsWithMeta().find((a) => a.name === param);
    if (!artist) html = '<div class="empty"><b>Artist not found</b></div>';
    else
      html = `${artist.albums.length ? `<h2 class="sh">Albums</h2><div class="shelves">${artist.albums.map(albumCard).join('')}</div>` : ''}
        <h2 class="sh">Tracks</h2>${table(artist.tracks, { animate, resetCursor: true })}`;
  }

  $('#view').innerHTML = html;
  fillIcons($('#view'));
}

export function setCursor(index, scroll) {
  const total = S.rows.length;
  if (!total) return;
  S.cursor = Math.max(0, Math.min(total - 1, index));
  $$('.tr.is-cursor').forEach((node) => node.classList.remove('is-cursor'));
  const row = $(`.tr[data-i="${S.cursor}"]`);
  if (row) {
    row.classList.add('is-cursor');
    if (scroll) row.scrollIntoView({ block: 'nearest' });
  }
}

export function markCurrent() {
  $$('.tr[data-id]').forEach((node) => node.classList.toggle('is-cur', node.dataset.id === S.current));
  $$('.card[data-id]').forEach((node) => node.classList.toggle('playing', node.dataset.id === S.current));
}

export function renderQueue() {
  const panel = $('#queue');
  if (!S.queueOpen) {
    panel.hidden = true;
    panel.innerHTML = '';
    $('#app').classList.remove('with-queue');
    return;
  }
  panel.hidden = false;
  $('#app').classList.add('with-queue');
  const current = getTrack(S.current);
  const rest = S.order.slice(S.qi + 1).map((id) => getTrack(id)).filter(Boolean);
  const label = S.ctx.length ? `${S.ctx.length} track${S.ctx.length === 1 ? '' : 's'} in context` : 'Nothing queued';
  panel.innerHTML = `<h2>Queue</h2><p class="qsub">${esc(label)}</p>
    ${current ? qItem(current, true) : '<p class="qsub">Play something to fill the queue.</p>'}
    ${rest.length ? rest.map((t) => qItem(t, false)).join('') : ''}`;
}

function qItem(track, now) {
  return `<button class="q-item${now ? ' is-cur' : ''}" type="button" data-act="queue-play" data-id="${track.id}">
    ${artHTML(track)}
    <span><b>${esc(track.title)}</b><small>${esc(track.artist)} &middot; ${track.duration ? fmt(track.duration) : '--:--'}</small></span>
  </button>`;
}

export function renderAll(animate = false) {
  renderSidebar();
  renderTop();
  renderView(animate);
  renderQueue();
}

export async function rescan() {
  toast('Scanning your music folder...');
  try {
    const res = await api.rescan();
    ingest(res.snapshot);
    renderAll(true);
    toast(`Scan finished: ${fmtCount(res.tracks)} tracks found.`);
  } catch (err) {
    toast(`Scan failed: ${err.message}`);
  }
}

export function contextIds() {
  const ids = $('#view')
    ? $$('.tr[data-id]')
        .map((row) => row.dataset.id)
        .filter((id) => S.tracks.has(id))
    : S.rows.slice();
  return ids.length ? ids : S.ctx.slice();
}