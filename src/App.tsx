"use client"

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// --- КОНФИГУРАЦИЯ ---
const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co"
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks"
const G_USER = 'evgensmoke'
const G_REPO = 'Mymusic'
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e"
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`

const sb = createClient(S_URL, S_KEY)

// --- ИКОНКИ ---
const ICONS = {
  share: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>,
  play: <svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>,
  pause: <svg viewBox="0 0 24 24" width="30" height="30"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>,
  save: <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>,
  next: <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>,
  prev: <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
}

// --- КОМПОНЕНТ ТРЕКА ---
const TrackItem = React.memo(({ track, isActive, isLiked, onPlay, onLike }: any) => {
  const [dur, setDur] = useState('--:--')
  useEffect(() => {
    const a = new Audio(track.url); a.preload = 'metadata'
    a.onloadedmetadata = () => {
      const m = Math.floor(a.duration / 60), s = Math.floor(a.duration % 60)
      setDur(`${m}:${s.toString().padStart(2, '0')}`)
    }
  }, [track.url])

  return (
    <div className={`track-card ${isActive ? 'active' : ''}`} onClick={() => onPlay(track)}>
      <img src={track.img || DEF_IMG} alt="" loading="lazy" />
      <div className="track-info">
        <div className="track-name">{track.title}</div>
        <div className="track-meta">{dur} | ❤️ {track.likes}</div>
      </div>
      <div className="track-btns" onClick={e => e.stopPropagation()}>
         <button onClick={() => onLike(track)}>{isLiked ? '❤️' : '🤍'}</button>
      </div>
    </div>
  )
})

export default function App() {
  const [media, setMedia] = useState<any>({ music: [], podcasts: [], photos: [], texts: [] })
  const [activeTab, setActiveTab] = useState('home')
  const [curId, setCurId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [search, setSearch] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const touchStart = useRef(0)

  useEffect(() => { initData() }, [])

  // Фоновое прослушивание
  useEffect(() => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId)
    if (t && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: t.title, artist: 'Evgen Music', artwork: [{ src: t.img || DEF_IMG }]
      })
    }
  }, [curId, media])

  const initData = async () => {
    const paths = ['music', 'podcasts', 'photos', 'texts']
    const [m, p, ph, tx] = await Promise.all(paths.map(path => 
      fetch(`https://api.github.com/repos/${G_USER}/${G_REPO}/contents/${path}`, {
        headers: { Authorization: `token ${G_TOKEN}` }
      }).then(res => res.json()).catch(() => [])
    ))

    const formattedMedia = {
      music: m.filter((f:any) => f.name.endsWith('.mp3')).map((f:any) => ({ id: f.name, title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, likes: 0 })),
      podcasts: p.filter((f:any) => f.name.endsWith('.mp3')).map((f:any) => ({ id: f.name, title: decodeURIComponent(f.name.replace('.mp3','')), url: f.download_url, img: DEF_IMG, likes: 0 })),
      photos: ph.map((f:any) => ({ url: f.download_url })),
      texts: tx.filter((f:any) => f.name.endsWith('.txt')).map((f:any) => ({ title: f.name, url: f.download_url }))
    }

    const { data } = await sb.from('likes').select('*')
    if (data) {
      data.forEach(r => {
        const track = [...formattedMedia.music, ...formattedMedia.podcasts].find(x => x.id === r.song_id)
        if (track) { track.likes = r.count || 0; track.img = r.cover_data || DEF_IMG }
      })
    }
    setMedia(formattedMedia)
  }

  const handlePlay = (t: any) => {
    if (curId === t.id) {
      isPlaying ? audioRef.current?.pause() : audioRef.current?.play()
    } else {
      setCurId(t.id)
      if (audioRef.current) { audioRef.current.src = t.url; audioRef.current.play() }
    }
  }

  // СКАЧИВАНИЕ ЧЕРЕЗ BLOB
  const downloadFile = async () => {
    const t = [...media.music, ...media.podcasts].find(x => x.id === curId)
    if (!t) return
    const res = await fetch(t.url)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${t.title}.mp3`
    document.body.appendChild(a); a.click(); a.remove()
  }

  const toggleLike = async (t: any) => {
    const isL = localStorage.getItem('lk_'+t.id)
    const newCount = isL ? t.likes - 1 : t.likes + 1
    isL ? localStorage.removeItem('lk_'+t.id) : localStorage.setItem('lk_'+t.id, '1')
    
    setMedia((prev: any) => ({
      ...prev,
      music: prev.music.map((s:any) => s.id === t.id ? {...s, likes: newCount} : s)
    }))
    await sb.from('likes').upsert({ song_id: t.id, count: newCount }, { onConflict: 'song_id' })
  }

  const filtered = useMemo(() => {
    const list = activeTab === 'home' ? media.music.filter((x:any) => x.likes > 0) : media.music
    return list.filter((x:any) => x.title.toLowerCase().includes(search.toLowerCase()))
  }, [media, activeTab, search])

  const currentTrack = [...media.music, ...media.podcasts].find(x => x.id === curId)

  return (
    <div className="player-app" onTouchStart={e => touchStart.current = e.touches[0].clientX} onTouchEnd={e => {
      const diff = touchStart.current - e.changedTouches[0].clientX
      if (diff > 100) setActiveTab('catalog'); if (diff < -100) setActiveTab('home')
    }}>
      <style>{`
        .player-app { min-height: 100vh; background: #0f172a; color: white; padding: 20px 15px 180px; font-family: sans-serif; }
        .track-card { display: flex; align-items: center; background: #1e293b; padding: 12px; border-radius: 15px; margin-bottom: 10px; border: 1px solid transparent; }
        .track-card.active { border-color: #00f2ff; background: #1e293b88; }
        .track-card img { width: 50px; height: 50px; border-radius: 10px; margin-right: 15px; }
        .track-info { flex: 1; }
        .track-name { font-size: 14px; font-weight: bold; }
        .track-meta { font-size: 11px; color: #94a3b8; }
        .bottom-player { position: fixed; bottom: 85px; left: 15px; width: calc(100% - 30px); background: #1e293b; border-radius: 20px; padding: 15px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .progress-bar { height: 4px; background: #334155; border-radius: 2px; margin: 10px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: #00f2ff; width: 0%; }
        .player-controls { display: flex; justify-content: space-between; align-items: center; }
        .nav-bar { position: fixed; bottom: 0; left: 0; width: 100%; height: 70px; background: #020617; display: flex; justify-content: space-around; align-items: center; border-top: 1px solid #1e293b; }
        .nav-item { color: #64748b; font-size: 12px; }
        .nav-item.active { color: #00f2ff; }
      `}</style>

      <h2>{activeTab === 'home' ? '⭐ Популярное' : '🎵 Весь список'}</h2>
      <input type="text" placeholder="Поиск..." className="search" value={search} onChange={e => setSearch(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'10px', background:'#1e293b', border:'none', color:'white', marginBottom:'20px'}} />

      <div className="list">
        {filtered.map((t: any) => (
          <TrackItem key={t.id} track={t} isActive={curId === t.id} isLiked={!!localStorage.getItem('lk_'+t.id)} onPlay={handlePlay} onLike={toggleLike} />
        ))}
      </div>

      {currentTrack && (
        <div className="bottom-player">
          <div style={{fontSize:'12px', fontWeight:'bold', textAlign:'center'}}>{currentTrack.title}</div>
          <div className="progress-bar"><div className="progress-fill" style={{width: `${progress}%`}}></div></div>
          <div className="player-controls">
            <button onClick={() => navigator.share({title: currentTrack.title, url: currentTrack.url})}>{ICONS.share}</button>
            <button onClick={() => handlePlay(currentTrack)}>{isPlaying ? ICONS.pause : ICONS.play}</button>
            <button onClick={downloadFile}>{ICONS.save}</button>
          </div>
        </div>
      )}

      <div className="nav-bar">
        <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>Главная</div>
        <div className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>Каталог</div>
      </div>

      <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} 
        onTimeUpdate={() => setProgress((audioRef.current!.currentTime / audioRef.current!.duration) * 100)} />
    </div>
  )
      }
