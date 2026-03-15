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
  const [curId, setCurId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgImage, setBgImage] = useState(DEF_IMG);
  const [search, setSearch] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Загрузка данных при старте
  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      // Тянем музыку из Supabase
      const { data, error } = await sb.from('music').select('*').order('id');
      if (data) {
        const formatted = data.map(t => ({
          ...t,
          url: t.url || `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/tracks/${t.file}`,
          img: t.img || DEF_IMG
        }));
        setMedia(prev => ({ ...prev, music: formatted }));
      }
    } catch (e) { console.error("Ошибка загрузки:", e); }
  };

  // Настройка управления в шторке уведомлений
  const updateMetadata = (t: any) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist || 'Evgen Music',
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
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleNextTrack = () => {
    const idx = media.music.findIndex((x: any) => x.id === curId);
    if (idx < media.music.length - 1) playTrack(media.music[idx + 1]);
  };

  const handlePrevTrack = () => {
    const idx = media.music.findIndex((x: any) => x.id === curId);
    if (idx > 0) playTrack(media.music[idx - 1]);
  };

  const share = async () => {
    const t = media.music.find((x: any) => x.id === curId);
    if (t && navigator.share) {
      try { await navigator.share({ title: t.title, url: t.url }); } catch(e) {}
    } else {
      alert("Ссылка скопирована!"); // Заглушка
    }
  };

  const download = () => {
    const t = media.music.find((x: any) => x.id === curId);
    if (!t) return;
    const a = document.createElement('a');
    a.href = t.url;
    a.download = `${t.title}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const currentTrack = media.music.find((x: any) => x.id === curId);

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <div className="search-box">
        <input 
          type="text" 
          placeholder="Поиск музыки..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="track-list">
        {media.music.filter((t: any) => t.title.toLowerCase().includes(search.toLowerCase())).map((t: any) => (
          <div key={t.id} className={`track-card ${curId === t.id ? 'active' : ''}`} onClick={() => playTrack(t)}>
            <img src={t.img} alt={t.title} />
            <div className="track-info">
              <div className="track-name">{t.title}</div>
              <div className="track-artist">{t.artist || 'Evgen Music'}</div>
            </div>
            <button className="card-play-btn">{curId === t.id && isPlaying ? '⏸' : '▶'}</button>
          </div>
        ))}
      </div>

      {currentTrack && (
        <div className="bottom-player">
          <div className="progress-container" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (audioRef.current) audioRef.current.currentTime = pos * duration;
          }}>
            <div className="progress-bar" style={{ width: `${(currentTime/duration)*100}%` }}></div>
          </div>
          
          <div className="controls-row">
            <button className="ctrl-btn" onClick={handlePrevTrack}>⏮</button>
            <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="ctrl-btn" onClick={handleNextTrack}>⏭</button>
          </div>
          
          <div className="extra-controls">
            <button onClick={share}>📤</button>
            <button onClick={download}>⬇️</button>
          </div>
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
        <div className="nav-item">🎙️<span>Подкасты</span></div>
        <div className="nav-item">👤<span>Профиль</span></div>
      </nav>
    </div>
  );
              }
