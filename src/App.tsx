import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Константы из твоей ветки
const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

const sb = createClient(S_URL, S_KEY);

export default function App() {
  const [media, setMedia] = useState<any>({ music: [], podcasts: [], photos: [], texts: [] });
  const [activeTab, setActiveTab] = useState('home'); 
  const [activeCat, setActiveCat] = useState('music'); 
  const [curId, setCurId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgImage, setBgImage] = useState(DEF_IMG);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ show: false, content: '' });
  const [updater, setUpdater] = useState(0); // Для ререндера лайков/звезд
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { initApp(); }, []);

  // Нативная шторка Android
  useEffect(() => {
    const track = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (track && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || 'Evgen Music',
        artwork: [{ src: track.img || DEF_IMG, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
    }
  }, [curId, media]);

  const initApp = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(p => fetchGH(p)));
    
    let newMedia: any = {
      music: results[0].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Evgen', likes: 0, lyrics: '' })).reverse(),
      podcasts: results[1].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Podcast', likes: 0 })).reverse(),
      photos: results[2].filter((f:any)=>/\.(jpg|png|webp|jpeg)$/i.test(f.name)).map((f:any)=>({ url: f.download_url, img: f.download_url, title: f.name })).reverse(),
      texts: results[3].filter((f:any)=>f.name.endsWith('.txt')).map((f:any)=>({ title: f.name.replace('.txt',''), url: f.download_url }))
    };

    const { data } = await sb.from('likes').select('*');
    if (data) {
      data.forEach(r => {
        const t = [...newMedia.music, ...newMedia.podcasts].find((x: any) => x.id === r.song_id);
        if (t) {
          t.likes = r.count || 0;
          if (r.lyrics) t.lyrics = r.lyrics;
          if (r.cover_data) t.img = r.cover_data;
        }
      });
    }
    setMedia(newMedia);
  };

  const fetchGH = async (p: string) => {
    const r = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, { headers: { 'Authorization': `token ${G_TOKEN}` } });
    return r.ok ? await r.json() : [];
  };

  const play = (t: any) => {
    if (curId === t.id) {
      isPlaying ? audioRef.current?.pause() : audioRef.current?.play();
    } else {
      setCurId(t.id);
      setBgImage(t.img || DEF_IMG);
      if (audioRef.current) {
        audioRef.current.src = t.url;
        audioRef.current.play();
      }
    }
  };

  const toggleLike = async (e: any, t: any) => {
    e.stopPropagation();
    const key = 'lk_' + t.id;
    if (localStorage.getItem(key)) { t.likes--; localStorage.removeItem(key); } 
    else { t.likes++; localStorage.setItem(key, '1'); }
    setUpdater(u => u + 1);
    await sb.from('likes').upsert({ song_id: t.id, count: t.likes }, { onConflict: 'song_id' });
  };

  const toggleFav = (e: any, t: any) => {
    e.stopPropagation();
    const key = 'fav_' + t.id;
    localStorage.getItem(key) ? localStorage.removeItem(key) : localStorage.setItem(key, '1');
    setUpdater(u => u + 1);
  };

  const handleNext = () => {
    const list = getPlaylist();
    const i = list.findIndex(x => x.id === curId);
    if (i < list.length - 1) play(list[i + 1]);
  };

  const handlePrev = () => {
    const list = getPlaylist();
    const i = list.findIndex(x => x.id === curId);
    if (i > 0) play(list[i - 1]);
  };

  const getPlaylist = () => {
    if (activeTab === 'home') return media.music.filter((t:any) => t.likes > 0);
    if (activeTab === 'my') return [...media.music, ...media.podcasts].filter((t:any) => localStorage.getItem('fav_' + t.id));
    return media[activeCat] || [];
  };

  const handleShare = () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (navigator.share && t) {
      navigator.share({ title: t.title, url: t.url }).catch(() => {});
    }
  };

  const handleDownload = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t) return;
    try {
      const r = await fetch(t.url);
      const b = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = t.title + ".mp3";
      a.click();
    } catch (e) { alert("Ошибка загрузки"); }
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return "0:00";
    let m = Math.floor(s / 60), sc = Math.floor(s % 60);
    return `${m}:${sc < 10 ? '0' : ''}${sc}`;
  };

  const currentTrack = [...media.music, ...media.podcasts].find(x => x.id === curId);

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <input className="search-box" placeholder="Поиск..." value={search} onChange={(e)=>setSearch(e.target.value)} />

      {activeTab === 'catalog' && (
        <div className="category-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px'}}>
          <div className={`cat-card ${activeCat==='music'?'active':''}`} style={{padding:'10px', background: activeCat==='music'?'#00f2ff':'rgba(255,255,255,0.1)', borderRadius:'10px', textAlign:'center', color: activeCat==='music'?'#000':'#fff'}} onClick={()=>setActiveCat('music')}>Музыка</div>
          <div className={`cat-card ${activeCat==='podcasts'?'active':''}`} style={{padding:'10px', background: activeCat==='podcasts'?'#00f2ff':'rgba(255,255,255,0.1)', borderRadius:'10px', textAlign:'center', color: activeCat==='podcasts'?'#000':'#fff'}} onClick={()=>{ if(prompt("Пароль:")==='1285') setActiveCat('podcasts'); }}>Подкасты</div>
          <div className={`cat-card ${activeCat==='photos'?'active':''}`} style={{padding:'10px', background: activeCat==='photos'?'#00f2ff':'rgba(255,255,255,0.1)', borderRadius:'10px', textAlign:'center', color: activeCat==='photos'?'#000':'#fff'}} onClick={()=>setActiveCat('photos')}>Фото</div>
          <div className={`cat-card ${activeCat==='texts'?'active':''}`} style={{padding:'10px', background: activeCat==='texts'?'#00f2ff':'rgba(255,255,255,0.1)', borderRadius:'10px', textAlign:'center', color: activeCat==='texts'?'#000':'#fff'}} onClick={()=>setActiveCat('texts')}>Тексты</div>
        </div>
      )}

      <div className="content-list">
        {getPlaylist().filter((i:any) => (i.title || '').toLowerCase().includes(search.toLowerCase())).map((item: any) => (
          activeCat === 'photos' && activeTab === 'catalog' ? (
            <img key={item.url} src={item.url} style={{width:'100%', borderRadius:'15px', marginBottom:'10px'}} />
          ) : activeCat === 'texts' && activeTab === 'catalog' ? (
            <div key={item.url} className="media-item" onClick={async () => {
               const r = await fetch(item.url); const b = await r.arrayBuffer();
               let txt = new TextDecoder('utf-8').decode(b);
               setModal({ show: true, content: txt });
            }}>📄 {item.title}</div>
          ) : (
            <div key={item.id} className={`media-item ${curId === item.id ? 'active' : ''}`} onClick={() => play(item)}>
              <img className="media-img" src={item.img || DEF_IMG} />
              <div className="media-info">
                <div className="media-name">{item.title}</div>
              </div>
              <div className="item-btns">
                <span onClick={(e) => toggleLike(e, item)}>{localStorage.getItem('lk_'+item.id)?'❤️':'🤍'}</span>
                <span onClick={(e) => toggleFav(e, item)}>{localStorage.getItem('fav_'+item.id)?'⭐':'➕'}</span>
              </div>
            </div>
          )
        ))}
      </div>

      {currentTrack && (
        <div className="player-panel">
          <div id="now-playing" onClick={() => currentTrack.lyrics && setModal({show:true, content: currentTrack.lyrics})}>
            {currentTrack.title}
          </div>
          <div className="progress-area" onClick={(e) => {
             const rect = e.currentTarget.getBoundingClientRect();
             if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration;
          }}>
            <div id="progress-fill" style={{ width: `${(currentTime/duration)*100 || 0}%` }}></div>
          </div>
          <div className="time-info" style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="controls-row">
            <button className="ctrl-btn" onClick={handleShare}><svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg></button>
            <button className="ctrl-btn" onClick={() => {if(audioRef.current) audioRef.current.currentTime-=10}}><svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg></button>
            <button className="ctrl-btn" onClick={handlePrev}><svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
            <button className="play-btn" onClick={() => play(currentTrack)} style={{background:'#00f2ff', borderRadius:'50%', width:'50px', height:'50px', border:'none'}}>
                {isPlaying ? <svg viewBox="0 0 24 24" width="30"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg viewBox="0 0 24 24" width="30"><path d="M8 5v14l11-7z"/></svg>}
            </button>
            <button className="ctrl-btn" onClick={handleNext}><svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
            <button className="ctrl-btn" onClick={() => {if(audioRef.current) audioRef.current.currentTime+=10}}><svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg></button>
            <button className="ctrl-btn" onClick={handleDownload}><svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <div className={`nav-item ${activeTab==='home'?'active':''}`} onClick={()=>setActiveTab('home')}>🏠<span>Главная</span></div>
        <div className={`nav-item ${activeTab==='catalog'?'active':''}`} onClick={()=>setActiveTab('catalog')}>📂<span>Каталог</span></div>
        <div className={`nav-item ${activeTab==='my'?'active':''}`} onClick={()=>setActiveTab('my')}>❤️<span>Моё</span></div>
      </nav>

      {modal.show && <div id="modal" style={{display:'flex', position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:1000, padding:'20px', overflowY:'auto'}} onClick={()=>setModal({show:false,content:''})}><div onClick={e=>e.stopPropagation()} style={{whiteSpace:'pre-wrap'}}>{modal.content}</div></div>}

      <audio ref={audioRef} onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)} onTimeUpdate={()=>setCurrentTime(audioRef.current?.currentTime || 0)} onLoadedMetadata={()=>setDuration(audioRef.current?.duration || 0)} onEnded={handleNext} />
    </div>
  );
}
