import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './i18n'

const isEmbedMode = new URLSearchParams(window.location.search).has('embed');

const root = ReactDOM.createRoot(document.getElementById('root')!);

if (isEmbedMode) {
  // 懒加载 EmbedApp，不影响主 App 的 bundle 大小
  import('./EmbedApp').then(({ default: EmbedApp }) => {
    // 嵌入模式下隐藏默认背景和溢出
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    root.render(
      <React.StrictMode>
        <EmbedApp />
      </React.StrictMode>,
    );
  });
} else {
  import('./App').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
}
