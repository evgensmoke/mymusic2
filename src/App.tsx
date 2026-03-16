import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Константы из твоего сайта
const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

const sb = createClient(S_URL, S_KEY);

export default function App() {
  const [media, setMedia] = useState<any>({ music: [], podcasts: [], photos: [], texts: [] });
  const [activeTab, setActiveTab] = useState('home'); // home, catalog, my
  const [activeCat, setActiveCat] = useState('music'); // music, podcasts, photos, texts
  const [curId, setCurId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgImage, setBgImage] = useState(DEF_IMG);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ show: false, content: '' });
  const [updater, setUpdater] = useState(0); // Костыль для принудительного обновления UI
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(p => fetchGH(p)));
    
    let newMedia: any = {
      music: results[0].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Unknown', duration: '0:00', likes: 0, lyrics: '' })).reverse(),
      podcasts: results[1].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Unknown', duration: '0:00', likes: 0 })).reverse(),
      photos: results[2].filter((f:any)=>/\.(jpg|png|webp|jpeg)$/i.test(f.name)).map((f:any)=>({ url: f.download_url, img: f.download_url, title: f.name })).reverse(),
      texts: results[3].filter((f:any)=>f.name.endsWith('.txt')).map((f:any)=>({ title: f.name.replace('.txt',''), url: f.download_url })).reverse()
    };

    // Подтягиваем лайки и обложки из Supabase
    try {
      const { data } = await sb.from('likes').select('*');
      if (data) {
        data.forEach(r => {
          const t = [...newMedia.music, ...newMedia.podcasts].find((x: any) => x.id === r.song_id);
          if (t) {
            t.likes = r.count || 0;
            if (r.artist) t.artist = r.artist;
            if (r.duration) t.duration = r.duration;
            if (r.lyrics) t.lyrics = r.lyrics;
            if (r.cover_data) t.img = r.cover_data;
          }
        });
      }
    } catch (e) { console.log("Supabase error"); }
    setMedia(newMedia);
  };

  const fetchGH = async (p: string) => {
    const r = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, { headers: { 'Authorization': `token ${G_TOKEN}` } });
    return r.ok ? await r.json() : [];
  };

  // --- ЛАЙКИ И ИЗБРАННОЕ ---
  const toggleLike = async (e: any, t: any) => {
    e.stopPropagation();
    const isLiked = !!localStorage.getItem('lk_' + t.id);
    if (isLiked) {
      t.likes--; localStorage.removeItem('lk_' + t.id);
    } else {
      t.likes++; localStorage.setItem('lk_' + t.id, '1');
    }
    setUpdater(prev => prev + 1); // Обновляем UI
    await sb.from('likes').upsert({ song_id: t.id, count: t.likes }, { onConflict: 'song_id' });
  };

  const toggleFav = (e: any, t: any) => {
    e.stopPropagation();
    const isFav = !!localStorage.getItem('fav_' + t.id);
    if (isFav) localStorage.removeItem('fav_' + t.id);
    else localStorage.setItem('fav_' + t.id, '1');
    setUpdater(prev => prev + 1);
  };

  const playTrack = (t: any) => {
    if (curId === t.id) {
      togglePlay();
    } else {
      setCurId(t.id);
      setBgImage(t.img);
      if (audioRef.current) {
        audioRef.current.src = t.url;
        audioRef.current.play();
        setIsPlaying(true);
        updateMediaMetadata(t);
      }
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
      setIsPlaying(!audioRef.current.paused);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = !audioRef.current.paused ? 'playing' : 'paused';
    }
  };

  const getPlaylist = () => {
    if (activeTab === 'home') return media.music.filter((t:any) => t.likes > 0);
    if (activeTab === 'my') return [...media.music, ...media.podcasts].filter((t:any) => localStorage.getItem('fav_' + t.id));
    return media[activeCat] || [];
  };

  const handleNextTrack = () => {
    const list = getPlaylist().filter((x:any) => x.id); // только аудио
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx >= 0 && idx < list.length - 1) playTrack(list[idx + 1]);
  };

  const handlePrevTrack = () => {
    const list = getPlaylist().filter((x:any) => x.id);
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx > 0) playTrack(list[idx - 1]);
  };

  const updateMediaMetadata = (t: any) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title, artist: t.artist, artwork: [{ src: t.img || DEF_IMG, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
    }
  };

  const handleShare = async () => {
    const t = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);
    if (t && navigator.share) await navigator.share({ title: t.title, url: t.url });
  };

  // --- СКАЧИВАНИЕ С ПОДТВЕРЖДЕНИЕМ ---
  const handleDownload = async () => {
    const t = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);
    if (!t) return;
    const fileName = prompt("Подтвердите сохранение (можно изменить имя):", t.title);
    if (!fileName) return; // Если нажал Отмена
    try {
      const r = await fetch(t.url);
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${fileName}.mp3`;
      a.click();
    } catch(e) { alert("Ошибка при скачивании"); }
  };

  const openText = async (item: any) => {
    const r = await fetch(item.url);
    const b = await r.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(b);
    if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(b);
    setModal({ show: true, content: txt });
  };

  let displayItems = getPlaylist().filter((i:any) => (i.title || i.id || '').toLowerCase().includes(search.toLowerCase()));
  const currentTrack = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <input className="search-box" placeholder="Поиск..." value={search} onChange={(e)=>setSearch(e.target.value)} />

      {activeTab === 'catalog' && (
        <div className="category-grid">
          <div className={`cat-card ${activeCat === 'music' ? 'active' : ''}`} onClick={() => setActiveCat('music')}>🎵<span>Музыка</span></div>
          <div className={`cat-card ${activeCat === 'podcasts' ? 'active' : ''}`} onClick={() => {
            if (prompt("Пароль:") === '1285') setActiveCat('podcasts'); else alert("Мимо!");
          }}>🎙️<span>Подкасты</span></div>
          <div className={`cat-card ${activeCat === 'photos' ? 'active' : ''}`} onClick={() => setActiveCat('photos')}>📷<span>Фото</span></div>
          <div className={`cat-card ${activeCat === 'texts' ? 'active' : ''}`} onClick={() => setActiveCat('texts')}>📝<span>Тексты</span></div>
        </div>
      )}

      <div className={`content-grid ${(activeTab === 'catalog' && activeCat === 'photos') ? 'photo-layout' : ''}`}>
        {displayItems.map((item: any) => (
          (activeTab === 'catalog' && activeCat === 'photos') ? (
            <img key={item.url} src={item.url} className="photo-thumb" onClick={() => setBgImage(item.url)} alt="" />
          ) : (activeTab === 'catalog' && activeCat === 'texts') ? (
            <div key={item.title} className="media-item" onClick={() => openText(item)}>
              <div className="media-info"><div className="media-name">📄 {item.title}</div></div>
            </div>
          ) : (
            <div key={item.id} className={`media-item ${curId === item.id ? 'active' : ''}`} onClick={() => playTrack(item)}>
              <img className="media-img" src={item.img || DEF_IMG} alt="" />
              <div className="media-info">
                {item.artist === 'Podcast' && <div className="dev-badge">В РАЗРАБОТКЕ</div>}
                <div className="media-name">{item.title}</div>
                <div className="media-meta">{item.artist} • {item.duration}</div>
              </div>
              <div className="item-btns">
                <span onClick={(e) => toggleLike(e, item)}>{localStorage.getItem('lk_' + item.id) ? '❤️' : '🤍'}</span>
                <span onClick={(e) => toggleFav(e, item)}>{localStorage.getItem('fav_' + item.id) ? '⭐' : '➕'}</span>
              </div>
            </div>
          )
        ))}
        {displayItems.length === 0 && <div style={{textAlign:'center', opacity:0.5, marginTop:20}}>Тут пока пусто...</div>}
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
          <div className="controls-row">
            <button className="ctrl-btn" onClick={handleShare}>📤</button>
            <button className="ctrl-btn" onClick={handlePrevTrack}>⏮</button>
            <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="ctrl-btn" onClick={handleNextTrack}>⏭</button>
            <button className="ctrl-btn" onClick={handleDownload}>⬇️</button>
          </div>
        </div>
      )}

      {/* НИЖНИЕ КНОПКИ ТОЧНО КАК НА САЙТЕ */}
      <nav className="bottom-nav">
        <div className={`nav-item ${activeTab==='home'?'active':''}`} onClick={() => setActiveTab('home')}>🏠<span>Главная</span></div>
        <div className={`nav-item ${activeTab==='catalog'?'active':''}`} onClick={() => setActiveTab('catalog')}>🗂️<span>Каталог</span></div>
        <div className={`nav-item ${activeTab==='my'?'active':''}`} onClick={() => setActiveTab('my')}>👤<span>Моё</span></div>
      </nav>

      {modal.show && (
        <div id="modal" style={{display:'flex'}} onClick={()=>setModal({show:false, content:''})}>
          <div id="modal-content" onClick={e=>e.stopPropagation()}>{modal.content}</div>
        </div>
      )}

      <audio ref={audioRef} 
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} 
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleNextTrack}
      />
    </div>
  );
}
