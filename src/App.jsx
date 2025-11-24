import React, { useState, useEffect, useRef } from 'react';

// Hàm load thư viện (Giữ nguyên)
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
          // Xóa sạch khung cũ trước khi vẽ
          if (viewerRef.current) { viewerRef.current.innerHTML = ""; }

          addLog("⏳ Đang tải file (Fetch)...");
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải: ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();
          addLog(`📦 Tải xong: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

          addLog("📖 Đang nạp dữ liệu...");
          const book = window.ePub(arrayBuffer);
          window.book = book;

          await book.ready;
          addLog("✅ Đã phân tích xong cấu trúc.");

          addLog("🎨 Đang vẽ (Chế độ Scrolled-Doc)...");
          
          // CẤU HÌNH CỨU HỘ
          const rendition = book.renderTo(viewerRef.current, {
            width: "100%",
            height: "100%", 
            flow: "scrolled-doc", // Chế độ này dễ chịu nhất cho file lạ
            manager: "continuous", // Thử lại continuous vì đã nạp ArrayBuffer
            allowScriptedContent: false
          });

          // ÉP STYLE CỨNG
          rendition.themes.default({ 
            "html, body": { "height": "100%", "margin": "0", "padding": "0" },
            "body": { "color": "#000 !important", "background": "#fff !important", "font-size": "18px !important" },
            "p": { "font-family": "Arial !important" }
          });

          addLog("⚡ Đang hiển thị...");
          await rendition.display();
          
          addLog("🎉 XONG! NHÌN XUỐNG DƯỚI COI CÓ CHỮ KHÔNG?");

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
      
      {/* Nhật ký */}
      <div style={{ 
        backgroundColor: '#000', color: '#0f0', padding: '10px', 
        fontSize: '12px', height: '150px', overflowY: 'auto', flexShrink: 0 
      }}>
        <h3 style={{margin: 0, color: 'white'}}>NHẬT KÝ DEBUG:</h3>
        {logs.map((log, index) => <div key={index}>{log}</div>)}
      </div>

      {/* KHUNG ĐỌC SÁCH - CÓ VIỀN ĐỎ ĐỂ BIẾT NÓ Ở ĐÂU */}
      <div 
        ref={viewerRef} 
        style={{ 
          flex: 1, 
          width: '100%',
          backgroundColor: '#ffffff', 
          overflowY: 'auto', 
          overflowX: 'hidden',
          border: '5px solid red', // Viền đỏ để kiểm tra khung
          position: 'relative'
        }} 
      />
    </div>
  );
}
