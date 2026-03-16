import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;

const sb = createClient(S_URL, S_KEY);

const ICONS = {
    share: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>,
    prev: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>,
    play: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>,
    pause: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
    next: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>,
    save: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>,
    home: <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>,
    cat: <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>,
    fav: <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
};

export default function App() {
    const [media, setMedia] = useState<any>({ music: [], podcasts: [], photos: [], texts: [] });
    const [activeTab, setActiveTab] = useState('home');
    const [activeCat, setActiveCat] = useState('music');
    const [curId, setCurId] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState({ show: false, content: '', type: 'text' });
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const touchStart = useRef(0);

    useEffect(() => { initApp(); }, []);

    const initApp = async () => {
        const paths = ['music', 'podcasts', 'photos', 'texts'];
        const results = await Promise.all(paths.map(p => fetchGH(p)));
        let newMedia: any = {
            music: results[0].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, likes: 0, dur: '' })),
            podcasts: results[1].filter((f:any)=>f.name.endsWith('.mp3')).map((f:any)=>({ id: f.name.replace('.mp3',''), title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, likes: 0, dur: '' })),
            photos: results[2].map((f:any)=>({ url: f.download_url })),
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
            setCurId(t.id);
            if (audioRef.current) { audioRef.current.src = t.url; audioRef.current.play(); }
        }
    };

    const toggleLike = async (e: any, t: any) => {
        e.stopPropagation();
        const key = 'lk_' + t.id;
        const isLiked = !!localStorage.getItem(key);
        if (isLiked) localStorage.removeItem(key); else localStorage.setItem(key, '1');
        
        // Оптимистичное обновление (мгновенно в UI)
        setMedia((prev: any) => ({
            ...prev,
            music: prev.music.map((s: any) => s.id === t.id ? { ...s, likes: isLiked ? s.likes - 1 : s.likes + 1 } : s),
            podcasts: prev.podcasts.map((s: any) => s.id === t.id ? { ...s, likes: isLiked ? s.likes - 1 : s.likes + 1 } : s)
        }));
        await sb.from('likes').upsert({ song_id: t.id, count: isLiked ? t.likes - 1 : t.likes + 1 }, { onConflict: 'song_id' });
    };

    const handleDownload = async () => {
        const t = currentTrack;
        if (!t) return;
        try {
            const resp = await fetch(t.url);
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${t.title}.mp3`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) { alert("Ошибка загрузки"); }
    };

    const openText = async (item: any) => {
        const r = await fetch(item.url);
        const b = await r.arrayBuffer();
        let txt = new TextDecoder('utf-8').decode(b);
        // Проверка на битую кодировку (символы-заплатки)
        if (txt.includes('') || /[^а-яА-ЯёЁ\s\d\w\p{P}]/u.test(txt.slice(0, 50))) {
            txt = new TextDecoder('windows-1251').decode(b);
        }
        setModal({ show: true, content: txt, type: 'text' });
    };

    const onTouchStart = (e: any) => touchStart.current = e.touches[0].clientX;
    const onTouchEnd = (e: any) => {
        const diff = touchStart.current - e.changedTouches[0].clientX;
        const tabs = ['home', 'catalog', 'my'];
        const currIdx = tabs.indexOf(activeTab);
        if (Math.abs(diff) > 100) {
            if (diff > 0 && currIdx < 2) setActiveTab(tabs[currIdx + 1]);
            if (diff < 0 && currIdx > 0) setActiveTab(tabs[currIdx - 1]);
        }
    };

    const currentTrack = useMemo(() => [...media.music, ...media.podcasts].find(x => x.id === curId), [curId, media]);

    const playlist = useMemo(() => {
        let list = activeTab === 'home' ? media.music.filter((t: any) => t.likes > 0) :
                   activeTab === 'my' ? [...media.music, ...media.podcasts].filter((t: any) => localStorage.getItem('fav_' + t.id)) :
                   media[activeCat];
        return list.filter((i: any) => (i.title || '').toLowerCase().includes(search.toLowerCase())).reverse();
    }, [activeTab, activeCat, media, search]);

    return (
        <div className="app" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <style>{`
                .app { min-height: 100vh; color: white; font-family: sans-serif; padding: 15px; padding-bottom: 220px; }
                #bg { position: fixed; inset: 0; z-index: -1; background: url(${currentTrack?.img || DEF_IMG}) center/cover; filter: blur(25px) brightness(0.3); transition: 0.5s; transform: scale(1.1); }
                .title { font-family: 'Orbitron', sans-serif; text-align: center; color: #00f2ff; margin: 15px 0; text-shadow: 0 0 10px #00f2ff; }
                .search { width: 100%; padding: 12px; border-radius: 12px; border: 1px solid #ffffff33; background: #ffffff11; color: #fff; margin-bottom: 15px; outline: none; }
                .tabs { display: flex; gap: 10px; margin-bottom: 15px; }
                .tab { flex: 1; padding: 10px; border-radius: 10px; background: #ffffff11; text-align: center; font-size: 12px; }
                .tab.active { background: #00f2ff; color: #000; font-weight: bold; }
                .item { display: flex; align-items: center; padding: 10px; background: #ffffff08; border-radius: 12px; margin-bottom: 8px; border: 1px solid transparent; }
                .item.active { border-color: #00f2ff; background: #00f2ff11; }
                .item img { width: 50px; height: 50px; border-radius: 8px; margin-right: 12px; }
                .item-info { flex: 1; overflow: hidden; }
                .item-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .item-meta { font-size: 11px; color: #94a3b8; }
                .player { position: fixed; bottom: 85px; width: calc(100% - 30px); left: 15px; background: rgba(15,23,42,0.9); backdrop-filter: blur(15px); border: 1px solid #ffffff22; border-radius: 20px; padding: 15px; z-index: 100; box-sizing: border-box; }
                .progress { height: 5px; background: #ffffff22; border-radius: 3px; margin: 12px 0; position: relative; }
                .progress-fill { height: 100%; background: #00f2ff; border-radius: 3px; box-shadow: 0 0 8px #00f2ff; }
                .time { display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-top: -8px; margin-bottom: 10px; }
                .controls { display: flex; justify-content: space-between; align-items: center; }
                .play-btn { background: #00f2ff; color: #000; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
                .nav { position: fixed; bottom: 0; left: 0; right: 0; height: 75px; background: #020617f0; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #ffffff11; }
                .nav-btn { color: #64748b; display: flex; flex-direction: column; align-items: center; font-size: 10px; }
                .nav-btn.active { color: #00f2ff; }
                .modal { position: fixed; inset: 0; background: #000000f5; z-index: 1000; padding: 20px; overflow-y: auto; }
            `}</style>

            <div id="bg"></div>
            <h1 className="title">EVGEN MUSIC</h1>
            <input className="search" placeholder="Поиск треков..." value={search} onChange={e => setSearch(e.target.value)} />

            {activeTab === 'catalog' && (
                <div className="tabs">
                    {['music', 'podcasts', 'photos', 'texts'].map(c => (
                        <div key={c} className={`tab ${activeCat === c ? 'active' : ''}`} onClick={() => setActiveCat(c)}>{c.toUpperCase()}</div>
                    ))}
                </div>
            )}

            <div className="list">
                {activeCat === 'photos' && activeTab === 'catalog' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                        {media.photos.map((p: any) => <img key={p.url} src={p.url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '5px' }} />)}
                    </div>
                ) : activeCat === 'texts' && activeTab === 'catalog' ? (
                    playlist.map((t: any) => <div key={t.url} className="item" onClick={() => openText(t)}>📄 {t.title}</div>)
                ) : (
                    playlist.map((t: any) => (
                        <div key={t.id} className={`item ${curId === t.id ? 'active' : ''}`} onClick={() => play(t)}>
                            <img src={t.img || DEF_IMG} alt="" loading="lazy" />
                            <div className="item-info">
                                <div className="item-name">{t.title}</div>
                                <div className="item-meta">{t.likes > 0 && `❤️ ${t.likes}`}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <span onClick={(e) => toggleLike(e, t)}>{localStorage.getItem('lk_' + t.id) ? '❤️' : '🤍'}</span>
                                <span onClick={(e) => { e.stopPropagation(); const k = 'fav_' + t.id; localStorage.getItem(k) ? localStorage.removeItem(k) : localStorage.setItem(k, '1'); setMedia({ ...media }); }}>{localStorage.getItem('fav_' + t.id) ? '⭐' : '➕'}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {currentTrack && (
                <div className="player">
                    <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>{currentTrack.title}</div>
                    <div className="progress" onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration;
                    }}>
                        <div className="progress-fill" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
                    </div>
                    <div className="time">
                        <span>{Math.floor(currentTime / 60)}:{(currentTime % 60).toFixed(0).padStart(2, '0')}</span>
                        <span>{Math.floor(duration / 60)}:{(duration % 60).toFixed(0).padStart(2, '0')}</span>
                    </div>
                    <div className="controls">
                        <div onClick={handleShare}>{ICONS.share}</div>
                        <div onClick={() => { const i = playlist.findIndex(x => x.id === curId); if (i > 0) play(playlist[i - 1]); }}>{ICONS.prev}</div>
                        <div className="play-btn" onClick={() => play(currentTrack)}>{isPlaying ? ICONS.pause : ICONS.play}</div>
                        <div onClick={() => { const i = playlist.findIndex(x => x.id === curId); if (i < playlist.length - 1) play(playlist[i + 1]); }}>{ICONS.next}</div>
                        <div onClick={handleDownload}>{ICONS.save}</div>
                    </div>
                </div>
            )}

            <nav className="nav">
                <div className={`nav-btn ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>{ICONS.home}<span>Главная</span></div>
                <div className={`nav-btn ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>{ICONS.cat}<span>Каталог</span></div>
                <div className={`nav-btn ${activeTab === 'my' ? 'active' : ''}`} onClick={() => setActiveTab('my')}>{ICONS.fav}<span>Моё</span></div>
            </nav>

            {modal.show && <div className="modal" onClick={() => setModal({ ...modal, show: false })}><pre style={{ whiteSpace: 'pre-wrap', color: '#fff' }}>{modal.content}</pre></div>}

            <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={() => { const i = playlist.findIndex(x => x.id === curId); if (i < playlist.length - 1) play(playlist[i + 1]); }} />
        </div>
    );
}

const handleShare = () => { if (navigator.share) navigator.share({ title: 'Music', url: window.location.href }); };
        
