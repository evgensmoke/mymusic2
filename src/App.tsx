import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

const sb = createClient(S_URL, S_KEY);

const ICONS = {
    share: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>,
    prev10: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>,
    prev: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>,
    play: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>,
    pause: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
    next: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>,
    next10: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>,
    save: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>,
    home: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>,
    cat: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>,
    fav: <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
};

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
    const [modal, setModal] = useState({ show: false, content: '', type: 'text' });
    const [updater, setUpdater] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => { initApp(); }, []);

    const initApp = async () => {
        const paths = ['music', 'podcasts', 'photos', 'texts'];
        const results = await Promise.all(paths.map(p => fetchGH(p)));
        let newMedia: any = {
            music: results[0].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, likes: 0, lyrics: '' })).reverse(),
            podcasts: results[1].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, likes: 0 })).reverse(),
            photos: results[2].filter((f:any)=>/\.(jpg|png|webp|jpeg)$/i.test(f.name)).map((f:any)=>({ url: f.download_url, title: f.name })).reverse(),
            texts: results[3].filter((f:any)=>f.name.endsWith('.txt')).map((f:any)=>({ title: f.name.replace('.txt',''), url: f.download_url }))
        };
        const { data } = await sb.from('likes').select('*');
        if (data) data.forEach(r => {
            const t = [...newMedia.music, ...newMedia.podcasts].find((x: any) => x.id === r.song_id);
            if (t) { t.likes = r.count || 0; t.lyrics = r.lyrics || ''; t.img = r.cover_data || DEF_IMG; }
        });
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
            setCurId(t.id); setBgImage(t.img || DEF_IMG);
            if (audioRef.current) { audioRef.current.src = t.url; audioRef.current.play().catch(()=>{}); }
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

    const handleShare = () => {
        const t = [...media.music, ...media.podcasts].find(x => x.id === curId);
        if (navigator.share) navigator.share({ title: t?.title, url: window.location.href }).catch(()=>{});
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
        } catch(e) { alert("Ошибка при скачивании"); }
    };

    const openText = async (item: any) => {
        try {
            const r = await fetch(item.url);
            const b = await r.arrayBuffer();
            // Сначала пробуем UTF-8, если есть битые символы () - пробуем windows-1251
            let txt = new TextDecoder('utf-8').decode(b);
            if (txt.includes('')) {
                txt = new TextDecoder('windows-1251').decode(b);
            }
            setModal({ show: true, content: txt, type: 'text' });
        } catch (e) { alert("Ошибка загрузки текста"); }
    };

    const getPlaylist = () => {
        if (activeTab === 'home') return media.music.filter((t:any) => t.likes > 0);
        if (activeTab === 'my') return [...media.music, ...media.podcasts].filter((t:any) => localStorage.getItem('fav_' + t.id));
        return media[activeCat] || [];
    };

    const formatTime = (s: number) => {
        if (isNaN(s)) return "0:00";
        let m = Math.floor(s/60), sc = Math.floor(s%60);
        return `${m}:${sc < 10 ? '0' : ''}${sc}`;
    };

    const currentTrack = [...media.music, ...media.podcasts].find(x => x.id === curId);

    return (
        <div className="app-container">
            <style>{`
                .app-container { padding-bottom: 240px; color: white; font-family: 'Inter', sans-serif; position: relative; min-height: 100vh; }
                #bg-layer { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; background-size: cover; background-position: center; filter: blur(20px) brightness(0.4); transition: 0.5s; transform: scale(1.1); }
                .main-title { font-family: 'Orbitron', sans-serif; text-align: center; color: #00f2ff; text-shadow: 0 0 10px #00f2ff; margin: 20px 0; }
                .search-box { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white; margin-bottom: 15px; }
                .media-item { display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 8px; border: 1px solid transparent; }
                .media-item.active { border-color: #00f2ff; background: rgba(0, 242, 255, 0.1); }
                .media-left { display: flex; align-items: center; flex: 1; overflow: hidden; }
                .media-img { width: 50px; height: 50px; border-radius: 8px; margin-right: 12px; object-fit: cover; flex-shrink: 0; }
                .media-info { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 10px; }
                .media-name { font-weight: 600; font-size: 14px; text-overflow: ellipsis; overflow: hidden; }
                .item-btns { display: flex; gap: 12px; font-size: 18px; align-items: center; flex-shrink: 0; cursor: pointer; }
                .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
                .photo-item { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; cursor: pointer; }
                .player-panel { position: fixed; bottom: 85px; left: 10px; right: 10px; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 15px; backdrop-filter: blur(15px); z-index: 100; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); }
                .progress-area { height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; position: relative; margin: 15px 0 5px 0; cursor: pointer; }
                #progress-fill { height: 100%; background: #00f2ff; border-radius: 3px; box-shadow: 0 0 8px #00f2ff; transition: width 0.1s linear; }
                .time-info { display: flex; justify-content: space-between; font-size: 11px; color: rgba(255,255,255,0.7); margin-bottom: 10px; }
                .controls-row { display: flex; justify-content: space-between; align-items: center; }
                .ctrl-btn { background: none; border: none; color: white; width: 32px; height: 32px; cursor: pointer; padding: 0; opacity: 0.8; display: flex; align-items: center; justify-content: center; }
                .play-btn { background: #00f2ff; border: none; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; color: black; box-shadow: 0 0 15px #00f2ff; cursor: pointer; }
                .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; height: 75px; background: rgba(2, 6, 23, 0.95); display: flex; justify-content: space-around; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); z-index: 101; }
                .nav-item { display: flex; flex-direction: column; align-items: center; font-size: 11px; color: #64748b; text-decoration: none; cursor: pointer; }
                .nav-item.active { color: #00f2ff; }
                .nav-item svg { width: 24px; height: 24px; margin-bottom: 4px; }
                #modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 2000; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; }
                #modal-content { color: white; white-space: pre-wrap; width: 100%; height: 100%; overflow-y: auto; font-size: 16px; line-height: 1.5; padding-bottom: 40px; }
                .full-img { max-width: 100%; max-height: 90%; object-fit: contain; }
            `}</style>

            <div id="bg-layer" style={{ backgroundImage: `url(${bgImage})` }}></div>
            <h1 className="main-title">EVGEN MUSIC</h1>
            <input className="search-box" placeholder="Поиск..." value={search} onChange={(e)=>setSearch(e.target.value)} />

            {activeTab === 'catalog' && (
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                    {['music', 'podcasts', 'photos', 'texts'].map(c => (
                        <div key={c} style={{padding:'12px', background: activeCat===c?'#00f2ff':'rgba(255,255,255,0.1)', borderRadius:'12px', textAlign:'center', color:activeCat===c?'#000':'#fff', fontWeight:'600', cursor:'pointer'}}
                             onClick={() => { if(c==='podcasts' && prompt("Пароль:")!=='1285') return; setActiveCat(c); }}>
                            {c.toUpperCase()}
                        </div>
                    ))}
                </div>
            )}

            <div className="content-list">
                {activeCat === 'photos' && activeTab === 'catalog' ? (
                    <div className="photo-grid">
                        {media.photos.map((p: any) => (
                            <img key={p.url} src={p.url} className="photo-item" onClick={() => setModal({show:true, content:p.url, type:'image'})} />
                        ))}
                    </div>
                ) : activeCat === 'texts' && activeTab === 'catalog' ? (
                    getPlaylist().filter((i:any)=>(i.title||'').toLowerCase().includes(search.toLowerCase())).map((item: any) => (
                        <div key={item.url} className="media-item" onClick={() => openText(item)} style={{cursor:'pointer'}}>
                            📄 {item.title}
                        </div>
                    ))
                ) : (
                    getPlaylist().filter((i:any)=>(i.title||'').toLowerCase().includes(search.toLowerCase())).map((item: any) => (
                        <div key={item.id} className={`media-item ${curId === item.id ? 'active' : ''}`} onClick={() => play(item)}>
                            <div className="media-left">
                                <img className="media-img" src={item.img || DEF_IMG} />
                                <div className="media-info">
                                    <div className="media-name">{item.title}</div>
                                </div>
                            </div>
                            <div className="item-btns">
                                <span onClick={(e) => toggleLike(e, item)}>{localStorage.getItem('lk_'+item.id) ? '❤️' : '🤍'}</span>
                                <span onClick={(e) => toggleFav(e, item)}>{localStorage.getItem('fav_'+item.id) ? '⭐' : '➕'}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {currentTrack && (
                <div className="player-panel">
                    <div style={{textAlign:'center', fontWeight:'bold', fontSize:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', cursor:'pointer'}}
                         onClick={() => currentTrack.lyrics && setModal({show:true, content: currentTrack.lyrics, type:'text'})}>
                        {currentTrack.title}
                    </div>
                    <div className="progress-area" onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration;
                    }}>
                        <div id="progress-fill" style={{ width: `${(currentTime/duration)*100 || 0}%` }}></div>
                    </div>
                    <div className="time-info">
                        <span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span>
                    </div>
                    <div className="controls-row">
                        <button className="ctrl-btn" onClick={handleShare}>{ICONS.share}</button>
                        <button className="ctrl-btn" onClick={() => audioRef.current && (audioRef.current.currentTime -= 10)}>{ICONS.prev10}</button>
                        <button className="ctrl-btn" onClick={() => {
                            const list = getPlaylist(); const i = list.findIndex(x => x.id === curId);
                            if (i > 0) play(list[i-1]);
                        }}>{ICONS.prev}</button>
                        <button className="play-btn" onClick={() => play(currentTrack)}>
                            {isPlaying ? ICONS.pause : ICONS.play}
                        </button>
                        <button className="ctrl-btn" onClick={() => {
                            const list = getPlaylist(); const i = list.findIndex(x => x.id === curId);
                            if (i < list.length - 1) play(list[i+1]);
                        }}>{ICONS.next}</button>
                        <button className="ctrl-btn" onClick={() => audioRef.current && (audioRef.current.currentTime += 10)}>{ICONS.next10}</button>
                        <button className="ctrl-btn" onClick={handleDownload}>{ICONS.save}</button>
                    </div>
                </div>
            )}

            <nav className="bottom-nav">
                <div className={`nav-item ${activeTab==='home'?'active':''}`} onClick={()=>setActiveTab('home')}>{ICONS.home}<span>Главная</span></div>
                <div className={`nav-item ${activeTab==='catalog'?'active':''}`} onClick={()=>setActiveTab('catalog')}>{ICONS.cat}<span>Каталог</span></div>
                <div className={`nav-item ${activeTab==='my'?'active':''}`} onClick={()=>setActiveTab('my')}>{ICONS.fav}<span>Моё</span></div>
            </nav>

            {modal.show && (
                <div id="modal" onClick={() => setModal({show:false, content:'', type:'text'})}>
                    {modal.type === 'image' ? (
                        <img src={modal.content} className="full-img" />
                    ) : (
                        <div id="modal-content" onClick={e => e.stopPropagation()}>{modal.content}</div>
                    )}
                </div>
            )}

            <audio ref={audioRef} onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)}
                   onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                   onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                   onEnded={() => {
                       const list = getPlaylist(); const i = list.findIndex(x => x.id === curId);
                       if (i < list.length - 1) play(list[i+1]);
                   }}
            />
        </div>
    );
}
