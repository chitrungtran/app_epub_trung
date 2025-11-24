import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Settings, Loader2, AlertCircle } from 'lucide-react';

// --- HÀM LOAD THƯ VIỆN GIỮ NGUYÊN ---
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

  const [book, setBook] = useState(null);
  const [rendition, setRendition] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const viewerRef = useRef(null);
  
  // Cấu hình mặc định
  const [fontSize, setFontSize] = useState(100);

  // --- HÀM XỬ LÝ LINK (QUAN TRỌNG NHẤT) ---
  const getProcessedUrl = (url) => {
    if (!url) return null;
    
    // Nếu là link GitHub -> Chuyển sang RAW + qua Proxy luôn cho chắc
    if (url.includes('github.com') && url.includes('/blob/')) {
       // Bước 1: Lấy link Raw gốc
       const rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
       // Bước 2: Bọc qua Proxy để né CORS
       return `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
    }
    
    // Link thường -> Cũng qua Proxy luôn
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  };

  const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  useEffect(() => {
    if (jszipStatus === 'ready' && epubStatus === 'ready' && !isReady) {
      setIsReady(true);
    }
  }, [jszipStatus, epubStatus]);

  // --- LOGIC MỞ SÁCH ---
  useEffect(() => {
    if (isReady && viewerRef.current) {
      const urlParam = getUrlParameter('url') || getUrlParameter('book');
      if (!urlParam) { setLoading(false); return; }

      // Reset
      if (book) { book.destroy(); viewerRef.current.innerHTML = ''; }
      setError(null);
      setLoading(true);

      const finalUrl = getProcessedUrl(urlParam);
      console.log("Opening URL:", finalUrl);

      try {
        // CÁCH MỚI: Đưa link trực tiếp cho ePub tự xử lý (không fetch thủ công nữa)
        const newBook = window.ePub(finalUrl);
        setBook(newBook);

        const newRendition = newBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'scrolled-doc', // Chế độ cuộn (ổn định hơn lật trang)
          manager: "continuous"
        });

        setRendition(newRendition);

        // Hiển thị sách
        newRendition.display().then(() => {
          setLoading(false);
          // Set font size mặc định
          newRendition.themes.fontSize(`${fontSize}%`);
        }).catch(err => {
          console.error("Render Error:", err);
          setLoading(false);
          // Nếu lỗi, thử hiển thị lại lần nữa sau 1s (Force retry)
          setTimeout(() => {
             newRendition.display();
          }, 1000);
        });

      } catch (e) {
        console.error("Init Error:", e);
        setError("Lỗi khởi tạo: " + e.message);
        setLoading(false);
      }
    }
  }, [isReady]);

  // Điều khiển lật trang
  const prevPage = () => rendition && rendition.prev();
  const nextPage = () => rendition && rendition.next();
  const zoomIn = () => {
     const newSize = fontSize + 10;
     setFontSize(newSize);
     if(rendition) rendition.themes.fontSize(`${newSize}%`);
  };
  const zoomOut = () => {
     const newSize = fontSize - 10;
     setFontSize(newSize);
     if(rendition) rendition.themes.fontSize(`${newSize}%`);
  };

  if (!isReady) return (
    <div className="flex h-screen items-center justify-center bg-[#f6eec7]">
      <Loader2 className="h-10 w-10 animate-spin text-[#5f4b32]" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full bg-[#f6eec7] text-[#5f4b32] font-serif">
      {/* Header đơn giản */}
      <div className="h-14 border-b border-[#5f4b32]/10 flex items-center justify-between px-4 bg-white/50 backdrop-blur">
        <div className="flex items-center gap-2 font-bold"><BookOpen size={20}/> Ghibli Reader</div>
        <div className="flex gap-2">
           <button onClick={zoomOut} className="p-2 bg-white/80 rounded shadow-sm hover:bg-white">-</button>
           <span className="flex items-center px-2 text-sm">{fontSize}%</span>
           <button onClick={zoomIn} className="p-2 bg-white/80 rounded shadow-sm hover:bg-white">+</button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f6eec7] z-20">
            <Loader2 className="h-12 w-12 animate-spin text-teal-600 mb-2"/>
            <p className="animate-pulse">Đang mở sách...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
             <div className="bg-white p-6 rounded-xl shadow-xl text-center border border-red-200">
               <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2"/>
               <p className="text-red-600 font-medium">{error}</p>
             </div>
          </div>
        )}

        {/* Khung đọc sách */}
        <div ref={viewerRef} className="h-full w-full" />
        
        {/* Nút điều hướng */}
        <button onClick={prevPage} className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-white/80 rounded-full shadow-lg hover:scale-110 transition z-10"><ChevronLeft/></button>
        <button onClick={nextPage} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-white/80 rounded-full shadow-lg hover:scale-110 transition z-10"><ChevronRight/></button>
      </div>
    </div>
  );
}
