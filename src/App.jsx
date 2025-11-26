import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, ChevronLeft, ChevronRight, Settings, 
  Maximize, Minimize, Sun, Moon, 
  Eye, X, Loader2, AlignJustify, AlertCircle, List, Move
} from 'lucide-react';

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
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  
  const [bookTitle, setBookTitle] = useState(''); 
  
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState([]);
  
  const [progress, setProgress] = useState(0); 
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);

  const settingsRef = useRef(null); 
  const settingsBtnRef = useRef(null); 
  const tocRef = useRef(null); 
  const tocBtnRef = useRef(null); 

  // --- CẤU HÌNH MẶC ĐỊNH ---
  // Đã xóa fontFamily khỏi state vì giờ mặc định là Literata rồi, không cho chọn nữa
  const [prefs, setPrefs] = useState({
    fontSize: 100,
    lineHeight: 1.6,
    textColor: '#5f4b32',
    bgColor: '#f6eec7',
    themeMode: 'sepia',
  });
  const [eyeCareLevel, setEyeCareLevel] = useState(0);

  const colorThemes = [
    { label: 'Sáng', text: '#2d3748', bg: '#ffffff' },
    { label: 'Giấy', text: '#5f4b32', bg: '#f6eec7' },
    { label: 'Dịu', text: '#374151', bg: '#f3f4f6' },
    { label: 'Tối', text: '#e2e8f0', bg: '#1a202c' },
    { label: 'Đêm', text: '#a3a3a3', bg: '#000000' },
  ];

  // --- XỬ LÝ SỰ KIỆN ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings && settingsRef.current && !settingsRef.current.contains(event.target) && !settingsBtnRef.current.contains(event.target)) {
        setShowSettings(false);
      }
      if (showToc && tocRef.current && !tocRef.current.contains(event.target) && !tocBtnRef.current.contains(event.target)) {
        setShowToc(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings, showToc]);

  const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  const processUrl = (url) => {
    if (!url) return null;
    if (url.includes('github.com') && url.includes('/blob/')) {
       let rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
       return rawUrl;
    }
    if (url.includes('drive.google.com')) {
      let fileId = null;
      const match1 = url.match(/\/d\/(.+?)\//);
      const match2 = url.match(/id=(.+?)(&|$)/);
      if (match1) fileId = match1[1];
      else if (match2) fileId = match2[1];
      if (fileId) {
        return `https://corsproxy.io/?${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${fileId}`)}`;
      }
    }
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.warn(e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (rendition) {
         setTimeout(() => {
            rendition.resize();
            if(viewerRef.current) viewerRef.current.focus(); 
         }, 300);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [rendition]);

  useEffect(() => {
    if (jszipStatus === 'ready' && epubStatus === 'ready' && !isReady) {
      setIsReady(true);
    }
  }, [jszipStatus, epubStatus]);

  // --- NẠP FONT ---
  useEffect(() => {
    const link = document.createElement('link');
    // Chỉ nạp Literata (cho sách) và Roboto (cho UI)
    link.href = 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&family=Roboto:wght@400;500;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // --- PHÍM TẮT ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!rendition) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextChapter(); 
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        prevChapter(); 
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rendition]);

  // --- LOGIC CHÍNH: TẢI SÁCH ---
  useEffect(() => {
    if (isReady && viewerRef.current) {
      let urlParam = getUrlParameter('url') || getUrlParameter('book');
      
      if (!urlParam) { 
        setLoading(false); 
        setBookTitle(''); 
        document.title = 'Ghibli Reader';
        return; 
      }

      // 🔥 GIẢI MÃ LINK (BASE64)
      if (!urlParam.startsWith('http')) {
         try {
            urlParam = atob(urlParam);
         } catch (e) {}
      }

      const bookUrl = processUrl(urlParam);
      if (book) { book.destroy(); viewerRef.current.innerHTML = ''; }

      const loadBook = async () => {
        try {
          setLoading(true);
          setError(null);
          setBookTitle(''); 
          setLoadingStep('Đang tải sách...');
          
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải file (${response.status})`);
          
          const arrayBuffer = await response.arrayBuffer();
          setLoadingStep('Đang xử lý...');
          
          const newBook = window.ePub(arrayBuffer);
          setBook(newBook);

          const newRendition = newBook.renderTo(viewerRef.current, {
            width: '100%',
            height: '100%',
            flow: 'scrolled', 
            manager: 'continuous',
            allowScriptedContent: false
          });

          setRendition(newRendition);
          
          newRendition.on('click', () => {
             setShowSettings(false);
             setShowToc(false);
          });
          newRendition.on('touchstart', () => {
             setShowSettings(false);
             setShowToc(false);
          });
          
          await newBook.ready;

          const meta = newBook.package.metadata;
          const title = meta.title || ''; 
          setBookTitle(title); 
          if (title) document.title = title; 

          const startCfi = newBook.spine.get(0).href;
          await newRendition.display(startCfi);
          
          setLoading(false);
          
          if (viewerRef.current) { 
             viewerRef.current.focus(); 
          }
          
          // --- TIÊM FONT LITERATA VÀO SÁCH ---
          try {
             newRendition.hooks.content.register((contents) => {
                const link = contents.document.createElement('link');
                link.rel = 'stylesheet';
                link.href = 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,700;1,7..72,400&display=swap';
                contents.document.head.appendChild(link);
             });
          } catch (hookError) {
             console.warn("Lỗi font hook:", hookError);
          }

          updateBookStyles(newRendition, prefs);

          const navigation = await newBook.loaded.navigation;
          setToc(navigation.toc); 

          newRendition.on('relocated', (location) => {
             if (location && location.start) {
                const percent = newBook.locations.percentageFromCfi(location.start.cfi);
                const p = Math.floor(percent * 100);
                setProgress(isNaN(p) ? 0 : p);
             }
          });
          
          newBook.locations.generate(1000).catch(e => console.warn(e));

        } catch (err) {
          console.error("Lỗi:", err);
          setError(err.message);
          setLoading(false);
        }
      };

      loadBook();
    }
  }, [isReady]);

  // --- CẬP NHẬT STYLE CHO SÁCH (ÉP FONT LITERATA) ---
  const updateBookStyles = (rend, settings) => {
    if (!rend) return;
    try {
      rend.themes.fontSize(`${settings.fontSize}%`);
      
      const styles = {
        'body': { 
          'background': `${settings.bgColor} !important`,
          'color': `${settings.textColor} !important`,
          'padding': '20px 10px !important',
          // 👇 Ép dùng Literata, nếu lỗi thì về serif mặc định
          'font-family': '"Literata", serif !important' 
        },
        'p': {
          'line-height': `${settings.lineHeight} !important`,
          'font-size': `${settings.fontSize}% !important`,
          'color': `${settings.textColor} !important`,
          'text-align': 'justify',
          'font-family': '"Literata", serif !important'
        },
        'h1, h2, h3, h4, h5': {
           // Tiêu đề trong sách cũng dùng Literata nhưng sans-serif
           'font-family': '"Literata", sans-serif !important',
           'color': `${settings.textColor} !important`,
        },
        'a': { 'color': '#0d9488 !important' }
      };

      rend.themes.default(styles);
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    if (rendition) updateBookStyles(rendition, prefs);
  }, [prefs, rendition]);

  // --- NÚT BẤM THÔNG MINH ---
  const nextChapter = () => {
     const node = viewerRef.current;
     if (!node || !rendition) return;
     if (node.scrollTop + node.clientHeight < node.scrollHeight - 20) {
        node.scrollBy({ top: node.clientHeight * 0.8, behavior: 'smooth' }); 
     } else {
        rendition.next().then(() => { node.scrollTop = 0; }).catch(err => console.warn(err));
     }
  }

  const prevChapter = () => {
     const node = viewerRef.current;
     if (!node || !rendition) return;
     if (node.scrollTop > 20) {
        node.scrollBy({ top: -(node.clientHeight * 0.8), behavior: 'smooth' });
     } else {
        rendition.prev().then(() => { node.scrollTop = 0; }).catch(err => console.warn(err));
     }
  }

  const navigateToChapter = (href) => {
    if (rendition) {
      rendition.display(href).then(() => {
         setShowToc(false);
         if(viewerRef.current) viewerRef.current.scrollTop = 0;
      }).catch(err => console.warn("Lỗi nhảy trang:", err));
    }
  };

  const toggleTheme = () => {
    if (prefs.themeMode === 'dark') { applyColorTheme(colorThemes[1]); } 
    else { applyColorTheme(colorThemes[3]); }
  }

  const applyColorTheme = (theme) => {
    const isDark = theme.bg === '#000000' || theme.bg === '#1a202c';
    setPrefs(prev => ({
      ...prev,
      textColor: theme.text,
      bgColor: theme.bg,
      themeMode: isDark ? 'dark' : 'light'
    }));
  };

  const EyeProtectionOverlay = () => (
    <div className="fixed inset-0 pointer-events-none z-[9999] mix-blend-multiply" style={{ backgroundColor: '#ffbf00', opacity: eyeCareLevel / 100 * 0.4 }} />
  );

  const WelcomeScreen = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
      <div className="bg-white/90 p-8 rounded-3xl shadow-xl max-w-lg border-2 border-[#5f4b32]/10 backdrop-blur-sm">
        <div className="mb-4 bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-teal-700">
          <BookOpen size={32} />
        </div>
        <h1 className="text-2xl font-bold text-[#5f4b32] mb-3 font-serif font-sans">Thư Viện Ghibli</h1>
        <p className="text-gray-600 mb-6 font-sans">Chưa có sách nào được chọn cả Trung ơi!</p>
      </div>
    </div>
  );

  if (!isReady) return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-[#f6eec7] gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-[#5f4b32]" />
      <p className="text-[#5f4b32] font-medium animate-pulse font-sans">Đang chuẩn bị thư viện...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-sans transition-colors duration-300" style={{ backgroundColor: prefs.bgColor, color: prefs.textColor }}>
      <EyeProtectionOverlay />
      
      <div className="flex-none h-14 px-4 flex items-center justify-between border-b border-gray-400/20 backdrop-blur-sm z-50 relative">
        <div className="flex items-center gap-2 overflow-hidden"> 
          <BookOpen size={20} className="text-teal-600 flex-shrink-0" />
          {/* TIÊU ĐỀ APP: Roboto (font-sans) */}
          <span 
            className="font-bold text-lg hidden sm:block truncate max-w-[200px] md:max-w-xs text-teal-900 font-sans" 
            title={bookTitle}
          >
            {bookTitle}
          </span>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button 
            ref={tocBtnRef}
            onClick={() => { setShowToc(!showToc); setShowSettings(false); }} 
            className={`p-2 rounded-full transition-colors ${showToc ? 'bg-teal-100 text-teal-800' : 'hover:bg-gray-400/20'}`}
            title="Mục lục"
          >
            <List size={20} />
          </button>

          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-400/20 transition-colors">
            {prefs.themeMode === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
          
          <button 
            ref={settingsBtnRef}
            onClick={() => { setShowSettings(!showSettings); setShowToc(false); }} 
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-teal-100 text-teal-800' : 'hover:bg-gray-400/20'}`}
          >
            <Settings size={20} />
          </button>
          
          <button 
            onClick={toggleFullscreen} 
            className="hidden md:block p-2 rounded-full hover:bg-gray-400/20 transition-colors"
          >
            {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
          </button>
        </div>
      </div>

      {/* Bảng Mục lục */}
      {showToc && (
        <div 
          ref={tocRef} 
          onMouseLeave={() => setShowToc(false)} 
          className="absolute top-16 right-4 md:right-20 w-72 max-h-[70vh] overflow-y-auto bg-white shadow-2xl rounded-2xl border border-gray-200 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-200"
        >
           <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl sticky top-0 z-10 bg-white"><span className="font-bold text-sm uppercase text-gray-500 flex items-center gap-2 font-sans"><List size={16}/> Mục lục</span><button onClick={() => setShowToc(false)}><X size={18} className="text-gray-400 hover:text-red-500"/></button></div>
           <div className="p-2">{toc.length > 0 ? (<ul className="space-y-1">{toc.map((chapter, index) => (<li key={index}><button onClick={() => navigateToChapter(chapter.href)} className="w-full text-left px-4 py-3 text-sm hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors border-b border-gray-50 last:border-0 font-sans">{chapter.label ? chapter.label.trim() : `Chương ${index + 1}`}</button></li>))}</ul>) : (<div className="p-4 text-center text-gray-400 text-sm font-sans">Không tìm thấy mục lục</div>)}</div>
        </div>
      )}

      {/* Bảng Cài đặt (Đã xóa chọn Font) */}
      {showSettings && (
        <div 
          ref={settingsRef} 
          onMouseLeave={() => setShowSettings(false)} 
          className="absolute top-16 right-4 w-80 max-h-[80vh] overflow-y-auto bg-white shadow-2xl rounded-2xl border border-gray-200 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-200"
        >
           <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl"><span className="font-bold text-sm uppercase text-gray-500 font-sans">Cấu hình</span><button onClick={() => setShowSettings(false)}><X size={18} className="text-gray-400 hover:text-red-500"/></button></div>
           <div className="p-5 space-y-6">
            
            <div className="space-y-2"><div className="flex items-center gap-2 text-teal-700 font-medium font-sans"><Sun size={16}/> <span>Màu giấy</span></div><div className="flex gap-2 overflow-x-auto pb-2 custom-scroll">{colorThemes.map((c, idx) => (<button key={idx} onClick={() => applyColorTheme(c)} className={`flex-shrink-0 w-10 h-10 rounded-full border-2 shadow-sm flex items-center justify-center ${prefs.bgColor === c.bg ? 'border-teal-500 scale-110' : 'border-gray-200'}`} style={{ backgroundColor: c.bg }} title={c.label}><span className="text-[10px] font-bold" style={{color: c.text}}>Aa</span></button>))}</div></div>
            
            <div className="space-y-4 pt-2 border-t"><div><div className="flex justify-between mb-1 text-xs text-gray-500 font-medium font-sans"><span>Cỡ chữ</span> <span>{prefs.fontSize}%</span></div><input type="range" min="50" max="200" step="10" value={prefs.fontSize} onChange={(e) => setPrefs({...prefs, fontSize: Number(e.target.value)})} className="w-full accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/></div><div><div className="flex justify-between mb-1 text-xs text-gray-500 font-medium font-sans"><span className="flex items-center gap-1"><AlignJustify size={12}/> Giãn dòng</span> <span>{prefs.lineHeight}</span></div><input type="range" min="1" max="2.5" step="0.1" value={prefs.lineHeight} onChange={(e) => setPrefs({...prefs, lineHeight: Number(e.target.value)})} className="w-full accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/></div></div>
            <div className="pt-2 border-t"><div className="flex items-center gap-2 text-orange-600 font-medium mb-2 font-sans"><Eye size={16}/> <span>Bảo vệ mắt</span></div><div className="flex items-center gap-3"><Moon size={14} className="text-gray-400"/><input type="range" min="0" max="100" value={eyeCareLevel} onChange={(e) => setEyeCareLevel(Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-orange-100 rounded-lg appearance-none cursor-pointer"/><span className="text-xs font-bold text-orange-600 w-6 font-sans">{eyeCareLevel}%</span></div></div>
           </div>
        </div>
      )}

      <div className="flex-1 relative w-full max-w-4xl mx-auto shadow-2xl my-0 md:my-4 md:rounded-lg overflow-hidden transition-all duration-300">
        {!book && !loading && !error && <WelcomeScreen />}
        {loading && (
           <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-sm">
             <div className="flex flex-col items-center animate-pulse">
               <Loader2 className="h-10 w-10 text-teal-600 animate-spin mb-3" />
               <p className="text-sm font-bold text-teal-800 font-sans">{loadingStep}</p>
             </div>
           </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-20"><div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border border-red-100 flex flex-col items-center"><AlertCircle size={48} className="text-red-500 mb-4"/><h3 className="font-bold text-lg text-red-600 mb-2 font-sans">Có lỗi rồi Trung ơi!</h3><p className="text-gray-600 mb-4 text-center font-sans">{error}</p><button onClick={() => window.location.reload()} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-sans">Thử tải lại (F5)</button></div></div>
        ) : (
          <div 
            ref={viewerRef} 
            tabIndex={0} 
            onTouchStart={() => {}} 
            className="h-full w-full relative z-0 custom-selection overflow-y-auto outline-none pb-8" 
          />
        )}
        
        {book && !loading && !error && (
          <>
            <button onClick={prevChapter} className="hidden md:flex absolute left-4 bottom-10 p-4 bg-teal-700/80 hover:bg-teal-600 text-white rounded-full shadow-lg transition-all z-30 items-center justify-center group" title="Chương trước"><ChevronLeft size={24} className="group-active:-translate-x-1 transition-transform" /></button>
            <button onClick={nextChapter} className="hidden md:flex absolute right-4 bottom-10 p-4 bg-teal-700/80 hover:bg-teal-600 text-white rounded-full shadow-lg transition-all z-30 items-center justify-center group" title="Chương sau"><ChevronRight size={24} className="group-active:translate-x-1 transition-transform" /></button>
          </>
        )}
      </div>

      {book && !loading && !error && (
        <div className="fixed bottom-0 w-full h-8 bg-white/90 backdrop-blur-md border-t border-gray-200 flex items-center justify-between px-4 text-xs font-mono text-teal-800 z-50 shadow-lg md:hidden font-sans">
           <span>Đã đọc</span>
           <span className="font-bold text-sm">{progress}%</span>
           <div className="absolute top-0 left-0 h-[2px] bg-teal-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      <div className="md:hidden h-14 border-t border-gray-400/20 flex items-center justify-between px-6 z-40 bg-inherit backdrop-blur-md mb-8">
         <button onClick={prevChapter} className="p-3 active:scale-95 opacity-70 flex flex-col items-center"><ChevronLeft size={24}/><span className="text-[10px] font-sans">Trước</span></button>
         <div className="flex gap-4">
            <button onClick={() => setShowToc(!showToc)}><List size={20} className="opacity-60"/></button>
            <button onClick={() => setShowSettings(!showSettings)}><Settings size={20} className="opacity-60"/></button>
         </div>
         <button onClick={nextChapter} className="p-3 active:scale-95 opacity-70 flex flex-col items-center"><ChevronRight size={24}/><span className="text-[10px] font-sans">Sau</span></button>
      </div>

      {/* FOOTER PC: Roboto (font-sans) */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-8 bg-white/90 backdrop-blur border-t border-gray-200 items-center justify-between px-6 text-xs text-gray-600 z-50 font-sans">
         <span className="font-medium truncate max-w-[200px] md:max-w-sm lg:max-w-md" title={bookTitle}>
            {bookTitle}
         </span>
         <div className="flex items-center gap-2"><span>Tiến độ:</span><span className="font-mono font-bold text-teal-700">{progress}%</span></div>
         <div className="absolute top-0 left-0 h-[3px] bg-teal-600 transition-all duration-500 shadow-sm" style={{ width: `${progress}%` }}></div>
      </div>

      <style>{`
        /* Ép toàn bộ giao diện dùng Roboto */
        .font-sans, body, button, input { font-family: 'Roboto', sans-serif !important; }
        
        .custom-scroll::-webkit-scrollbar { height: 4px; } 
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } 
        ::selection { background: #14b8a6; color: white; } 
        .epub-container iframe { overflow: hidden !important; }
        .custom-selection {
           -webkit-overflow-scrolling: touch !important;
           overflow-y: auto !important;
        }
      `}</style>
    </div>
  );
}
