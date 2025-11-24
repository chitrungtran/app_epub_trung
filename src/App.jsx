import React, { useState, useEffect } from 'react';

// Load thư viện JSZip (Quan trọng nhất)
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
  // Chỉ cần JSZip là đủ để mổ xẻ
  const jszipStatus = useScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

  const [logs, setLogs] = useState([]);
  const [zipContents, setZipContents] = useState([]); 

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
    if (jszipStatus === 'ready') {
      addLog("✅ JSZip sẵn sàng. Bắt đầu PHẪU THUẬT TƯƠI...");
      const urlParam = getUrlParameter('url');
      if (!urlParam) { addLog("⚠️ Thiếu link sách."); return; }

      const bookUrl = processUrl(urlParam);
      addLog(`🚀 Link: ${bookUrl}`);

      const unzipBook = async () => {
        try {
          addLog("⏳ Đang tải file...");
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải: ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();
          addLog(`📦 Tải xong: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

          addLog("🔓 Đang giải nén (Unzip)...");
          
          // Dùng JSZip đọc file trực tiếp
          const zip = new window.JSZip();
          const contents = await zip.loadAsync(arrayBuffer);
          
          const filesData = [];
          
          // Quét tất cả các file bên trong cục nén đó
          const filenames = Object.keys(contents.files);
          addLog(`📂 Tìm thấy ${filenames.length} file bên trong.`);

          // Lọc lấy file ảnh và file HTML
          for (let filename of filenames) {
            const file = contents.files[filename];
            if (file.dir) continue; // Bỏ qua thư mục

            // Nếu là file HTML/XHTML (Chứa chữ)
            if (filename.match(/\.(html|xhtml|htm|xml)$/i)) {
               addLog(`📄 Đang đọc text: ${filename}`);
               const text = await file.async("string");
               // Lọc lấy chữ thô từ HTML
               const parser = new DOMParser();
               const doc = parser.parseFromString(text, "text/html");
               const cleanText = doc.body.innerText.trim();
               
               if (cleanText.length > 0) {
                 filesData.push({ type: 'text', name: filename, content: cleanText });
               }
            }
            
            // Nếu là file ẢNH (JPG, PNG, GIF)
            else if (filename.match(/\.(jpg|jpeg|png|gif)$/i)) {
               addLog(`🖼️ Đang đọc ảnh: ${filename}`);
               const base64 = await file.async("base64");
               const imgData = `data:image/${filename.split('.').pop()};base64,${base64}`;
               filesData.push({ type: 'image', name: filename, content: imgData });
            }
          }

          if (filesData.length === 0) {
             addLog("💀 File rỗng hoặc toàn file lạ (CSS/Font/...)");
          } else {
             // Sắp xếp cho file nào có nội dung lên đầu
             filesData.sort((a, b) => a.name.localeCompare(b.name));
             setZipContents(filesData);
             addLog("🎉 XONG! Kéo xuống dưới xem ruột gan nó có gì!");
          }

        } catch (err) {
          addLog(`❌ LỖI: ${err.message}`);
        }
      };

      unzipBook();
    }
  }, [jszipStatus]);

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{borderBottom: '2px solid teal'}}>🛠️ Thợ Phá Khóa (Zip Explorer)</h1>
      
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
        {zipContents.length === 0 ? (
           <p>Đang chờ dữ liệu...</p>
        ) : (
          zipContents.map((item, idx) => (
            <div key={idx} style={{ marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '20px' }}>
              <div style={{fontWeight: 'bold', color: 'purple', marginBottom: '5px'}}>File: {item.name}</div>
              
              {item.type === 'text' ? (
                <div style={{whiteSpace: 'pre-wrap', backgroundColor: '#f9f9f9', padding: '10px', fontSize: '14px'}}>
                  {item.content.substring(0, 1000)} 
                  {item.content.length > 1000 && <span style={{color:'gray'}}>... (còn nữa)</span>}
                </div>
              ) : (
                <img src={item.content} alt={item.name} style={{maxWidth: '100%', border: '1px solid black'}} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
