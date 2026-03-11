import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";

let sb: any = null;
try {
  sb = createClient(S_URL, S_KEY);
} catch (e) {}

type Track = {
  id: string;
  title: string;
  artist: string;
  url: string;
  img: string;
  duration: string;
  likes: number;
  lyrics: string;
  cat: string;
};

type Photo = { url: string };
type TextItem = { title: string; url: string };

export default function App() {
  const [media, setMedia] = useState<{ music: Track[]; podcasts: Track[]; photos: Photo[]; texts: TextItem[] }>({
    music: [], podcasts: [], photos: [], texts: []
  });
  const [currentTab, setCurrentTab] = useState<'home' | 'catalog' | 'my'>('home');
  const [currentCategory, setCurrentCategory] = useState<'music' | 'podcasts' | 'photos' | 'texts'>('music');
  const [curId, setCurId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [modalContent, setModalContent] = useState<string | null>(null);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [bgImage, setBgImage] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    init();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
    }
  });

  const fetchGH = async (p: string) => {
    const r = await fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, {
      headers: { 'Authorization': `token ${G_TOKEN}` }
    });
    return r.ok ? await r.json() : [];
  };

  const init = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(p => fetchGH(p)));
    
    const mapTrack = (f: any, cat: string): Track => ({
      id: f.name.replace('.mp3', ''),
      title: decodeURIComponent(f.name.replace('.mp3', '')),
      artist: 'Unknown',
      url: f.download_url,
      img: DEF_IMG,
      duration: '0:00',
      likes: 0,
      lyrics: '',
      cat: cat
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
            t.duration = r.duration || '0:00';
            t.artist = r.artist || 'Unknown';
            if (r.cover_data) t.img = r.cover_data;
            t.lyrics = r.lyrics || '';
          }
        });
      }
    }
    setMedia(newMedia);
  };

  const updateMediaMetadata = (t: Track) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        artwork: [{ src: t.img, sizes: '512x512', type: 'image/jpeg' }]
      });
    }
  };

  const scanFile = async (t: Track) => {
    try {
      const r = await fetch(t.url);
      const blob = await r.blob();
      // @ts-ignore
      window.jsmediatags.read(blob, {
        onSuccess: (tag: any) => {
          const tags = tag.tags;
          let up: any = { song_id: t.id, count: t.likes, duration: t.duration };
          let updated = false;
          
          if (tags.artist) { t.artist = tags.artist; up.artist = t.artist; updated = true; }
          if (tags.lyrics?.lyrics) { t.lyrics = tags.lyrics.lyrics; up.lyrics = t.lyrics; updated = true; }
          if (tags.picture) {
            const { data, format } = tags.picture;
            let b = "";
            for (let i = 0; i < data.length; i++) b += String.fromCharCode(data[i]);
            t.img = `data:${format};base64,${window.btoa(b)}`;
            up.cover_data = t.img;
            setBgImage(t.img);
            updateMediaMetadata(t);
            updated = true;
          }
          
          if (updated) {
            setMedia(prev => ({ ...prev }));
          }
          if (sb) sb.from('likes').upsert(up, { onConflict: 'song_id' }).then(() => setMedia(prev => ({ ...prev })));
        }
      });
    } catch (e) {}
  };

  const playTrack = (t: Track) => {
    if (curId === t.id) {
      togglePlay();
      return;
    }
    
    setCurId(t.id);
    if (audioRef.current) {
      audioRef.current.src = t.url;
      
      audioRef.current.onloadedmetadata = () => {
        if (audioRef.current) {
          t.duration = formatTime(audioRef.current.duration);
          updateMediaMetadata(t);
          scanFile(t);
        }
      };

      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      setBgImage(t.img);
      updateBtn(true);
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
        updateBtn(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
        updateBtn(false);
      }
    }
  };

  const updateBtn = (p: boolean) => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused';
  };

  const formatTime = (s: number) => {
    if (isNaN(s)) return "0:00";
    let m = Math.floor(s / 60);
    let sc = Math.floor(s % 60);
    return `${m}:${sc < 10 ? '0' : ''}${sc}`;
  };

  const seekByBar = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (e.nativeEvent.offsetX / e.currentTarget.offsetWidth) * audioRef.current.duration;
    }
  };

  const handleNextTrack = () => {
    let l = currentCategory === 'podcasts' ? media.podcasts : media.music;
    let i = l.findIndex(x => x.id === curId);
    if (i < l.length - 1) playTrack(l[i + 1]);
  };

  const handlePrevTrack = () => {
    let l = currentCategory === 'podcasts' ? media.podcasts : media.music;
    let i = l.findIndex(x => x.id === curId);
    if (i > 0) playTrack(l[i - 1]);
  };

  const toggleLike = async (id: string) => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === id);
    if (!t) return;
    
    if (localStorage.getItem('lk_' + id)) {
      t.likes--;
      localStorage.removeItem('lk_' + id);
    } else {
      t.likes++;
      localStorage.setItem('lk_' + id, '1');
    }
    setMedia({ ...media });
    if (sb) await sb.from('likes').upsert({ song_id: id, count: t.likes }, { onConflict: 'song_id' });
  };

  const toggleFav = (id: string) => {
    if (localStorage.getItem('fav_' + id)) {
      localStorage.removeItem('fav_' + id);
    } else {
      localStorage.setItem('fav_' + id, '1');
    }
    setMedia({ ...media });
  };

  const share = () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (navigator.share && t) {
      navigator.share({ title: t.title, url: window.location.href }).catch((err) => {
        console.log("Share canceled or failed:", err);
      });
    }
  };

  const download = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t) return;
    try {
      const r = await fetch(t.url);
      const b = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = t.title + ".mp3";
      a.click();
    } catch (e) {
      alert("Ошибка при скачивании");
    }
  };

  const openLyrics = () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (t) {
      setModalContent(t.lyrics || "Текст не найден.");
    }
  };

  const showText = async (u: string) => {
    try {
      const r = await fetch(u);
      const b = await r.arrayBuffer();
      let txt = new TextDecoder('utf-8').decode(b);
      if (txt.includes('\uFFFD')) txt = new TextDecoder('windows-1251').decode(b);
      setModalContent(txt);
    } catch (e) {
      setModalContent("Ошибка загрузки текста.");
    }
  };

  const handleSetCategory = (c: 'music' | 'podcasts' | 'photos' | 'texts') => {
    if (c === currentCategory) return;
    if (c === 'podcasts') {
      setPasswordPromptOpen(true);
      return;
    }
    setCurrentCategory(c);
  };

  const handleSetTab = (t: 'home' | 'catalog' | 'my') => {
    setCurrentTab(t);
    if (t === 'home') setCurrentCategory('music');
  };

  let list: any[] = [];
  if (currentTab === 'home') {
    list = media.music.filter(t => t.likes > 0);
  } else if (currentTab === 'my') {
    list = [...media.music, ...media.podcasts].filter(t => localStorage.getItem('fav_' + t.id));
  } else {
    list = media[currentCategory] || [];
  }

  if (searchQuery) {
    list = list.filter(i => (i.title || i.id || '').toLowerCase().includes(searchQuery.toLowerCase()));
  }

  const currentTrack = [...media.music, ...media.podcasts].find(x => x.id === curId);

  return (
    <>
      <div id="bg-layer" style={{ backgroundImage: bgImage ? `url(${bgImage})` : 'none' }}></div>
      
      <header>
        <div className="main-title">EVGEN MUSIC</div>
        <input 
          type="text" 
          className="search-box" 
          placeholder="Поиск..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </header>

      {currentTab === 'catalog' && (
        <div id="catalog-ui">
          <div className="category-grid">
            <div className={`cat-card ${currentCategory === 'music' ? 'active' : ''}`} onClick={() => handleSetCategory('music')}>Музыка</div>
            <div className={`cat-card ${currentCategory === 'podcasts' ? 'active' : ''}`} onClick={() => handleSetCategory('podcasts')}>Подкасты</div>
            <div className={`cat-card ${currentCategory === 'photos' ? 'active' : ''}`} onClick={() => handleSetCategory('photos')}>Фото</div>
            <div className={`cat-card ${currentCategory === 'texts' ? 'active' : ''}`} onClick={() => handleSetCategory('texts')}>Тексты</div>
          </div>
        </div>
      )}

      <div id="main-content" className={`content-grid ${currentCategory === 'photos' && currentTab === 'catalog' ? 'photo-layout' : ''}`}>
        {list.map((item, idx) => {
          if (currentCategory === 'photos' && currentTab === 'catalog') {
            return <img key={idx} src={item.url} className="photo-thumb" loading="lazy" onClick={() => window.open(item.url)} alt="" />;
          } else if (currentCategory === 'texts' && currentTab === 'catalog') {
            return (
              <div key={idx} className="media-item" onClick={() => showText(item.url)}>
                <div className="media-info"><div className="media-name">📄 {item.title}</div></div>
              </div>
            );
          } else {
            return (
              <div key={item.id} className={`media-item ${curId === item.id ? 'active' : ''}`} onClick={() => playTrack(item)}>
                <img src={item.img} className="media-img" onError={(e) => { (e.target as HTMLImageElement).src = DEF_IMG; }} alt="" />
                <div className="media-info">
                  {item.cat === 'podcasts' && <div className="dev-badge">В РАЗРАБОТКЕ</div>}
                  <div className="media-name">{item.title}</div>
                  <div className="media-meta">{item.artist} • {item.duration}</div>
                </div>
                <div className="item-btns">
                  <span onClick={(e) => { e.stopPropagation(); toggleLike(item.id); }}>
                    {localStorage.getItem('lk_' + item.id) ? '❤️' : '🤍'}
                  </span>
                  <span onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}>
                    {localStorage.getItem('fav_' + item.id) ? '⭐' : '➕'}
                  </span>
                </div>
              </div>
            );
          }
        })}
      </div>

      <div className="player-panel">
        <div id="now-playing" onClick={openLyrics}>{currentTrack ? currentTrack.title : 'ВЫБЕРИТЕ ТРЕК'}</div>
        <div className="progress-area" onClick={seekByBar}>
          <div id="progress-fill" style={{ width: `${(currentTime / duration * 100) || 0}%` }}></div>
        </div>
        <div className="time-info">
          <span id="cur-time">{formatTime(currentTime)}</span>
          <span id="dur-time">{duration ? formatTime(duration) : '0:00'}</span>
        </div>
        <div className="controls-row">
          <button className="ctrl-btn" onClick={share}>
            <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
          </button>
          <button className="ctrl-btn" onClick={() => { if (audioRef.current) audioRef.current.currentTime -= 10; }}>
            <svg viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
          </button>
          <button className="ctrl-btn" onClick={handlePrevTrack}>
            <svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
          </button>
          <button className="play-btn" onClick={togglePlay}>
            <svg id="p-icon" viewBox="0 0 24 24" width="30" height="30">
              {isPlaying ? (
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              ) : (
                <path d="M8 5v14l11-7z"/>
              )}
            </svg>
          </button>
          <button className="ctrl-btn" onClick={handleNextTrack}>
            <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
          </button>
          <button className="ctrl-btn" onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10; }}>
            <svg viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
          </button>
          <button className="ctrl-btn" onClick={download}>
            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
        </div>
      </div>

      <nav className="bottom-nav">
        <div className={`nav-item ${currentTab === 'home' ? 'active' : ''}`} onClick={() => handleSetTab('home')}>
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span>Главная</span>
        </div>
        <div className={`nav-item ${currentTab === 'catalog' ? 'active' : ''}`} onClick={() => handleSetTab('catalog')}>
          <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          <span>Каталог</span>
        </div>
        <div className={`nav-item ${currentTab === 'my' ? 'active' : ''}`} onClick={() => handleSetTab('my')}>
          <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          <span>Моё</span>
        </div>
      </nav>

      {modalContent && (
        <div id="modal" style={{ display: 'flex' }} onClick={() => setModalContent(null)}>
          <div id="modal-content" onClick={(e) => e.stopPropagation()}>
            {modalContent}
          </div>
        </div>
      )}

      {passwordPromptOpen && (
        <div id="modal" style={{ display: 'flex' }} onClick={() => setPasswordPromptOpen(false)}>
          <div id="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '15px', color: 'var(--neon)', fontSize: '1.2rem', fontFamily: 'Orbitron, sans-serif' }}>Пароль:</div>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)}
              style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--glass)', color: '#fff', marginBottom: '15px', width: '100%', textAlign: 'center', fontSize: '1.2rem' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button 
                onClick={() => {
                  if (passwordInput === '1285') {
                    setCurrentCategory('podcasts');
                    setPasswordPromptOpen(false);
                    setPasswordInput('');
                  } else {
                    setModalContent("Мимо!");
                    setPasswordPromptOpen(false);
                    setPasswordInput('');
                  }
                }}
                style={{ padding: '10px 20px', background: 'var(--neon)', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}
              >
                Войти
              </button>
            </div>
          </div>
        </div>
      )}

      <audio 
        ref={audioRef} 
        crossOrigin="anonymous" 
        onEnded={handleNextTrack}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.duration) {
              setDuration(audioRef.current.duration);
            }
          }
        }}
      />
    </>
  );
}
