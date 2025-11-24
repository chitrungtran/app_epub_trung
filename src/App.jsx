import React, { useState, useEffect, useRef } from 'react';

const useScript = (src) => {
  const [status, setStatus] = useState(src ? 'loading' : 'idle');
  useEffect(() => {
    if (!src) { setStatus('idle'); return; }
    let script = document.querySelector(`script[src="${src}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.setAttribute('data-status', 'loading');
      document.body.appendChild(script);
      const handleLoad = () => { script.setAttribute('data-status', 'ready'); setStatus('ready'); };
      const handleError = () => { script.setAttribute('data-status', 'error'); setStatus('error'); };
      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);
    } else {
      setStatus(script.getAttribute('data-status') || 'ready');
    }
  }, [src]);
  return status;
};

export default function App() {
  const jszipStatus = useScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  const epubStatus = useScript('https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js');

  const viewerRef = useRef(null);
  const [logs, setLogs] = useState([]);

  const addLog = (msg) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
    console.log(msg);
  };

  const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  const processUrl = (url) => {
    if (!url) return null;
    if (url.includes('github.com') && url.includes('/blob/')) {
       let cdnUrl = url.replace('github.com', 'cdn.jsdelivr.net/gh');
       cdnUrl = cdnUrl.replace('/blob/', '@');
       return cdnUrl;
    }
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  };

  useEffect(() => {
    if (jszipStatus === 'ready' && epubStatus === 'ready') {
      addLog("✅ Thư viện sẵn sàng.");
      const urlParam = getUrlParameter('url');
      if (!urlParam) { addLog("⚠️ Thiếu link sách."); return; }

      const bookUrl = processUrl(urlParam);
      addLog(`🚀 Link: ${bookUrl}`);

      const loadBook = async () => {
        try {
          addLog("⏳ Đang tải file (Fetch)...");
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải: ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();
          addLog(`📦 Tải xong: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

          if (window.book) { window.book.destroy(); }

          addLog("📖 Đang nạp dữ liệu...");
          const book = window.ePub(arrayBuffer);
          window.book = book;

          await book.ready;
          addLog("✅ Đã phân tích xong cấu trúc sách.");

          addLog("🎨 Đang vẽ (Chế độ Cuộn Dọc)...");
          
          // CẤU HÌNH CUỘN DỌC
          const rendition = book.renderTo(viewerRef.current, {
            width: "100%",
            height: "100%",
            flow: "scrolled-doc", // Chế độ cuộn
            manager: "continuous", // Load liên tục
            allowScriptedContent: false
          });

          addLog("⚡ Đang hiển thị...");
          await rendition.display();
          
          addLog("🎉 XONG! VUỐT MÀ ĐỌC ĐI TRUNG ƠI!");

        } catch (err) {
          addLog(`❌ LỖI: ${err.message}`);
          console.error(err);
        }
      };

      loadBook();
    }
  }, [jszipStatus, epubStatus]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      
      {/* Nhật ký nhỏ xíu ở trên để debug */}
      <div style={{ 
        backgroundColor: '#222', color: '#0f0', padding: '5px', 
        fontSize: '11px', height: '100px', overflowY: 'auto', flexShrink: 0 
      }}>
        {logs.map((log, index) => <div key={index}>{log}</div>)}
      </div>

      {/* KHUNG ĐỌC SÁCH (Cuộn tự do) */}
      <div 
        ref={viewerRef} 
        style={{ 
          flex: 1, 
          backgroundColor: '#fff', 
          overflowY: 'auto', // Cho phép cuộn dọc
          overflowX: 'hidden'
        }} 
      />
    </div>
  );
}
