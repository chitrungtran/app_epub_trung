import React, { useState, useEffect, useRef } from 'react';

// Hàm load thư viện (Giữ nguyên vì nó cần thiết)
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
  // Load thư viện
  const jszipStatus = useScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
  const epubStatus = useScript('https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js');

  const viewerRef = useRef(null);
  const [logs, setLogs] = useState([]); // Biến để in nhật ký ra màn hình

  // Hàm ghi nhật ký (giống console.log nhưng hiện lên web cho mày xem)
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

  // Hàm xử lý link đơn giản nhất có thể
  const processUrl = (url) => {
    if (!url) return null;
    if (url.includes('github.com') && url.includes('/blob/')) {
       // Chuyển sang link CDN cho nhanh
       let cdnUrl = url.replace('github.com', 'cdn.jsdelivr.net/gh');
       cdnUrl = cdnUrl.replace('/blob/', '@');
       return cdnUrl;
    }
    // Dùng Proxy cho mọi trường hợp còn lại
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  };

  useEffect(() => {
    // Chỉ chạy khi thư viện đã tải xong
    if (jszipStatus === 'ready' && epubStatus === 'ready') {
      addLog("✅ Thư viện ePub đã sẵn sàng.");
      
      const urlParam = getUrlParameter('url');
      if (!urlParam) {
        addLog("⚠️ Chưa có link sách. Hãy thêm ?url=... vào cuối địa chỉ.");
        return;
      }

      const bookUrl = processUrl(urlParam);
      addLog(`🔗 Link gốc: ${urlParam}`);
      addLog(`🚀 Link xử lý: ${bookUrl}`);

      // Bắt đầu quy trình tải "thủ công"
      const loadBook = async () => {
        try {
          addLog("⏳ Đang tải file về máy (Fetch)...");
          
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải file: ${response.status} ${response.statusText}`);
          
          const arrayBuffer = await response.arrayBuffer();
          addLog(`📦 Tải xong! Kích thước file: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

          if (arrayBuffer.byteLength < 1000) {
            throw new Error("File quá nhỏ! Có thể là file lỗi hoặc link sai.");
          }

          addLog("📖 Đang nạp dữ liệu vào ePub...");
          const book = window.ePub(arrayBuffer);
          
          addLog("🎨 Đang vẽ lên màn hình...");
          const rendition = book.renderTo(viewerRef.current, {
            width: "100%",
            height: "100%",
            flow: "scrolled-doc", // Cuộn dọc cho dễ
            manager: "continuous" // Load liên tục
          });

          await rendition.display();
          addLog("🎉 ĐÃ HIỂN THỊ THÀNH CÔNG! (Hy vọng thế)");

        } catch (err) {
          addLog(`❌ LỖI NGHIÊM TRỌNG: ${err.message}`);
        }
      };

      loadBook();
    }
  }, [jszipStatus, epubStatus]);

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h1>Debug Mode (Bản Trần Trụi) 🛠️</h1>
      
      {/* Khu vực hiển thị nhật ký lỗi */}
      <div style={{ 
        backgroundColor: '#333', 
        color: '#0f0', 
        padding: '10px', 
        marginBottom: '20px', 
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        {logs.map((log, index) => <div key={index}>{log}</div>)}
      </div>

      {/* Khu vực hiện sách */}
      <div 
        ref={viewerRef} 
        style={{ 
          border: '2px dashed red', 
          height: '80vh', // 80% chiều cao màn hình
          overflow: 'hidden',
          backgroundColor: '#fff' 
        }} 
      />
    </div>
  );
}
