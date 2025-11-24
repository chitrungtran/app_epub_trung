import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Settings, Type, ZoomIn, ZoomOut, Loader2, Github } from 'lucide-react';

// Vẫn dùng CDN như cũ nha Trung, không cần cài đặt gì hết
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
      const setAttributeFromEvent = (event) => {
        script.setAttribute('data-status', event.type === 'load' ? 'ready' : 'error');
        setStatus(event.type === 'load' ? 'ready' : 'error');
      };
      script.addEventListener('load', setAttributeFromEvent);
      script.addEventListener('error', setAttributeFromEvent);
    } else {
      setStatus(script.getAttribute('data-status'));
    }
    const setStateFromEvent = (event) => { setStatus(event.type === 'load' ? 'ready' : 'error'); };
    script.addEventListener('load', setStateFromEvent);
    script.addEventListener('error', setStateFromEvent);
    return () => {
      if (script) {
        script.removeEventListener('load', setStateFromEvent);
        script.removeEventListener('error', setStateFromEvent);
      }
    };
  }, [src]);
  return status;
};

export default function App() {
  const jszipStatus = useScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js');
  const epubStatus = useScript('https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js');

  const [book, setBook] = useState(null);
  const [rendition, setRendition] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [theme, setTheme] = useState('Sepia'); // Mặc định Sepia cho nó "chill"
  const viewerRef = useRef(null);

  const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  // --- HÀM XỬ LÝ LINK THÔNG MINH (Update mới cho GitHub) ---
  const processUrl = (url) => {
    if (!url) return null;
    
    let finalUrl = url;

    // 1. Xử lý Google Drive
    if (url.includes('drive.google.com')) {
      let fileId = null;
      const match1 = url.match(/\/d\/(.+?)\//);
      const match2 = url.match(/id=(.+?)(&|$)/);
      if (match1) fileId = match1[1];
      else if (match2) fileId = match2[1];

      if (fileId) {
        finalUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }
    }
    
    // 2. Xử lý GitHub (Tính năng mới!)
    // Nếu mày copy link trên thanh địa chỉ trình duyệt: github.com/.../blob/main/sach.epub
    else if (url.includes('github.com') && url.includes('/blob/')) {
      // Tự động đổi thành link Raw: raw.githubusercontent.com/.../main/sach.epub
      finalUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }

    // 3. Đi qua Proxy để tránh lỗi CORS (Chặn bảo mật)
    // Proxy giúp web app của mày đọc được file từ domain khác
    return `https://corsproxy.io/?${encodeURIComponent(finalUrl)}`;
  };

  useEffect(() => {
    if (jszipStatus === 'ready' && epubStatus === 'ready' && !isReady) {
      setIsReady(true);
    }
  }, [jszipStatus, epubStatus]);

  useEffect(() => {
    if (isReady && viewerRef.current) {
      const urlParam = getUrlParameter('url') || getUrlParameter('book');
      // Sách demo: Moby Dick (chữ nhiều, test nhanh)
      const defaultBook = "https://s3.amazonaws.com/moby-dick/moby-dick.epub"; 
      
      const bookUrl = urlParam ? processUrl(urlParam) : defaultBook;

      if (!bookUrl) {
        setError("Link sách bị lỗi rồi mày ơi!");
        setLoading(false);
        return;
      }

      // Xóa nội dung cũ nếu có (khi reload)
      if (book) {
        book.destroy();
        viewerRef.current.innerHTML = '';
      }

      try {
        const newBook = window.ePub(bookUrl);
        setBook(newBook);

        const newRendition = newBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'scrolled-doc',
          manager: "continuous"
        });

        setRendition(newRendition);

        newRendition.display().then(() => {
          setLoading(false);
          applyTheme(newRendition, theme); // Áp dụng theme hiện tại
        }).catch(err => {
          console.error("Lỗi tải sách:", err);
          setError("Không mở được sách. Kiểm tra lại link GitHub/Drive xem đúng chưa nhé (File phải là .epub nha).");
          setLoading(false);
        });

      } catch (e) {
        console.error(e);
        setError("Lỗi trình đọc.");
        setLoading(false);
      }
    }
  }, [isReady]);

  const prevPage = () => rendition && rendition.prev();
  const nextPage = () => rendition && rendition.next();

  const changeFontSize = (delta) => {
    const newSize = fontSize + delta;
    if (newSize >= 50 && newSize <= 250) {
      setFontSize(newSize);
      if (rendition) rendition.themes.fontSize(`${newSize}%`);
    }
  };

  const applyTheme = (rend, themeName) => {
    setTheme(themeName);
    if (!rend) return;
    
    // Bộ màu Ghibli Vibes
    rend.themes.register('Light', { body: { color: '#2d3748', background: '#f7fafc' } });
    rend.themes.register('Sepia', { body: { color: '#5c4b37', background: '#efe6d5' } }); // Màu giấy cũ
    rend.themes.register('Forest', { body: { color: '#e2e8f0', background: '#2c3e35' } }); // Màu rừng đêm

    rend.themes.select(themeName);
  };

  const getThemeClass = () => {
    switch(theme) {
      case 'Sepia': return 'bg-[#efe6d5] text-[#5c4b37]';
      case 'Forest': return 'bg-[#2c3e35] text-gray-200';
      default: return 'bg-[#f7fafc] text-slate-700';
    }
  };

  if (!isReady) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#efe6d5]">
      <div className="text-center animate-bounce">
        <span className="text-4xl">🌰</span>
        <p className="mt-2 text-[#5c4b37] font-medium font-serif">Đợi xíu nha...</p>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden transition-colors duration-700 font-sans ${getThemeClass()}`}>
      
      {/* Thanh công cụ (Header) */}
      <div className="flex-none h-14 px-4 flex items-center justify-between border-b border-black/5 shadow-sm bg-white/30 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-700/10 rounded-lg">
             <BookOpen className="h-5 w-5 text-teal-700" />
          </div>
          <span className="font-bold text-lg hidden sm:block font-serif tracking-wide">Thư Viện Của Trung</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Nút hiển thị đang load từ đâu */}
          <div className="hidden md:flex text-xs opacity-60 items-center gap-1 mr-2">
            {getUrlParameter('url').includes('github') && <><Github size={12}/> <span>GitHub Source</span></>}
          </div>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full hover:bg-black/5 transition-all active:scale-95"
          >
            <Settings className="h-5 w-5 opacity-80" />
          </button>
        </div>
      </div>

      {/* Bảng cài đặt */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-72 bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-5 border border-stone-100 z-50 text-slate-700 animate-in fade-in zoom-in-95 duration-200">
          <div className="space-y-5">
            
            {/* Cỡ chữ */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Cỡ Chữ</span>
                <span className="text-xs font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-500">{fontSize}%</span>
              </div>
              <div className="flex items-center gap-2 bg-stone-50 p-1 rounded-xl border border-stone-200">
                <button onClick={() => changeFontSize(-10)} className="flex-1 p-2 hover:bg-white rounded-lg shadow-sm transition text-stone-600"><ZoomOut size={18}/></button>
                <div className="w-[1px] h-6 bg-stone-200"></div>
                <button onClick={() => changeFontSize(10)} className="flex-1 p-2 hover:bg-white rounded-lg shadow-sm transition text-stone-600"><ZoomIn size={18}/></button>
              </div>
            </div>
            
            {/* Giao diện */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2 block">Màu Nền</span>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => applyTheme(rendition, 'Light')} className={`h-10 rounded-xl border-2 flex items-center justify-center transition-all ${theme==='Light'?'border-teal-500 scale-105 shadow-md':'border-transparent bg-[#f7fafc]'}`}>
                   <span className="text-xs font-bold text-slate-600">Sáng</span>
                </button>
                <button onClick={() => applyTheme(rendition, 'Sepia')} className={`h-10 rounded-xl border-2 flex items-center justify-center transition-all ${theme==='Sepia'?'border-teal-500 scale-105 shadow-md':'border-transparent bg-[#efe6d5]'}`}>
                   <span className="text-xs font-bold text-[#5c4b37]">Giấy</span>
                </button>
                <button onClick={() => applyTheme(rendition, 'Forest')} className={`h-10 rounded-xl border-2 flex items-center justify-center transition-all ${theme==='Forest'?'border-teal-500 scale-105 shadow-md':'border-transparent bg-[#2c3e35]'}`}>
                   <span className="text-xs font-bold text-stone-300">Rừng</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Khu vực đọc sách */}
      <div className="flex-1 relative w-full max-w-5xl mx-auto shadow-2xl my-0 md:my-4 md:rounded-lg overflow-hidden bg-transparent">
        {/* Nền giấy cho đẹp */}
        <div className={`absolute inset-0 opacity-50 pointer-events-none mix-blend-multiply ${theme === 'Forest' ? 'hidden' : ''}`} style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

        {loading && (
           <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-sm">
             <div className="flex flex-col items-center animate-pulse">
               <Loader2 className="h-10 w-10 text-teal-600 animate-spin mb-3" />
               <p className="text-sm font-bold text-teal-800">Đang lấy sách từ kho...</p>
             </div>
           </div>
        )}
        
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-20">
             <div className="bg-white/90 p-8 rounded-2xl shadow-xl max-w-md border border-red-100">
               <div className="text-4xl mb-4">🍂</div>
               <h3 className="font-bold text-lg text-red-600 mb-2">Úi chà! Lỗi rồi</h3>
               <p className="text-stone-600">{error}</p>
             </div>
          </div>
        ) : (
          <div ref={viewerRef} className="h-full w-full relative z-0" />
        )}
        
        {/* Nút điều hướng Desktop */}
        {!loading && !error && (
          <>
            <button onClick={prevPage} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center bg-white/80 backdrop-blur hover:bg-white text-teal-800 rounded-full shadow-lg transition-all hover:scale-110 z-10 border border-white/50">
              <ChevronLeft size={28} />
            </button>
            <button onClick={nextPage} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center bg-white/80 backdrop-blur hover:bg-white text-teal-800 rounded-full shadow-lg transition-all hover:scale-110 z-10 border border-white/50">
              <ChevronRight size={28} />
            </button>
          </>
        )}
      </div>

      {/* Footer điều hướng Mobile */}
      <div className="md:hidden h-16 bg-white/80 backdrop-blur border-t border-black/5 flex items-center justify-between px-6 z-20 shrink-0 pb-safe">
         <button onClick={prevPage} className="flex flex-col items-center gap-1 active:scale-90 transition-transform text-slate-600 p-2">
           <ChevronLeft size={24}/>
         </button>
         <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Lật Trang</span>
         <button onClick={nextPage} className="flex flex-col items-center gap-1 active:scale-90 transition-transform text-slate-600 p-2">
           <ChevronRight size={24}/>
         </button>
      </div>
    </div>
  );
}