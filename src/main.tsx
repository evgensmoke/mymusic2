import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Добавляем аварийный вывод ошибок на экран
window.onerror = function(msg, url, line) {
  alert("ОШИБКА: " + msg + "\nГде: " + url + "\nСтрока: " + line);
  return false;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

