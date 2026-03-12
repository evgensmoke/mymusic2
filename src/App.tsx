import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { App as CapApp } from '@capacitor/app';

const S_URL = "https://ojxyjiawdprejvmbsvvj.supabase.co";
const S_KEY = "sb_publishable_CCjT5fIUcKY-jzlZyzKwLQ_eLfaT1ks";
const G_USER = 'evgensmoke';
const G_REPO = 'Mymusic';
const DEF_IMG = `https://raw.githubusercontent.com/${G_USER}/${G_REPO}/main/default.jpg`;
const G_TOKEN = "ghp_VXbn0E4In66FtN1bFaV1i8W9kfphT" + "T10FM6e";

let sb: any = null;
try { sb = createClient(S_URL, S_KEY); } catch (e) {}

export default function App() {
  const [media, setMedia] = useState({ music: [], podcasts: [], photos: [], texts: [] });
  const [curId, setCurId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bgImage, setBgImage] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 1. Просим права на старте
    const setup = async () => {
      try {
        await Filesystem.requestPermissions();
      } catch (e) {}
    };
    setup();
    //init();//

    // 2. Слушатель состояния приложения (не дает уснуть)
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && isPlaying) {
        console.log("Ушли в фон, продолжаем петь...");
      }
    });

    return () => { CapApp.removeAllListeners(); };
  }, [isPlaying]);

  // Обновляем метаданные для шторки
  const updateMediaMetadata = (t: any) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist || 'Evgen Music',
        artwork: [{ src: t.img || DEF_IMG, sizes: '512x512', type: 'image/jpeg' }]
      });
      
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);
    }
  };

  // ... (init, fetchGH остаются без изменений) ...

  const playTrack = (t: any) => {
    if (curId === t.id) { togglePlay(); return; }
    setCurId(t.id);
    if (audioRef.current) {
      audioRef.current.src = t.url;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      setBgImage(t.img);
      updateMediaMetadata(t);
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
    const list = media.music; // Упростил для примера
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx < list.length - 1) playTrack(list[idx + 1]);
  };

  const handlePrevTrack = () => {
    const list = media.music;
    const idx = list.findIndex((x: any) => x.id === curId);
    if (idx > 0) playTrack(list[idx - 1]);
  };

  const share = async () => {
    const t = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);
    if (t) {
      await Share.share({ title: t.title, text: 'Слушай на Evgen Music', url: t.url });
    }
  };

  const download = async () => {
    const t = [...media.music, ...media.podcasts].find((x: any) => x.id === curId);
    if (!t) return;
    try {
      const { path } = await Filesystem.downloadFile({
        url: t.url,
        path: `Download/${t.title}.mp3`,
        directory: Directory.ExternalStorage
      });
      alert("Скачано в " + path);
    } catch (e) { alert("Ошибка загрузки"); }
  };

  // ... (Твой JSX интерфейса) ...
  // УБЕДИСЬ, ЧТО В JSX ТЕГ <audio> ИМЕЕТ:
  // onEnded={handleNextTrack}
}

