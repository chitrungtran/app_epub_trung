import React, { useState, useEffect } from 'react';

// Hàm load thư viện
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

  const [logs, setLogs] = useState([]);
  const [rawChapters, setRawChapters] = useState([]); // Chứa dữ liệu thô

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
      addLog("✅ Thư viện sẵn sàng. Bắt đầu chế độ MỔ XẺ...");
      const urlParam = getUrlParameter('url');
      if (!urlParam) { addLog("⚠️ Thiếu link sách."); return; }

      const bookUrl = processUrl(urlParam);
      addLog(`🚀 Link: ${bookUrl}`);

      const extractBookData = async () => {
        try {
          addLog("⏳ Đang tải file (Fetch)...");
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải: ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();
          addLog(`📦 Tải xong: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

          addLog("📖 Đang phân tích cấu trúc...");
          const book = window.ePub(arrayBuffer);
          await book.ready;
          
          addLog(`📚 Tìm thấy ${book.spine.length} chương/mục.`);
          addLog("⛏️ Đang đào dữ liệu (Text Mining)...");

          const chaptersData = [];
          
          // Lặp qua từng chương để lấy chữ (Giới hạn 20 chương đầu cho đỡ lag)
          const limit = Math.min(book.spine.length, 50); 
          
          for (let i = 0; i < limit; i++) {
            const item = book.spine.get(i);
            if (item) {
              try {
                // Load nội dung thô của chương đó
                // Lưu ý: book.load.bind(book) là chìa khóa để giải mã
                const doc = await item.load(book.load.bind(book));
                
                // Lấy chữ thuần túy (innerText)
                const textContent = doc.body.innerText || doc.body.textContent;
                
                if (textContent.trim().length > 0) {
                   chaptersData.push({
                     id: i,
                     text: textContent
                   });
                   addLog(`✅ Đã lấy xong chương ${i + 1}`);
                }
              } catch (e) {
                addLog(`⚠️ Lỗi chương ${i}: ${e.message}`);
              }
            }
          }

          if (chaptersData.length === 0) {
             addLog("❌ KHÔNG LẤY ĐƯỢC CHỮ NÀO! (File mã hóa hoặc trống?)");
          } else {
             setRawChapters(chaptersData);
             addLog("🎉 XONG! DỮ LIỆU ĐANG HIỆN BÊN DƯỚI 👇");
          }

        } catch (err) {
          addLog(`❌ LỖI CHẾT NGƯỜI: ${err.message}`);
        }
      };

      extractBookData();
    }
  }, [jszipStatus, epubStatus]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{borderBottom: '2px solid teal'}}>🕵️‍♂️ Chế Độ Data Miner (Lấy Dữ Liệu Thô)</h1>
      
      {/* KHUNG LOG */}
      <div style={{ 
        backgroundColor: '#333', color: '#0f0', padding: '10px', 
        marginBottom: '20px', borderRadius: '8px',
        fontFamily: 'monospace', fontSize: '12px', maxHeight: '150px', overflowY: 'auto'
      }}>
        {logs.map((log, index) => <div key={index}>{log}</div>)}
      </div>

      {/* KHUNG HIỂN THỊ CHỮ THÔ */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
        {rawChapters.length === 0 ? (
          <p style={{color: 'gray', fontStyle: 'italic'}}>Chưa có dữ liệu...</p>
        ) : (
          rawChapters.map((chap) => (
            <div key={chap.id} style={{ marginBottom: '30px', borderBottom: '1px dashed #ccc', paddingBottom: '20px' }}>
              <h3 style={{color: 'teal'}}>--- Phần {chap.id + 1} ---</h3>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6', color: '#333' }}>
                {chap.text}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
