import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
// Если еще не ставил, выполни: npm install @capacitor-community/media-session
import { MediaSession } from '@capacitor-community/media-session'; 

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
  const [updater, setUpdater] = useState(0); 
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { initApp(); }, []);

  // Инициализация Нативной Шторки через Capacitor
  useEffect(() => {
    const setupMediaSession = async () => {
      const track = [...media.music, ...media.podcasts].find(x => x.id === curId);
      if (!track) return;

      try {
        await MediaSession.setMetadata({
          title: track.title,
          artist: track.artist || 'Evgen Music',
          album: 'EVGEN MUSIC APP',
          artwork: track.img || DEF_IMG
        });

        await MediaSession.setPlaybackState({
          playbackState: isPlaying ? 'playing' : 'paused',
          position: currentTime,
          playbackRate: 1.0
        });

        MediaSession.addListener('play', () => { audioRef.current?.play(); });
        MediaSession.addListener('pause', () => { audioRef.current?.pause(); });
        MediaSession.addListener('next', () => { handleNextTrack(); });
        MediaSession.addListener('previous', () => { handlePrevTrack(); });
      } catch (e) {
        console.log("Плагин MediaSession не установлен или ошибка", e);
      }
      
      // На всякий случай оставляем и веб-версию
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title, artist: track.artist || 'Evgen Music', artwork: [{ src: track.img || DEF_IMG, sizes: '512x512', type: 'image/jpeg' }]
        });
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play());
        navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
        navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
        navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
      }
    };
    setupMediaSession();
  }, [curId, isPlaying, media]);

  const initApp = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(p => fetchGH(p)));
    
    let newMedia: any = {
      music: results[0].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Evgensmoke', likes: 0, lyrics: '', duration: '0:00' })).reverse(),
      podcasts: results[1].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, artist: 'Podcast', likes: 0, duration: '0:00' })).reverse(),
      photos: results[2].filter((f:any)=>/\.(jpg|png|webp|jpeg)$/i.test(f.name)).map((f:any)=>({ url: f.download_url, img: f.download_url, title: f.name })).reverse(),
      texts: results[3].filter((f:any)=>f.name.endsWith('.txt')).map((f:any)=>({ title: f.name.replace('.txt',''), url: f.download_url })).reverse()
    };

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
            if (r.cover_data) { t.img = r.cover_data; }
          }
        });
      }
    } catch (e) {}
    setMedia(newMedia);
  };

  const fetchGH = async (p: string) => {
    const r = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, { headers: { 'Authorization': `token ${G_TOKEN}` } });
    return r.ok ? await r.json() : [];
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

  const playTrack = (t: any) => {
    if (curId === t.id) {
      isPlaying ? audioRef.current?.pause() : audioRef.current?.play();
    } else {
      setCurId(t.id);
      setBgImage(t.img || DEF_IMG);
      if (audioRef.current) {
        audioRef.current.src = t.url;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const getPlaylist = () => {
    if (activeTab === 'home') return media.music.filter((t:any) => t.likes > 0);
    if (activeTab === 'my') return [...media.music, ...media.podcasts].filter((t:any) => localStorage.getItem('fav_' + t.id));
    return media[activeCat] || [];
  };

  const handleNextTrack = () => {
    const list = getPlaylist().filter(x => x.id);
    const idx = list.findIndex(x => x.id === curId);
    if (idx < list.length - 1) playTrack(list[idx + 1]);
  };

  const handlePrevTrack = () => {
    const list = getPlaylist().filter(x => x.id);
    const idx = list.findIndex(x => x.id === curId);
    if (idx > 0) playTrack(list[idx - 1]);
  };

  const handleSeek = (seconds: number) => {
    if (audioRef.current) audioRef.current.currentTime += seconds;
  };

  // --- ПОЧИНЕННЫЙ ШАРИНГ ЧЕРЕЗ CAPACITOR ---
  const handleShare = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t) return;
    try {
      await Share.share({
        title: t.title,
        text: `Слушай трек: ${t.title} в Evgen Music!`,
        url: t.url,
      });
    } catch (e) {
      console.log('Ошибка шаринга (или юзер отменил):', e);
    }
  };

  // --- ПОЧИНЕННОЕ СКАЧИВАНИЕ ЧЕРЕЗ CAPACITOR ---
  const handleDownload = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t) return;
    
    if (window.confirm(`Сохранить трек: ${t.title}?`)) {
      try {
        await Filesystem.downloadFile({
          url: t.url,
          path: `Download/${t.title}.mp3`,
          directory: Directory.ExternalStorage
        });
        alert(`Трек успешно сохранен в папку "Загрузки"!`);
      } catch (e) {
        alert("Ошибка скачивания. Проверь разрешения приложения на доступ к файлам.");
        console.error("Download Error:", e);
      }
    }
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return "0:00";
    let m = Math.floor(s / 60), sc = Math.floor(s % 60);
    return `${m}:${sc < 10 ? '0' : ''}${sc}`;
  };

  const currentTrack = [...media.music, ...media.podcasts].find(x => x.id === curId);
  const displayItems = getPlaylist().filter((i:any) => (i.title || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="app-container">
      <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
      <h1 className="main-title">EVGEN MUSIC</h1>
      
      <input className="search-box" placeholder="Поиск..." value={search} onChange={(e)=>setSearch(e.target.value)} />

      {activeTab === 'catalog' && (
        <div className="category-grid">
          <div className={`cat-card ${activeCat === 'music' ? 'active' : ''}`} onClick={() => setActiveCat('music')}>Музыка</div>
          <div className={`cat-card ${activeCat === 'podcasts' ? 'active' : ''}`} onClick={() => {
             if (prompt("Пароль доступа:") === '1285') setActiveCat('podcasts'); else alert("Доступ закрыт!");
          }}>Подкасты</div>
          <div className={`cat-card ${activeCat === 'photos' ? 'active' : ''}`} onClick={() => setActiveCat('photos')}>Фото</div>
          <div className={`cat-card ${activeCat === 'texts' ? 'active' : ''}`} onClick={() => setActiveCat('texts')}>Тексты</div>
        </div>
      )}

      <div className={`content-grid ${(activeTab==='catalog'&&activeCat==='photos')?'photo-layout':''}`}>
        {displayItems.map((item: any) => (
          (activeTab === 'catalog' && activeCat === 'photos') ? (
            <img key={item.url} src={item.url} className="photo-thumb" onClick={() => window.open(item.url)} />
          ) : (activeTab === 'catalog' && activeCat === 'texts') ? (
            <div key={item.url} className="media-item" onClick={async () => {
              const r = await fetch(item.url); const b = await r.arrayBuffer();
              let txt = new TextDecoder('utf-8').decode(b);
              if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(b);
              setModal({ show: true, content: txt });
            }}><div className="media-info">📄 {item.title}</div></div>
          ) : (
            <div key={item.id} className={`media-item ${curId === item.id ? 'active' : ''}`} onClick={() => playTrack(item)}>
              <img className="media-img" src={item.img || DEF_IMG} onError={(e: any) => { e.target.src = DEF_IMG; }} />
              <div className="media-info">
                {item.id.includes('podcast') && <div className="dev-badge">В РАЗРАБОТКЕ</div>}
                <div className="media-name">{item.title}</div>
                <div className="media-meta">{item.artist} • {item.duration || '0:00'}</div>
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
          <div className="time-info">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="controls-row">
            <button className="ctrl-btn" onClick={handleShare}>
              <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
            </button>
            <button className="ctrl-btn" onClick={() => handleSeek(-10)}>
              <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
            </button>
            <button className="ctrl-btn" onClick={handlePrevTrack}>
              <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button className="play-btn" onClick={() => playTrack(currentTrack)}>
              <svg viewBox="0 0 24 24" width="30" height="30">
                {isPlaying ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/> : <path d="M8 5v14l11-7z"/>}
              </svg>
            </button>
            <button className="ctrl-btn" onClick={handleNextTrack}>
              <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
            <button className="ctrl-btn" onClick={() => handleSeek(10)}>
              <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
            </button>
            <button className="ctrl-btn" onClick={handleDownload}>
              <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <div className={`nav-item ${activeTab==='home'?'active':''}`} onClick={() => setActiveTab('home')}>
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg><span>Главная</span>
        </div>
        <div className={`nav-item ${activeTab==='catalog'?'active':''}`} onClick={() => setActiveTab('catalog')}>
          <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg><span>Каталог</span>
        </div>
        <div className={`nav-item ${activeTab==='my'?'active':''}`} onClick={() => setActiveTab('my')}>
          <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg><span>Моё</span>
        </div>
      </nav>

      {modal.show && <div id="modal" style={{display:'flex'}} onClick={()=>setModal({show:false,content:''})}><div id="modal-content" onClick={e=>e.stopPropagation()}>{modal.content}</div></div>}

      <audio ref={audioRef} 
        onPlay={() => setIsPlaying(true)} 
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} 
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleNextTrack}
      />
    </div>
  );
}
