import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

const sb = createClient(S_URL, S_KEY);

export default function App() {
  const [media, setMedia] = useState({ music: [], podcasts: [], photos: [], texts: [] });
  const [activeTab, setActiveTab] = useState('music'); 
  const [curId, setCurId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgImage, setBgImage] = useState(DEF_IMG);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ show: false, content: '' });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    // 1. Музыка и подкасты из Supabase
    try {
      const { data, error } = await sb.from('music').select('*').order('id');
      if (error) throw error;
      if (data) {
        const formatted = data.map(t => ({
          ...t,
          url: t.url || `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/tracks/${t.file}`,
          img: t.img || DEF_IMG
        }));
        setMedia(prev => ({ ...prev, music: formatted }));
      }
    } catch (e: any) { alert("Ошибка Supabase: " + e.message); }

    // 2. Фото и Тексты из GitHub
    fetchGH('photos');
    fetchGH('texts');
  };

  const fetchGH = async (type: 'photos' | 'texts') => {
    try {
      const res = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${type}`, {
        headers: { Authorization: `token ${G_TOKEN}` }
      });
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
    } catch (e) { console.error("Ошибка GitHub " + type, e); }
  };

  const playTrack = (t: any) => {
    if (curId === t.id) {
      togglePlay();
    } else {
      setCurId(t.id);
      if (audioRef.current) {
        audioRef.current.src = t.url;
        audioRef.current.play().catch(e => alert("Ошибка воспроизведения: " + e.message));
        setIsPlaying(true);
        setBgImage(t.img);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: t.title,
            artist: 'Evgen Music',
            artwork: [{ src: t.img }]
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

  const share = async () => {
    const t = media.music.find((x: any) => x.id === curId);
    if (t && navigator.share) await navigator.share({ title: t.title, url: t.url });
  };

  const download = () => {
    const t = media.music.find((x: any) => x.id === curId);
    if (t) window.open(t.url, '_blank');
  };

  const openText = async (t: any) => {
    try {
      const res = await fetch(t.url);
      const txt = await res.text();
      setModal({ show: true, content: txt });
    } catch (e) { alert("Не удалось загрузить текст"); }
  };

  const currentTrack = media.music.find((x: any) => x.id === curId);
  const displayItems = (media as any)[activeTab] || [];

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <input 
        className="search-box"
        placeholder="Поиск..." 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className={`content-grid ${activeTab === 'photos' ? 'photo-layout' : ''}`}>
        {displayItems.filter((t: any) => t.title.toLowerCase().includes(search.toLowerCase())).map((t: any) => (
          activeTab === 'photos' ? (
            <img key={t.id} src={t.img} className="photo-thumb" onClick={() => setBgImage(t.img)} alt="" />
          ) : (
            <div key={t.id} className={`media-item ${curId === t.id ? 'active' : ''}`} 
                 onClick={() => activeTab === 'texts' ? openText(t) : playTrack(t)}>
              <img className="media-img" src={t.img} alt="" />
              <div className="media-info">
                <div className="media-name">{t.title}</div>
                <div className="media-meta">{activeTab === 'music' ? 'Трек' : 'Файл'}</div>
              </div>
              <div className="item-btns">
                {curId === t.id && isPlaying ? '🔊' : '▶'}
              </div>
            </div>
          )
        ))}
        {displayItems.length === 0 && <div style={{textAlign:'center', opacity:0.5, marginTop: 20}}>Тут пока пусто...</div>}
      </div>

      {currentTrack && (
        <div className="player-panel">
          <div id="now-playing" onClick={() => setBgImage(currentTrack.img)}>{currentTrack.title}</div>
          <div className="progress-area" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
          }}>
            <div id="progress-fill" style={{ width: `${(currentTime/duration)*100}%` }}></div>
          </div>
          <div className="controls-row">
            <button className="ctrl-btn" onClick={() => {
              const idx = media.music.findIndex((x:any)=>x.id===curId);
              if(idx > 0) playTrack(media.music[idx-1]);
            }}>⏮</button>
            <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="ctrl-btn" onClick={() => {
              const idx = media.music.findIndex((x:any)=>x.id===curId);
              if(idx < media.music.length-1) playTrack(media.music[idx+1]);
            }}>⏭</button>
            <button className="ctrl-btn" onClick={share}>📤</button>
            <button className="ctrl-btn" onClick={download}>⬇️</button>
          </div>
        </div>
      )}

      {modal.show && (
        <div id="modal" style={{display:'flex'}} onClick={() => setModal({show:false, content:''})}>
          <div id="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{textAlign:'right', marginBottom:10, cursor:'pointer'}} onClick={()=>setModal({show:false,content:''})}>❌</div>
            {modal.content}
          </div>
        </div>
      )}

      <audio 
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => {
          const idx = media.music.findIndex((x:any)=>x.id===curId);
          if(idx < media.music.length-1) playTrack(media.music[idx+1]);
        }}
      />

      <nav className="bottom-nav">
        <div className={`nav-item ${activeTab==='music'?'active':''}`} onClick={()=>setActiveTab('music')}>🏠<span>Музыка</span></div>
        <div className={`nav-item ${activeTab==='podcasts'?'active':''}`} onClick={()=>setActiveTab('podcasts')}>🎙️<span>Подкасты</span></div>
        <div className={`nav-item ${activeTab==='photos'?'active':''}`} onClick={()=>setActiveTab('photos')}>📷<span>Фото</span></div>
        <div className={`nav-item ${activeTab==='texts'?'active':''}`} onClick={()=>setActiveTab('texts')}>📝<span>Тексты</span></div>
      </nav>
    </div>
  );
}
