import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App as CapApp } from '@capacitor/app';

// Константы из твоего index.html
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
    initApp();
    // Слушатель для фона
    const stateSub = CapApp.addListener('appStateChange', ({ isActive }) => {
      console.log('App active:', isActive);
    });
    return () => { stateSub.remove(); };
  }, []);

  const initApp = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(p => fetchGH(p)));
    
    const newMedia: any = {
      music: results[0].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Evgen', lyrics: '' })),
      podcasts: results[1].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Podcast' })),
      photos: results[2].filter((f:any)=>/\.(jpg|png|webp|jpeg)$/i.test(f.name)).map((f:any)=>({ url: f.download_url, img: f.download_url, title: f.name })),
      texts: results[3].filter((f:any)=>f.name.endsWith('.txt')).map((f:any)=>({ title: f.name.replace('.txt',''), url: f.download_url }))
    };

    // Грузим лайки и обложки из 'likes'
    try {
      const { data } = await sb.from('likes').select('*');
      if (data) {
        data.forEach(r => {
          const t = [...newMedia.music, ...newMedia.podcasts].find((x: any) => x.id === r.song_id);
          if (t) {
            if (r.artist) t.artist = r.artist;
            if (r.lyrics) t.lyrics = r.lyrics;
            if (r.cover_data) t.img = r.cover_data;
          }
        });
      }
    } catch (e) {}
    setMedia(newMedia);
  };

  const fetchGH = async (p: string) => {
    const r = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, {
      headers: { 'Authorization': `token ${G_TOKEN}` }
    });
    return r.ok ? await r.json() : [];
  };

  const updateMediaMetadata = (t: any) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
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
    }
  };

  const handleNextTrack = () => {
    const list = activeTab === 'podcasts' ? media.podcasts : media.music;
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx < list.length - 1) playTrack(list[idx + 1]);
  };

  const handlePrevTrack = () => {
    const list = activeTab === 'podcasts' ? media.podcasts : media.music;
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx > 0) playTrack(list[idx - 1]);
  };

  const handleShare = async () => {
    const t = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);
    if (t) await Share.share({ title: t.title, text: `Слушаю ${t.title} в Evgen Music`, url: t.url });
  };

  const handleDownload = async () => {
    const t = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);
    if (!t) return;
    try {
      await Filesystem.downloadFile({
        url: t.url,
        path: `Download/${t.title}.mp3`,
        directory: Directory.ExternalStorage
      });
      alert("Сохранено в загрузки!");
    } catch (e) { alert("Ошибка скачивания"); }
  };

  const openText = async (item: any) => {
    const r = await fetch(item.url);
    const b = await r.arrayBuffer();
    let txt = new TextDecoder('utf-8').decode(b);
    if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(b);
    setModal({ show: true, content: txt });
  };

  const currentTrack = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);
  const displayItems = (media as any)[activeTab] || [];

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <input className="search-box" placeholder="Поиск..." value={search} onChange={(e)=>setSearch(e.target.value)} />

      <div className="category-grid">
        {['music', 'podcasts', 'photos', 'texts'].map(cat => (
          <div key={cat} className={`cat-card ${activeTab === cat ? 'active' : ''}`} onClick={() => setActiveTab(cat)}>
            <span>{cat.toUpperCase()}</span>
          </div>
        ))}
      </div>

      <div className={`content-grid ${activeTab === 'photos' ? 'photo-layout' : ''}`}>
        {displayItems.filter((i:any)=>i.title?.toLowerCase().includes(search.toLowerCase())).map((item: any) => (
          <div key={item.id || item.url} className={`media-item ${curId === item.id ? 'active' : ''}`} onClick={() => {
            if (activeTab === 'texts') openText(item);
            else if (activeTab === 'photos') setBgImage(item.url);
            else playTrack(item);
          }}>
            <img className="media-img" src={item.img || item.url || DEF_IMG} alt="" />
            <div className="media-info">
              <div className="media-name">{item.title}</div>
            </div>
          </div>
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
            <div id="progress-fill" style={{ width: `${(currentTime/duration)*100}%` }}></div>
          </div>
          <div className="controls-row">
            <button className="ctrl-btn" onClick={handleShare}>🔗</button>
            <button className="ctrl-btn" onClick={handlePrevTrack}>⏮</button>
            <button className="play-btn" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="ctrl-btn" onClick={handleNextTrack}>⏭</button>
            <button className="ctrl-btn" onClick={handleDownload}>⬇️</button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <div className={`nav-item ${activeTab==='music'?'active':''}`} onClick={() => setActiveTab('music')}>🏠<span>Главная</span></div>
        <div className={`nav-item ${activeTab==='photos'?'active':''}`} onClick={() => setActiveTab('photos')}>📷<span>Медиа</span></div>
        <div className={`nav-item ${activeTab==='texts'?'active':''}`} onClick={() => setActiveTab('texts')}>📝<span>Тексты</span></div>
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
