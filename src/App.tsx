import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Константы из твоего проекта
const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

const sb = createClient(S_URL, S_KEY);

export default function App() {
  const [media, setMedia] = useState({ music: [], podcasts: [], photos: [], texts: [] });
  const [cat, setCat] = useState('music'); 
  const [curId, setCurId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgImage, setBgImage] = useState(DEF_IMG);
  const [search, setSearch] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
    } catch (e) { console.error("Ошибка Supabase:", e); }
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
    } catch (e) {}
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
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: t.title,
                artist: 'Evgen Music',
                artwork: [{ src: t.img, sizes: '512x512', type: 'image/jpeg' }]
            });
        }
      }
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause();
      setIsPlaying(!audioRef.current.paused);
    }
  };

  const handleNext = () => {
    const idx = media.music.findIndex((x: any) => x.id === curId);
    if (idx < media.music.length - 1) playTrack(media.music[idx + 1]);
  };

  const handlePrev = () => {
    const idx = media.music.findIndex((x: any) => x.id === curId);
    if (idx > 0) playTrack(media.music[idx - 1]);
  };

  const curTrack = media.music.find((x: any) => x.id === curId);
  const list = (media as any)[cat] || [];

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <input 
        className="search-box"
        type="text" 
        placeholder="Поиск музыки..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Категории как на скрине 1 */}
      <div className="category-grid">
        <div className={`cat-card ${cat==='music'?'active':''}`} onClick={()=>setCat('music')}>🎵 Музыка</div>
        <div className={`cat-card ${cat==='podcasts'?'active':''}`} onClick={()=>setCat('podcasts')}>🎙️ Подкасты</div>
        <div className={`cat-card ${cat==='photos'?'active':''}`} onClick={()=>setCat('photos')}>📷 Фото</div>
        <div className={`cat-card ${cat==='texts'?'active':''}`} onClick={()=>setCat('texts')}>📝 Тексты</div>
      </div>

      {/* Список треков как на сайте (скрин 2) */}
      <div className={`content-grid ${cat==='photos'?'photo-layout':''}`}>
        {list.filter((t:any) => t.title.toLowerCase().includes(search.toLowerCase())).map((t:any) => (
          cat === 'photos' ? (
            <img key={t.id} src={t.img} className="photo-thumb" onClick={() => setBgImage(t.img)} />
          ) : (
            <div key={t.id} className={`media-item ${curId === t.id ? 'active' : ''}`} onClick={() => playTrack(t)}>
              <img className="media-img" src={t.img} alt="" />
              <div className="media-info">
                <div className="media-name">{t.title}</div>
                <div className="media-meta">{t.artist || 'evgensmoke'} • {t.duration || '0:00'}</div>
              </div>
              <div className="item-btns">
                <span>🤍</span>
                <span>➕</span>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Плеер как на сайте */}
      {curTrack && (
        <div className="player-panel">
          <div id="now-playing">СЕЙЧАС ИГРАЕТ: {curTrack.title.toUpperCase()}</div>
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
             <button className="ctrl-btn" onClick={() => {}}>🔗</button>
             <button className="ctrl-btn" onClick={handlePrev}>⏮</button>
             <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
             <button className="ctrl-btn" onClick={handleNext}>⏭</button>
             <button className="ctrl-btn" onClick={() => {}}>⬇️</button>
          </div>
        </div>
      )}

      <audio 
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleNext}
      />

      {/* Нижняя навигация как на сайте */}
      <nav className="bottom-nav">
        <div className="nav-item active">🏠<span>Главная</span></div>
        <div className="nav-item">📋<span>Каталог</span></div>
        <div className="nav-item">❤️<span>Моё</span></div>
      </nav>
    </div>
  );
      }
