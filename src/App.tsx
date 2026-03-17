import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- КОНФИГ ---
const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";
const PODCAST_PASS = "1285";

let sb: any = null;
try { sb = createClient(S_URL, S_KEY); } catch (e) {}

// --- ТИПЫ ---
type Track = {
  id: string; title: string; artist: string; url: string; img: string;
  duration: string; likes: number; lyrics: string; cat: 'music' | 'podcasts';
};
type Photo = { url: string };
type TextItem = { title: string; url: string };
type TabType = 'home' | 'catalog' | 'my';
type CatType = 'music' | 'podcasts' | 'photos' | 'texts';

export default function App() {
  const [media, setMedia] = useState<{ music: Track[]; podcasts: Track[]; photos: Photo[]; texts: TextItem[] }>({
    music: [], podcasts: [], photos: [], texts: []
  });
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [currentCategory, setCurrentCategory] = useState<CatType>('music');
  const [curId, setCurId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [bgImage, setBgImage] = useState<string>('');
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [customOrder, setCustomOrder] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.hasOwnProperty('jsmediatags')) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js";
      document.body.appendChild(script);
    }
    const savedOrder = localStorage.getItem('evgen_track_order');
    if (savedOrder) { try { setCustomOrder(JSON.parse(savedOrder)); } catch (e) {} }
    initData();
  }, []);

  const initData = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(async (p) => {
      try {
        const r = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, {
          headers: { 'Authorization': `token ${G_TOKEN}` }
        });
        return r.ok ? await r.json() : [];
      } catch { return []; }
    }));
    
    const mapTrack = (f: any, cat: 'music' | 'podcasts'): Track => ({
      id: f.name.replace('.mp3', ''),
      title: decodeURIComponent(f.name.replace('.mp3', '')),
      artist: 'Unknown', url: f.download_url, img: DEF_IMG,
      duration: '0:00', likes: 0, lyrics: '', cat
    });

    const newMedia = {
      music: (results[0] || []).filter((f: any) => f.name.endsWith('.mp3')).map((f: any) => mapTrack(f, 'music')).reverse(),
      podcasts: (results[1] || []).filter((f: any) => f.name.endsWith('.mp3')).map((f: any) => mapTrack(f, 'podcasts')).reverse(),
      photos: (results[2] || []).filter((f: any) => /\.(jpg|png|webp|jpeg)$/i.test(f.name)).map((f: any) => ({ url: f.download_url })).reverse(),
      texts: (results[3] || []).filter((f: any) => f.name.endsWith('.txt')).map((f: any) => ({ title: f.name.replace('.txt', ''), url: f.download_url })).reverse()
    };

    if (sb) {
      const { data } = await sb.from('likes').select('*');
      if (data) {
        data.forEach((r: any) => {
          const t = [...newMedia.music, ...newMedia.podcasts].find(x => x.id === r.song_id);
          if (t) {
            t.likes = r.count || 0;
            if (r.duration && r.duration !== '0:00') t.duration = r.duration;
            if (r.artist) t.artist = r.artist;
            if (r.cover_data) t.img = r.cover_data;
            if (r.lyrics) t.lyrics = r.lyrics;
          }
        });
      }
    }
    setMedia(newMedia);
  };

  const updateMediaMetadata = useCallback((t: Track) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist,
        artwork: [{ src: t.img, sizes: '512x512', type: 'image/jpeg' }]
      });
    }
  }, []);

  const playTrack = (t: Track) => {
    if (curId === t.id) { togglePlay(); return; }
    setCurId(t.id);
    if (audioRef.current) {
      audioRef.current.src = t.url;
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          setAudioDuration(audioRef.current.duration);
          updateMediaMetadata(t);
        }
      };
      audioRef.current.play();
      setIsPlaying(true);
      setBgImage(t.img);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); }
      else { audioRef.current.pause(); setIsPlaying(false); }
    }
  };

  const handleNextTrack = useCallback(() => {
    let l = currentCategory === 'podcasts' ? media.podcasts : media.music;
    let i = l.findIndex(x => x.id === curId);
    if (i < l.length - 1 && i !== -1) playTrack(l[i + 1]);
  }, [curId, currentCategory, media]);

  const handlePrevTrack = useCallback(() => {
    let l = currentCategory === 'podcasts' ? media.podcasts : media.music;
    let i = l.findIndex(x => x.id === curId);
    if (i > 0) playTrack(l[i - 1]);
  }, [curId, currentCategory, media]);

  // Копируй это и жди Часть 2...
      // --- ПРОДОЛЖЕНИЕ ЛОГИКИ (ВЗАИМОДЕЙСТВИЯ) ---
  const toggleLike = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const t = [...media.music, ...media.podcasts].find(x => x.id === id);
    if (!t) return;
    if (localStorage.getItem('lk_' + id)) {
      t.likes--; localStorage.removeItem('lk_' + id);
    } else {
      t.likes++; localStorage.setItem('lk_' + id, '1');
    }
    setMedia({ ...media });
    if (sb) await sb.from('likes').upsert({ song_id: id, count: t.likes, duration: t.duration }, { onConflict: 'song_id' });
  };

  const toggleFav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = 'fav_' + id;
    localStorage.getItem(key) ? localStorage.removeItem(key) : localStorage.setItem(key, '1');
    setMedia({ ...media });
  };

  const downloadCurrent = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t || !window.confirm(`Качаем "${t.title}"?`)) return;
    try {
      const r = await fetch(t.url); const b = await r.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(b);
      a.download = t.title + ".mp3"; a.click();
    } catch (e) { alert("Ошибка загрузки"); }
  };

  const shareCurrent = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t) return;
    if (navigator.share) {
      navigator.share({ title: t.title, url: window.location.href }).catch(()=>{});
    } else {
      navigator.clipboard.writeText(t.url); alert("Ссылка в буфере!");
    }
  };

  // --- СОРТИРОВКА И СВАЙПЫ ---
  const onDragStart = (e: React.TouchEvent, id: string) => { e.stopPropagation(); setDraggingId(id); };

  const onDragMove = useCallback((e: TouchEvent) => {
    if (!draggingId || !listRef.current) return;
    const touch = e.touches[0];
    const elements = Array.from(listRef.current.querySelectorAll('.media-item'));
    let hoverId = null;
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) hoverId = el.getAttribute('data-id');
    });
    if (hoverId && hoverId !== draggingId) {
      setCustomOrder(prev => {
        const order = prev.length > 0 ? [...prev] : filteredList.map(t => t.id);
        const fromIdx = order.indexOf(draggingId); const toIdx = order.indexOf(hoverId as string);
        if (fromIdx > -1 && toIdx > -1) {
          order.splice(fromIdx, 1); order.splice(toIdx, 0, draggingId); return order;
        }
        return prev;
      });
    }
  }, [draggingId]);

  const onDragEnd = useCallback(() => {
    if (draggingId) localStorage.setItem('evgen_track_order', JSON.stringify(customOrder));
    setDraggingId(null);
  }, [draggingId, customOrder]);

  useEffect(() => {
    if (draggingId) {
      document.addEventListener('touchmove', onDragMove, { passive: false });
      document.addEventListener('touchend', onDragEnd);
      return () => { document.removeEventListener('touchmove', onDragMove); document.removeEventListener('touchend', onDragEnd); };
    }
  }, [draggingId, onDragMove, onDragEnd]);

  const filteredList = useMemo(() => {
    let list = currentTab === 'home' ? media.music.filter(t => t.likes > 0) : 
               currentTab === 'my' ? [...media.music, ...media.podcasts].filter(t => localStorage.getItem('fav_' + t.id)) :
               (media[currentCategory] || []);
    if (searchQuery) list = list.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (currentTab === 'home' && !searchQuery && customOrder.length > 0) {
      const sorted: Track[] = []; const rem = [...list];
      customOrder.forEach(id => { const idx = rem.findIndex(t => t.id === id); if (idx !== -1) sorted.push(rem.splice(idx, 1)[0]); });
      return [...sorted, ...rem];
    }
    return list;
  }, [media, currentTab, currentCategory, searchQuery, customOrder]);

  const currentTrackObj = [...media.music, ...media.podcasts].find(x => x.id === curId);

  return (
    <div className="app-container">
      <style>{`
        :root { --neon: #00f2ff; --glass: rgba(255,255,255,0.08); --border: rgba(255,255,255,0.15); }
        body { background: #020617; color: #fff; font-family: sans-serif; margin: 0; padding-bottom: 240px; }
        .app-container { padding: 15px; }
        #bg-layer { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; filter: blur(60px) brightness(0.15); z-index: -1; }
        .main-title { color: var(--neon); text-align: center; font-size: 1.5rem; font-weight: 800; margin: 15px 0; text-shadow: 0 0 10px var(--neon); }
        .search-box { width: 100%; background: var(--glass); border: 1px solid var(--border); border-radius: 20px; padding: 12px; color: #fff; margin-bottom: 15px; }
        .category-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 15px; }
        .cat-card { background: var(--glass); border: 1px solid var(--border); border-radius: 10px; padding: 10px 5px; text-align: center; font-size: 0.7rem; }
        .cat-card.active { border-color: var(--neon); color: var(--neon); background: rgba(0,242,255,0.1); }
        .media-item { display: flex; align-items: center; background: var(--glass); border: 1px solid var(--border); border-radius: 12px; padding: 10px; margin-bottom: 8px; position: relative; }
        .media-item.active { border-color: var(--neon); }
        .drag-handle { padding: 5px; color: #475569; margin-right: 5px; }
        .media-img { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; margin-right: 12px; }
        .media-info { flex-grow: 1; overflow: hidden; }
        .media-name { font-size: 0.9rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 50px; }
        .item-btns { position: absolute; right: 10px; display: flex; gap: 10px; font-size: 1.1rem; }
        .player-panel { position: fixed; bottom: 85px; left: 5%; width: 90%; background: rgba(13,18,30,0.9); border: 1px solid var(--border); border-radius: 20px; padding: 15px; backdrop-filter: blur(10px); }
        .progress-area { height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; margin: 10px 0; }
        #progress-fill { height: 100%; background: var(--neon); box-shadow: 0 0 8px var(--neon); }
        .controls-row { display: flex; justify-content: space-between; align-items: center; }
        .play-btn { width: 50px; height: 50px; background: var(--neon); border-radius: 50%; border: none; display: flex; justify-content: center; align-items: center; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 70px; background: #0a0f1c; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid var(--border); }
        .nav-item { color: #64748b; font-size: 0.7rem; text-align: center; }
        .nav-item.active { color: var(--neon); }
        #modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
        #modal-content { background: #1e293b; padding: 20px; border-radius: 15px; max-height: 70%; overflow: auto; width: 100%; color: #fff; white-space: pre-wrap; }
      `}</style>

      <div id="bg-layer" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none' }}></div>
      <div className="main-title">EVGEN MUSIC</div>
      <input type="text" className="search-box" placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />

      {currentTab === 'catalog' && (
        <div className="category-grid">
          {['music', 'podcasts', 'photos', 'texts'].map(c => (
            <div key={c} className={`cat-card ${currentCategory === c ? 'active' : ''}`} onClick={() => setCurrentCategory(c as any)}>{c}</div>
          ))}
        </div>
      )}

      <div className="content-grid" ref={listRef}>
        {filteredList.map(item => (
          <div key={item.id} data-id={item.id} className={`media-item ${curId === item.id ? 'active' : ''}`} onClick={() => playTrack(item)}>
            {currentTab === 'home' && <div className="drag-handle" onTouchStart={e => onDragStart(e, item.id)}>⠿</div>}
            <img src={item.img} className="media-img" alt="" />
            <div className="media-info">
              <div className="media-name">{item.title}</div>
              <div style={{fontSize:'0.7rem', color:'#94a3b8'}}>{item.duration}</div>
            </div>
            <div className="item-btns">
              <span onClick={e => toggleLike(item.id, e)}>{localStorage.getItem('lk_'+item.id)?'❤️':'🤍'}</span>
            </div>
          </div>
        ))}
      </div>

      {currentTrackObj && (
        <div className="player-panel">
          <div style={{textAlign:'center', fontSize:'0.8rem', color: 'var(--neon)'}}>{currentTrackObj.title}</div>
          <div className="progress-area"><div id="progress-fill" style={{ width: `${(currentTime/audioDuration)*100}%` }}></div></div>
          <div className="controls-row">
            <button onClick={handlePrevTrack} style={{background:'none', border:'none', color:'#fff'}}>⏮</button>
            <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶️'}</button>
            <button onClick={handleNextTrack} style={{background:'none', border:'none', color:'#fff'}}>⏭</button>
            <button onClick={downloadCurrent} style={{background:'none', border:'none', color:'#fff'}}>⬇️</button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <div className={`nav-item ${currentTab === 'home'?'active':''}`} onClick={() => setCurrentTab('home')}>🏠<div>Главная</div></div>
        <div className={`nav-item ${currentTab === 'catalog'?'active':''}`} onClick={() => setCurrentTab('catalog')}>📁<div>Каталог</div></div>
        <div className={`nav-item ${currentTab === 'my'?'active':''}`} onClick={() => setCurrentTab('my')}>⭐<div>Моё</div></div>
      </nav>

      <audio ref={audioRef} onEnded={handleNextTrack} onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)} />
    </div>
  );
          }
