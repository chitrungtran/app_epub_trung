import React, { useState, useEffect } from 'react';

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
  const [extractedContent, setExtractedContent] = useState([]); 

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
      addLog("✅ Thư viện sẵn sàng. Bắt đầu MỔ XẺ V2 (Tìm cả Ảnh)...");
      const urlParam = getUrlParameter('url');
      if (!urlParam) { addLog("⚠️ Thiếu link sách."); return; }

      const bookUrl = processUrl(urlParam);
      addLog(`🚀 Link: ${bookUrl}`);

      const extractBookData = async () => {
        try {
          addLog("⏳ Đang tải file...");
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải: ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();
          addLog(`📦 Tải xong: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

          addLog("📖 Đang phân tích...");
          const book = window.ePub(arrayBuffer);
          await book.ready;
          
          const spineCount = book.spine.length;
          addLog(`📚 Có ${spineCount} chương. Bắt đầu quét...`);

          const contentList = [];
          
          // Quét tối đa 20 chương đầu
          for (let i = 0; i < Math.min(spineCount, 20); i++) {
            addLog(`...Đang đọc chương ${i + 1}/${spineCount}`);
            const item = book.spine.get(i);
            
            if (item) {
              try {
                // Load document của chương đó
                const doc = await item.load(book.load.bind(book));
                
                // 1. Lấy chữ
                const text = (doc.body.innerText || "").trim();
                
                // 2. Lấy ảnh
                const images = Array.from(doc.body.querySelectorAll('img')).map(img => img.src);

                if (text.length > 0 || images.length > 0) {
                   contentList.push({
                     id: i,
                     text: text,
                     images: images
                   });
                   addLog(`✅ Chương ${i+1}: Tìm thấy ${text.length} ký tự và ${images.length} ảnh.`);
                } else {
                   addLog(`⚠️ Chương ${i+1}: Trống rỗng?`);
                }
              } catch (e) {
                addLog(`❌ Lỗi đọc chương ${i+1}: ${e.message}`);
              }
            }
          }

          if (contentList.length === 0) {
             addLog("💀 VÔ VỌNG: Không tìm thấy chữ hay ảnh nào cả!");
          } else {
             setExtractedContent(contentList);
             addLog("🎉 XONG! Kéo xuống dưới xem hàng!");
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
      <h1 style={{borderBottom: '2px solid teal'}}>🕵️‍♂️ Máy Soi Nội Dung (Text + Image)</h1>
      
      {/* LOGS */}
      <div style={{ 
        backgroundColor: '#222', color: '#0f0', padding: '10px', 
        marginBottom: '20px', borderRadius: '8px',
        fontFamily: 'monospace', fontSize: '12px', maxHeight: '200px', overflowY: 'auto'
      }}>
        {logs.map((log, index) => <div key={index}>{log}</div>)}
      </div>

      {/* HIỂN THỊ NỘI DUNG */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #ccc', padding: '10px' }}>
        {extractedContent.map((chap) => (
          <div key={chap.id} style={{ marginBottom: '40px', borderBottom: '4px solid #eee', paddingBottom: '20px' }}>
            <h3 style={{color: 'blue', backgroundColor: '#eee', padding: '5px'}}>Chương {chap.id + 1}</h3>
            
            {/* Hiển thị chữ nếu có */}
            {chap.text && (
              <div style={{whiteSpace: 'pre-wrap', marginBottom: '15px', fontSize: '16px', lineHeight: '1.6'}}>
                {chap.text.substring(0, 500)}... 
                {chap.text.length > 500 && <span style={{color:'gray'}}>(còn nữa)</span>}
              </div>
            )}

            {/* Hiển thị ảnh nếu có */}
            {chap.images.length > 0 && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                <p style={{fontWeight: 'bold', color: 'red'}}>👇 Tìm thấy {chap.images.length} ảnh:</p>
                {chap.images.map((src, idx) => (
                  <img key={idx} src={src} alt={`img-${idx}`} style={{maxWidth: '100%', border: '2px solid black'}} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
