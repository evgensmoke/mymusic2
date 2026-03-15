import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Константы проекта
const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

// Инициализация Supabase
const sb = createClient(S_URL, S_KEY);

export default function App() {
  const [media, setMedia] = useState({ music: [], podcasts: [], photos: [], texts: [] });
  const [cat, setCat] = useState('music'); // Текущая категория
  const [curId, setCurId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgImage, setBgImage] = useState(DEF_IMG);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{show: boolean, content: string}>({ show: false, content: '' });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Загрузка данных при старте
  useEffect(() => {
    fetchMedia();
    fetchGH('photos');
    fetchGH('texts');
  }, []);

  const fetchMedia = async () => {
    try {
      const { data } = await sb.from('music').select('*').order('id');
      if (data) {
        const formatted = data.map(t => ({
          ...t,
          url: t.url || `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/tracks/${t.file}`,
          img: t.img || DEF_IMG
        }));
        setMedia(prev => ({ ...prev, music: formatted }));
      }
    } catch (e) { console.error(e); }
  };

  const fetchGH = async (type: 'photos' | 'texts') => {
    try {
      const res = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${type}`);
      const files = await res.json();
      if (Array.isArray(files)) {
        const items = files.map((f, i) => ({
          id: `${type}-${i}`,
          title: f.name.replace(/\.[^/.]+$/, ""),
          url: f.download_url,
          img: type === 'photos' ? f.download_url : DEF_IMG
        }));
        setMedia(prev => ({ ...prev, [type]: items }));
      }
    } catch (e) { console.error(e); }
  };

  const updateMetadata = (t: any) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: 'Evgen Music',
        artwork: [{ src: t.img || DEF_IMG, sizes: '512x512', type: 'image/jpeg' }]
      });
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
    }
  };

  const playTrack = (t: any) => {
    if (curId === t.id) {
      togglePlay();
    } else {
      setCurId(t.id);
      if (audioRef.current) {
        audioRef.current.src = t.url;
        audioRef.current.play();
        setIsPlaying(true);
        setBgImage(t.img);
        updateMetadata(t);
      }
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
      setIsPlaying(!audioRef.current.paused);
    }
  };

  const handleNextTrack = () => {
    const list = media.music;
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx < list.length - 1) playTrack(list[idx + 1]);
  };

  const handlePrevTrack = () => {
    const list = media.music;
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx > 0) playTrack(list[idx - 1]);
  };

  const share = async () => {
    const t = media.music.find((x: any) => x.id === curId);
    if (t && navigator.share) try { await navigator.share({ title: t.title, url: t.url }); } catch(e) {}
  };

  const download = () => {
    const t = media.music.find((x: any) => x.id === curId);
    if (!t) return;
    const a = document.createElement('a');
    a.href = t.url;
    a.download = `${t.title}.mp3`;
    a.click();
  };

  const openText = async (t: any) => {
    const res = await fetch(t.url);
    const txt = await res.text();
    setModal({ show: true, content: txt });
  };

  const currentTrack = media.music.find((x: any) => x.id === curId);
  const displayItems = (media as any)[cat] || [];

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <input 
        className="search-box"
        type="text" 
        placeholder="Поиск..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="category-grid">
        <div className={`cat-card ${cat==='music'?'active':''}`} onClick={()=>setCat('music')}>🎵<span>Музыка</span></div>
        <div className={`cat-card ${cat==='podcasts'?'active':''}`} onClick={()=>setCat('podcasts')}>🎙️<span>Подкасты</span></div>
        <div className={`cat-card ${cat==='photos'?'active':''}`} onClick={()=>setCat('photos')}>📷<span>Фото</span></div>
        <div className={`cat-card ${cat==='texts'?'active':''}`} onClick={()=>setCat('texts')}>📝<span>Тексты</span></div>
      </div>

      <div className={`content-grid ${cat==='photos'?'photo-layout':''}`}>
        {displayItems.filter((t: any) => t.title.toLowerCase().includes(search.toLowerCase())).map((t: any) => (
          cat === 'photos' ? (
            <img key={t.id} src={t.img} className="photo-thumb" onClick={() => setBgImage(t.img)} />
          ) : (
            <div key={t.id} className={`media-item ${curId === t.id ? 'active' : ''}`} onClick={() => cat === 'texts' ? openText(t) : playTrack(t)}>
              <img className="media-img" src={t.img} alt="" />
              <div className="media-info">
                <div className="media-name">{t.title}</div>
                <div className="media-meta">{cat === 'music' ? 'Трек' : cat === 'podcasts' ? 'Эпизод' : 'Текст'}</div>
              </div>
              {curId === t.id && isPlaying && cat !== 'texts' && <div className="playing-icon">🔊</div>}
            </div>
          )
        ))}
      </div>

      {currentTrack && (
        <div className="player-panel">
          <div id="now-playing">{currentTrack.title}</div>
          <div className="progress-area" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
          }}>
            <div id="progress-fill" style={{ width: `${(currentTime/duration)*100}%` }}></div>
          </div>
          <div className="time-info">
            <span>{Math.floor(currentTime/60)}:{String(Math.floor(currentTime%60)).padStart(2,'0')}</span>
            <span>{Math.floor(duration/60)}:{String(Math.floor(duration%60)).padStart(2,'0')}</span>
          </div>
          <div className="controls-row">
            <button className="ctrl-btn" onClick={handlePrevTrack}>⏮</button>
            <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="ctrl-btn" onClick={handleNextTrack}>⏭</button>
            <button className="ctrl-btn" onClick={share}>📤</button>
            <button className="ctrl-btn" onClick={download}>⬇️</button>
          </div>
        </div>
      )}

      {modal.show && (
        <div id="modal" style={{display:'flex'}} onClick={()=>setModal({show:false, content:''})}>
          <div id="modal-content" onClick={e=>e.stopPropagation()}>{modal.content}</div>
        </div>
      )}

      <audio 
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleNextTrack}
      />

      <nav className="bottom-nav">
        <div className="nav-item active">🏠<span>Главная</span></div>
        <div className="nav-item">⭐️<span>Избранное</span></div>
        <div className="nav-item">⚙️<span>Настройки</span></div>
      </nav>
    </div>
  );
}
