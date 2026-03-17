import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

let sb: any = null;
try { sb = createClient(S_URL, S_KEY); } catch (e) {}

export default function App() {
  const [media, setMedia] = useState({ music: [], podcasts: [], photos: [], texts: [] });
  const [currentTab, setCurrentTab] = useState('home');
  const [currentCategory, setCurrentCategory] = useState('music');
  const [curId, setCurId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [modal, setModal] = useState({ show: false, content: '', type: 'text' });
  const [myOrder, setMyOrder] = useState(JSON.parse(localStorage.getItem('my_order') || '[]'));
  
  const audioRef = useRef(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts'];
    const results = await Promise.all(paths.map(p => 
      fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${p}`, { headers: { 'Authorization': `token ${G_TOKEN}` } })
      .then(r => r.json()).catch(() => [])
    ));
    
    const mapTrack = (f) => ({
      id: f.name.replace('.mp3', ''), title: decodeURIComponent(f.name.replace('.mp3', '')),
      url: f.download_url, img: DEF_IMG, likes: 0, lyrics: ''
    });

    const newMedia = {
      music: results[0].filter(f => f.name?.endsWith('.mp3')).map(mapTrack).reverse(),
      podcasts: results[1].filter(f => f.name?.endsWith('.mp3')).map(mapTrack).reverse(),
      photos: results[2].filter(f => /\.(jpg|png|webp|jpeg)$/i.test(f.name)).map(f => ({ url: f.download_url })),
      texts: results[3].filter(f => f.name?.endsWith('.txt')).map(f => ({ title: f.name.replace('.txt', ''), url: f.download_url }))
    };

    if (sb) {
      const { data } = await sb.from('likes').select('*');
      data?.forEach(r => {
        const t = [...newMedia.music, ...newMedia.podcasts].find(x => x.id === r.song_id);
        if (t) { t.likes = r.count || 0; if (r.cover_data) t.img = r.cover_data; t.lyrics = r.lyrics || ''; }
      });
    }
    setMedia(newMedia);
  };

  const handleSort = () => {
    const _order = [...myOrder];
    const draggedItemContent = _order.splice(dragItem.current, 1)[0];
    _order.splice(dragOverItem.current, 0, draggedItemContent);
    setMyOrder(_order);
    localStorage.setItem('my_order', JSON.stringify(_order));
  };

  const play = (t) => {
    if (curId === t.id) {
      if (audioRef.current.paused) audioRef.current.play(); else audioRef.current.pause();
    } else {
      setCurId(t.id);
      audioRef.current.src = t.url;
      audioRef.current.play();
    }
    setIsPlaying(!audioRef.current.paused);
  };
    const download = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (!t) return;
    const r = await fetch(t.url); const b = await r.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = t.title + ".mp3"; a.click();
  };

  const share = () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
    if (navigator.share) navigator.share({ title: t?.title, url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); alert("Ссылка скопирована"); }
  };

  const showText = async (item) => {
    const r = await fetch(item.url); const txt = await r.text();
    setModal({ show: true, content: txt, type: 'text' });
  };

  const handleCategory = (c) => {
    if (c === 'podcasts' && prompt("Пароль?") !== "1285") return alert("Мимо!");
    setCurrentCategory(c);
  };

  const getList = () => {
    if (currentTab === 'my') {
      const favs = [...media.music, ...media.podcasts].filter(t => localStorage.getItem('fav_' + t.id));
      return favs.sort((a,b) => myOrder.indexOf(a.id) - myOrder.indexOf(b.id));
    }
    if (currentTab === 'home') return media.music.filter(t => t.likes > 0);
    return media[currentCategory] || [];
  };

  const filtered = getList().filter(i => (i.title || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const curTrack = [...media.music, ...media.podcasts].find(x => x.id === curId);

  return (
    <div className="app">
      <style>{`
        body { background: #020617; color: #fff; font-family: sans-serif; margin: 0; padding-bottom: 240px; }
        .player-panel { position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%); width: calc(100% - 30px); max-width: 500px; background: rgba(13,18,30,0.95); border: 1px solid var(--border); border-radius: 24px; padding: 15px; z-index: 1000; box-sizing: border-box; }
        .controls { display: flex; justify-content: space-between; align-items: center; }
        .ctrl-btn { background: none; border: none; fill: #94a3b8; padding: 5px; flex: 1; display: flex; justify-content: center; }
        .play-btn { width: 55px; height: 55px; background: #00f2ff; border-radius: 50%; fill: #000; border: none; display: flex; justify-content: center; align-items: center; }
        .progress-bar { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; margin: 10px 0; }
        .media-item { display: flex; align-items: center; background: rgba(255,255,255,0.05); margin: 5px; padding: 10px; border-radius: 12px; }
        .cat-btn { padding: 10px; background: rgba(255,255,255,0.08); border-radius: 8px; text-align: center; cursor: pointer; }
        .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
      `}</style>

      <div style={{textAlign:'center', color:'#00f2ff', padding:'20px', fontWeight:'bold'}}>EVGEN MUSIC</div>
      <input type="text" placeholder="Поиск..." className="search" style={{width:'90%', margin:'0 5%', padding:'10px', borderRadius:'20px', background:'#1e293b', border:'none', color:'#fff'}} onChange={e => setSearchQuery(e.target.value)} />

      {currentTab === 'catalog' && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'5px', padding:'10px'}}>
          {['music', 'podcasts', 'photos', 'texts'].map(c => <div key={c} className="cat-btn" onClick={() => handleCategory(c)}>{c}</div>)}
        </div>
      )}

      <div className="list">
        {filtered.map((item, idx) => (
          <div key={item.id || idx} className="media-item" 
               draggable={currentTab === 'my'}
               onDragStart={() => dragItem.current = idx}
               onDragEnter={() => dragOverItem.current = idx}
               onDragEnd={handleSort}
               onDragOver={e => e.preventDefault()}
               onClick={() => item.url.endsWith('.txt') ? showText(item) : play(item)}>
            <img src={item.img || item.url} style={{width:50, height:50, borderRadius:8, marginRight:10}} alt="" />
            <div style={{flex:1}}>{item.title || 'Photo'}</div>
            {item.likes !== undefined && <span>{localStorage.getItem('fav_'+item.id)?'⭐':''}</span>}
          </div>
        ))}
      </div>

      <div className="player-panel">
        <div style={{textAlign:'center', fontSize:'0.8rem', color:'#00f2ff', marginBottom:5}}>{curTrack?.title || 'Выбор трека'}</div>
        <div className="progress-bar" onClick={e => { audioRef.current.currentTime = (e.nativeEvent.offsetX / e.currentTarget.offsetWidth) * duration }}>
          <div style={{height:'100%', background:'#00f2ff', width: `${(currentTime/duration*100)||0}%`, borderRadius:3}}></div>
        </div>
        <div style={{display:'flex', justifyBetween:'space-between', fontSize:'0.7rem', color:'#64748b'}}>
            <span>{Math.floor(currentTime/60)}:{Math.floor(currentTime%60).toString().padStart(2,'0')}</span>
            <span style={{marginLeft:'auto'}}>{Math.floor(duration/60)}:{Math.floor(duration%60).toString().padStart(2,'0')}</span>
        </div>
        <div className="controls">
          <button className="ctrl-btn" onClick={share}><svg viewBox="0 0 24 24" width="24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg></button>
          <button className="ctrl-btn" onClick={() => {}}><svg viewBox="0 0 24 24" width="24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg></button>
          <button className="ctrl-btn" onClick={() => audioRef.current.currentTime -= 10}><svg viewBox="0 0 24 24" width="24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg></button>
          <button className="play-btn" onClick={() => play(curTrack)}><svg viewBox="0 0 24 24" width="30">{isPlaying ? <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/> : <path d="M8 5v14l11-7z"/>}</svg></button>
          <button className="ctrl-btn" onClick={() => audioRef.current.currentTime += 10}><svg viewBox="0 0 24 24" width="24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg></button>
          <button className="ctrl-btn" onClick={() => {}}><svg viewBox="0 0 24 24" width="24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
          <button className="ctrl-btn" onClick={download}><svg viewBox="0 0 24 24" width="24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg></button>
        </div>
      </div>

      <nav style={{position:'fixed', bottom:0, width:'100%', display:'flex', background:'#0a101f', height:75, borderTop:'1px solid #334155'}}>
        {['home', 'catalog', 'my'].map(t => <div key={t} onClick={() => setCurrentTab(t)} style={{flex:1, textAlign:'center', paddingTop:15, color:currentTab===t?'#00f2ff':'#64748b'}}>{t}</div>)}
      </nav>

      {modal.show && <div className="modal" onClick={() => setModal({show:false})}><div style={{background:'#1e293b', padding:20, borderRadius:15, maxHeight:'80%', overflow:'auto'}}>{modal.content}</div></div>}
      <audio ref={audioRef} onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)} onLoadedMetadata={() => setDuration(audioRef.current.duration)} />
    </div>
  );
      }
