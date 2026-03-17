import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";

let sb: any = null;
try { sb = createClient(S_URL, S_KEY); } catch (e) {}

type Track = { id: string; title: string; artist: string; url: string; img: string; duration: string; likes: number; lyrics: string; plays: number; };

export default function App() {
  const [media, setMedia] = useState<{ music: Track[]; podcasts: Track[]; photos: any[]; texts: any[] }>({ music: [], podcasts: [], photos: [], texts: [] });
  const [currentTab, setCurrentTab] = useState<'home' | 'catalog' | 'my'>('home');
  const [currentCategory, setCurrentCategory] = useState<'music' | 'podcasts' | 'photos' | 'texts'>('music');
  const [curId, setCurId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  const [myOrder, setMyOrder] = useState<string[]>(JSON.parse(localStorage.getItem('my_order') || '[]'));
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(p => fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, { headers: { 'Authorization': `token ${G_TOKEN}` } }).then(r => r.json())));
    const mapTrack = (f: any) => ({
      id: f.name.replace('.mp3', ''), title: decodeURIComponent(f.name.replace('.mp3', '')),
      artist: 'Evgen Music', url: f.download_url, img: DEF_IMG, duration: '0:00', likes: 0, plays: 0, lyrics: ''
    });
    const newMedia = {
      music: (results[0] || []).filter((f: any) => f.name.endsWith('.mp3')).map(mapTrack).reverse(),
      podcasts: (results[1] || []).filter((f: any) => f.name.endsWith('.mp3')).map(mapTrack).reverse(),
      photos: (results[2] || []).filter((f: any) => /\.(jpg|png|webp|jpeg)$/i.test(f.name)).map((f: any) => ({ url: f.download_url })).reverse(),
      texts: (results[3] || []).filter((f: any) => f.name.endsWith('.txt')).map((f: any) => ({ title: f.name.replace('.txt', ''), url: f.download_url })).reverse()
    };
    if (sb) {
      const { data } = await sb.from('likes').select('*');
      if (data) data.forEach((r: any) => {
        const t = [...newMedia.music, ...newMedia.podcasts].find(x => x.id === r.song_id);
        if (t) { t.likes = r.count || 0; t.plays = r.plays || 0; t.duration = r.duration || '0:00'; if (r.cover_data) t.img = r.cover_data; t.lyrics = r.lyrics || ''; }
      });
    }
    setMedia(newMedia);
  };

  const playTrack = (t: Track) => {
    if (curId === t.id) { togglePlay(); return; }
    setCurId(t.id);
    if (audioRef.current) { audioRef.current.src = t.url; audioRef.current.play().catch(()=>{}); setIsPlaying(true); setBgImage(t.img); }
  };

  const togglePlay = () => {
    if (audioRef.current) { if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); } else { audioRef.current.pause(); setIsPlaying(false); } }
  };

  const handleNextTrack = () => {
    const list = currentTab === 'my' ? getMyList() : (currentCategory === 'podcasts' ? media.podcasts : media.music);
    const i = list.findIndex(x => x.id === curId);
    if (i < list.length - 1) playTrack(list[i + 1]);
  };

  const handlePrevTrack = () => {
    const list = currentTab === 'my' ? getMyList() : (currentCategory === 'podcasts' ? media.podcasts : media.music);
    const i = list.findIndex(x => x.id === curId);
    if (i > 0) playTrack(list[i - 1]);
  };

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = getMyList().map(t => t.id);
    const draggedItemContent = items.splice(dragItem.current, 1)[0];
    items.splice(dragOverItem.current, 0, draggedItemContent);
    setMyOrder(items);
    localStorage.setItem('my_order', JSON.stringify(items));
    dragItem.current = null; dragOverItem.current = null;
  };

  const getMyList = () => {
    const favs = [...media.music, ...media.podcasts].filter(t => localStorage.getItem('fav_' + t.id));
    return favs.sort((a, b) => {
        const ai = myOrder.indexOf(a.id); const bi = myOrder.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  };
                           const share = () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (navigator.share && t) navigator.share({ title: t.title, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); alert("Ссылка скопирована"); }
  };

  const download = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t) return;
    if (window.confirm(`Скачать "${t.title}"?`)) {
        try {
            const r = await fetch(t.url); const b = await r.blob();
            const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = t.title + ".mp3"; a.click();
        } catch(e) { window.open(t.url, '_blank'); }
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60); const sc = Math.floor(s % 60);
    return `${m}:${sc < 10 ? '0' : ''}${sc}`;
  };

  let list: any[] = [];
  if (currentTab === 'home') list = media.music.filter(t => t.likes > 0).sort((a,b) => b.plays - a.plays);
  else if (currentTab === 'my') list = getMyList();
  else list = media[currentCategory] || [];

  if (searchQuery) list = list.filter(i => (i.title || '').toLowerCase().includes(searchQuery.toLowerCase()));

  const currentTrack = [...media.music, ...media.podcasts].find(x => x.id === curId);

  return (
    <div className="app-container">
        <style>{`
            :root { --neon: #00f2ff; --glass: rgba(255, 255, 255, 0.08); --border: rgba(255, 255, 255, 0.15); }
            body { background: #020617; color: #fff; font-family: sans-serif; margin: 0; padding: 10px 10px 240px; overflow-x: hidden; }
            #bg-layer { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; filter: blur(60px) brightness(0.15); z-index: -1; transition: 1.5s; }
            .main-title { color: var(--neon); text-align: center; font-size: 1.5rem; margin: 15px 0; font-weight: bold; letter-spacing: 2px; }
            .search-box { width: 100%; max-width: 500px; margin: 0 auto 15px; background: var(--glass); border: 1px solid var(--border); border-radius: 20px; padding: 12px 20px; color: #fff; display: block; font-size: 16px; }
            .category-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; max-width: 500px; margin: 0 auto 15px; }
            .cat-card { background: var(--glass); border: 1px solid var(--border); border-radius: 10px; padding: 12px 5px; text-align: center; color: #94a3b8; font-size: 0.7rem; cursor: pointer; }
            .cat-card.active { border-color: var(--neon); color: var(--neon); background: rgba(0, 242, 255, 0.1); }
            .content-grid { max-width: 500px; margin: 0 auto; display: flex; flex-direction: column; gap: 8px; }
            .media-item { display: flex; align-items: center; background: var(--glass); border: 1px solid var(--border); border-radius: 12px; padding: 10px; position: relative; cursor: pointer; }
            .media-item.active { border-color: var(--neon); background: rgba(0, 242, 255, 0.1); }
            .media-img { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; margin-right: 12px; flex-shrink: 0; }
            .media-info { flex-grow: 1; overflow: hidden; }
            .media-name { font-size: 0.9rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 65px; }
            .item-btns { position: absolute; right: 10px; display: flex; gap: 10px; font-size: 1.1rem; }
            
            /* ЦЕНТРОВКА ПЛЕЕРА */
            .player-panel { position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%); width: calc(100% - 30px); max-width: 500px; background: rgba(13, 18, 30, 0.98); border: 1px solid var(--border); border-radius: 24px; padding: 15px; z-index: 1000; backdrop-filter: blur(20px); box-sizing: border-box; }
            #now-playing { color: var(--neon); text-align: center; font-size: 0.85rem; font-weight: 700; margin-bottom: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .progress-area { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin: 10px 0 5px; cursor: pointer; }
            #progress-fill { height: 100%; background: var(--neon); width: 0%; border-radius: 3px; box-shadow: 0 0 10px var(--neon); }
            .time-info { display: flex; justify-content: space-between; font-size: 0.65rem; color: #64748b; margin-bottom: 12px; }
            
            /* 7 КНОПОК В РЯД */
            .controls-row { display: flex; justify-content: space-around; align-items: center; width: 100%; }
            .ctrl-btn { background: none; border: none; fill: #94a3b8; cursor: pointer; padding: 5px; flex: 1; display: flex; justify-content: center; }
            .ctrl-btn svg { width: 24px; height: 24px; }
            .play-btn { width: 55px; height: 55px; background: var(--neon); border-radius: 50%; display: flex; justify-content: center; align-items: center; fill: #000; border: none; flex-shrink: 0; }
            
            .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 75px; background: #0a0f1c; border-top: 1px solid var(--border); display: flex; justify-content: space-around; align-items: center; z-index: 1001; }
            .nav-item { color: #64748b; font-size: 0.7rem; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; flex: 1; }
            .nav-item.active { color: var(--neon); }
            .nav-item svg { width: 24px; height: 24px; fill: currentColor; }
        `}</style>
      <div id="bg-layer" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none' }}></div>
      <header><div className="main-title">EVGEN MUSIC</div><input type="text" className="search-box" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}/></header>
      {currentTab === 'catalog' && (
        <div className="category-grid">
            {['music', 'podcasts', 'photos', 'texts'].map(c => <div key={c} className={`cat-card ${currentCategory === c ? 'active' : ''}`} onClick={() => setCurrentCategory(c as any)}>{c.toUpperCase()}</div>)}
        </div>
      )}
      <div className="content-grid">
        {list.map((item, idx) => (
            <div key={item.id} className={`media-item ${curId === item.id ? 'active' : ''}`} 
                 draggable={currentTab === 'my'}
                 onDragStart={() => (dragItem.current = idx)}
                 onDragEnter={() => (dragOverItem.current = idx)}
                 onDragEnd={handleSort}
                 onDragOver={(e) => e.preventDefault()}
                 onClick={() => playTrack(item)}>
              <img src={item.img} className="media-img" alt="" />
              <div className="media-info"><div className="media-name">{item.title}</div></div>
              <div className="item-btns">
                <span onClick={(e) => { e.stopPropagation(); if(localStorage.getItem('lk_'+item.id)){localStorage.removeItem('lk_'+item.id)}else{localStorage.setItem('lk_'+item.id,'1')} setMedia({...media}); }}>{localStorage.getItem('lk_'+item.id)?'❤️':'🤍'}</span>
                <span onClick={(e) => { e.stopPropagation(); const isFav = localStorage.getItem('fav_'+item.id); if(isFav){localStorage.removeItem('fav_'+item.id); setMyOrder(myOrder.filter(x=>x!==item.id))}else{localStorage.setItem('fav_'+item.id,'1'); setMyOrder([...myOrder, item.id])} setMedia({...media}); }}>{localStorage.getItem('fav_'+item.id)?'⭐':'➕'}</span>
              </div>
            </div>
        ))}
      </div>
      <div className="player-panel">
        <div id="now-playing" onClick={() => { if(currentTrack?.lyrics) alert(currentTrack.lyrics); }}>{currentTrack ? currentTrack.title : 'ВЫБЕРИТЕ ТРЕК'}</div>
        <div className="progress-area" onClick={(e) => { if(audioRef.current) audioRef.current.currentTime = (e.nativeEvent.offsetX / e.currentTarget.offsetWidth) * audioRef.current.duration; }}>
            <div id="progress-fill" style={{ width: `${(currentTime/duration*100)||0}%` }}></div>
        </div>
        <div className="time-info"><span>{formatTime(currentTime)}</span><span>{duration ? formatTime(duration) : '0:00'}</span></div>
        <div className="controls-row">
          <button className="ctrl-btn" onClick={share}><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg></button>
          <button className="ctrl-btn" onClick={handlePrevTrack}><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
          <button className="ctrl-btn" onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 10; }}><svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg></button>
          <button className="play-btn" onClick={togglePlay}><svg viewBox="0 0 24 24" width="30" height="30">{isPlaying ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/> : <path d="M8 5v14l11-7z"/>}</svg></button>
          <button className="ctrl-btn" onClick={() => { if(audioRef.current) audioRef.current.currentTime += 10; }}><svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg></button>
          <button className="ctrl-btn" onClick={handleNextTrack}><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
          <button className="ctrl-btn" onClick={download}><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>
        </div>
      </div>
      <nav className="bottom-nav">
        <div className={`nav-item ${currentTab === 'home'?'active':''}`} onClick={()=>setCurrentTab('home')}><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Главная</span></div>
        <div className={`nav-item ${currentTab === 'catalog'?'active':''}`} onClick={()=>setCurrentTab('catalog')}><svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg><span>Каталог</span></div>
        <div className={`nav-item ${currentTab === 'my'?'active':''}`} onClick={()=>setCurrentTab('my')}><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><span>Моё</span></div>
      </nav>
      <audio ref={audioRef} onEnded={handleNextTrack} onTimeUpdate={()=>{if(audioRef.current){setCurrentTime(audioRef.current.currentTime); setDuration(audioRef.current.duration);}}} />
    </div>
  );
                                                                                                                                                                                                             }
