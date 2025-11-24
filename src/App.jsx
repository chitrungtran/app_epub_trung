import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, ChevronLeft, ChevronRight, Settings, 
  Type, Move, Maximize, Minimize, Sun, Moon, 
  Eye, X, Loader2, Github, AlignJustify
} from 'lucide-react';

// --- HÀM LOAD THƯ VIỆN NGOÀI (GIỮ NGUYÊN) ---
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
  // Load thư viện
  const jszipStatus = useScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.5/jszip.min.js');
  const epubStatus = useScript('https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js');

  // --- TRẠNG THÁI (STATE) ---
  const [book, setBook] = useState(null);
  const [rendition, setRendition] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);

  // Cấu hình đọc sách (Settings)
  const [prefs, setPrefs] = useState({
    fontFamily: 'Merriweather', // Giống Bookerly
    fontSize: 100,
    lineHeight: 1.6,
    letterSpacing: 0,
    paragraphSpacing: 10,
    textColor: '#2d3748',
    bgColor: '#f7fafc',
    themeMode: 'light', // light | dark
  });

  // Chế độ bảo vệ mắt (0 - 100)
  const [eyeCareLevel, setEyeCareLevel] = useState(0);

  // --- DANH SÁCH FONT & MÀU ---
  const fonts = [
    { name: 'Merriweather', label: 'Bookerly (Fake)', type: 'serif' },
    { name: 'Roboto', label: 'Hiện đại', type: 'sans-serif' },
    { name: 'Patrick Hand', label: 'Ghibli Style', type: 'cursive' },
    { name: 'Lora', label: 'Báo chí', type: 'serif' },
  ];

  const colorThemes = [
    { label: 'Sáng', text: '#2d3748', bg: '#ffffff' },
    { label: 'Giấy', text: '#5f4b32', bg: '#f6eec7' }, // Vàng Ghibli
    { label: 'Dịu', text: '#374151', bg: '#f3f4f6' },
    { label: 'Tối', text: '#e2e8f0', bg: '#1a202c' },
    { label: 'Đêm', text: '#a3a3a3', bg: '#000000' },
  ];

  // --- HÀM TIỆN ÍCH ---
  const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  // --- HÀM XỬ LÝ LINK THÔNG MINH (Update mới: Bỏ Proxy cho GitHub) ---
  const processUrl = (url) => {
    if (!url) return null;
    
    // 1. Xử lý Google Drive (Vẫn cần Proxy)
    if (url.includes('drive.google.com')) {
      let fileId = null;
      const match1 = url.match(/\/d\/(.+?)\//);
      const match2 = url.match(/id=(.+?)(&|$)/);
      if (match1) fileId = match1[1];
      else if (match2) fileId = match2[1];
      
      if (fileId) {
        const directLink = `https://drive.google.com/uc?export=download&id=${fileId}`;
        return `https://corsproxy.io/?${encodeURIComponent(directLink)}`;
      }
    }
    
    // 2. Xử lý GitHub (Đi đường thẳng - KHÔNG CẦN Proxy)
    else if (url.includes('github.com') && url.includes('/blob/')) {
      // Đổi thành link Raw
      let rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      // Encode lại URL để xử lý các ký tự đặc biệt như dấu cách (%20)
      return encodeURI(rawUrl);
    }

    // 3. Link khác (Giữ Proxy dự phòng)
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // --- KHỞI TẠO APP ---
  useEffect(() => {
    if (jszipStatus === 'ready' && epubStatus === 'ready' && !isReady) {
      setIsReady(true);
    }
  }, [jszipStatus, epubStatus]);

  // Inject Google Fonts vào đầu trang
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Lora:ital@0;1&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Patrick+Hand&family=Roboto:wght@300;400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // --- XỬ LÝ SÁCH ---
  useEffect(() => {
    if (isReady && viewerRef.current) {
      const urlParam = getUrlParameter('url') || getUrlParameter('book');
      const defaultBook = "https://s3.amazonaws.com/moby-dick/moby-dick.epub"; 
      
      // Xử lý link
      const bookUrl = urlParam ? processUrl(urlParam) : defaultBook;
      console.log("Đang tải sách từ:", bookUrl); // Log để debug

      if (!bookUrl) { setError("Không có link sách!"); setLoading(false); return; }

      if (book) { book.destroy(); viewerRef.current.innerHTML = ''; }

      try {
        const newBook = window.ePub(bookUrl);
        setBook(newBook);

        const newRendition = newBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'scrolled-doc',
          manager: "continuous",
          allowScriptedContent: false
        });

        setRendition(newRendition);

        newRendition.display().then(() => {
          setLoading(false);
          updateBookStyles(newRendition, prefs);
        }).catch(err => {
          console.error("Lỗi loading:", err);
          setError("Không tải được sách. Có thể link GitHub bị sai hoặc file quá nặng. Hãy thử F5 lại nhé!");
          setLoading(false);
        });

      } catch (e) {
        console.error(e);
        setError("Lỗi khởi tạo trình đọc.");
        setLoading(false);
      }
    }
  }, [isReady]);

  // --- CẬP NHẬT GIAO DIỆN SÁCH ---
  const updateBookStyles = (rend, settings) => {
    if (!rend) return;
    rend.themes.default({
      'body': { 
        'background': `${settings.bgColor} !important`,
        'color': `${settings.textColor} !important`,
        'font-family': `${settings.fontFamily}, serif !important`,
      },
      'p': {
        'font-family': `${settings.fontFamily}, serif !important`,
        'line-height': `${settings.lineHeight} !important`,
        'font-size': `${settings.fontSize}% !important`,
        'letter-spacing': `${settings.letterSpacing}px !important`,
        'padding-bottom': `${settings.paragraphSpacing}px !important`,
        'color': `${settings.textColor} !important`
      },
      'h1, h2, h3, h4, h5, h6': {
        'font-family': `${settings.fontFamily}, sans-serif !important`,
        'color': `${settings.textColor} !important`
      },
      'a': { 'color': '#0d9488 !important' }
    });
  };

  useEffect(() => {
    if (rendition) updateBookStyles(rendition, prefs);
  }, [prefs, rendition]);

  const prevPage = () => rendition && rendition.prev();
  const nextPage = () => rendition && rendition.next();

  const applyColorTheme = (theme) => {
    setPrefs(prev => ({
      ...prev,
      textColor: theme.text,
      bgColor: theme.bg,
      themeMode: theme.bg === '#000000' || theme.bg === '#1a202c' ? 'dark' : 'light'
    }));
  };

  const EyeProtectionOverlay = () => (
    <div 
      className="fixed inset-0 pointer-events-none z-[9999] mix-blend-multiply"
      style={{ 
        backgroundColor: '#ffbf00', opacity: eyeCareLevel / 100 * 0.4 
      }} 
    />
  );

  if (!isReady) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f6eec7]">
      <Loader2 className="h-10 w-10 animate-spin text-[#5f4b32]" />
    </div>
  );

  return (
    <div 
      className="flex flex-col h-screen w-full overflow-hidden font-sans transition-colors duration-300"
      style={{ backgroundColor: prefs.bgColor, color: prefs.textColor }}
    >
      <EyeProtectionOverlay />

      {/* HEADER */}
      <div className="flex-none h-14 px-4 flex items-center justify-between border-b border-gray-400/20 backdrop-blur-sm z-50 relative">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-teal-600" />
          <span className="font-bold text-lg hidden sm:block font-serif">Ghibli Reader Pro</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => applyColorTheme(prefs.themeMode === 'light' ? colorThemes[3] : colorThemes[0])} className="p-2 rounded-full hover:bg-gray-400/20 transition-colors">
            {prefs.themeMode === 'light' ? <Moon size={20}/> : <Sun size={20}/>}
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-teal-100 text-teal-800' : 'hover:bg-gray-400/20'}`}>
            <Settings size={20} />
          </button>
          <button onClick={toggleFullscreen} className="p-2 rounded-full hover:bg-gray-400/20 transition-colors hidden sm:block">
            {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
          </button>
        </div>
      </div>

      {/* SETTINGS PANEL */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-80 max-h-[80vh] overflow-y-auto bg-white shadow-2xl rounded-2xl border border-gray-200 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
            <span className="font-bold text-sm uppercase text-gray-500">Cấu hình đọc sách</span>
            <button onClick={() => setShowSettings(false)}><X size={18} className="text-gray-400 hover:text-red-500"/></button>
          </div>
          <div className="p-5 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-teal-700 font-medium"><Type size={16}/> <span>Phông chữ</span></div>
              <div className="grid grid-cols-2 gap-2">
                {fonts.map(f => (
                  <button key={f.name} onClick={() => setPrefs({...prefs, fontFamily: f.name})} className={`px-3 py-2 text-sm border rounded-lg text-left transition-all ${prefs.fontFamily === f.name ? 'border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500' : 'hover:bg-gray-50'}`} style={{ fontFamily: f.name }}>{f.label}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-teal-700 font-medium"><Sun size={16}/> <span>Màu giấy</span></div>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scroll">
                {colorThemes.map((c, idx) => (
                  <button key={idx} onClick={() => applyColorTheme(c)} className={`flex-shrink-0 w-10 h-10 rounded-full border-2 shadow-sm flex items-center justify-center ${prefs.bgColor === c.bg ? 'border-teal-500 scale-110' : 'border-gray-200'}`} style={{ backgroundColor: c.bg }} title={c.label}>
                    <span className="text-[10px] font-bold" style={{color: c.text}}>Aa</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-4 pt-2 border-t">
               <div>
                 <div className="flex justify-between mb-1 text-xs text-gray-500 font-medium"><span>Cỡ chữ</span> <span>{prefs.fontSize}%</span></div>
                 <input type="range" min="50" max="200" step="10" value={prefs.fontSize} onChange={(e) => setPrefs({...prefs, fontSize: Number(e.target.value)})} className="w-full accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
               </div>
               <div>
                 <div className="flex justify-between mb-1 text-xs text-gray-500 font-medium"><span className="flex items-center gap-1"><AlignJustify size={12}/> Giãn dòng</span> <span>{prefs.lineHeight}</span></div>
                 <input type="range" min="1" max="2.5" step="0.1" value={prefs.lineHeight} onChange={(e) => setPrefs({...prefs, lineHeight: Number(e.target.value)})} className="w-full accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
               </div>
               <div>
                 <div className="flex justify-between mb-1 text-xs text-gray-500 font-medium"><span className="flex items-center gap-1"><Move size={12} className="rotate-90"/> Giãn đoạn</span> <span>{prefs.paragraphSpacing}px</span></div>
                 <input type="range" min="0" max="50" step="5" value={prefs.paragraphSpacing} onChange={(e) => setPrefs({...prefs, paragraphSpacing: Number(e.target.value)})} className="w-full accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/>
               </div>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-orange-600 font-medium mb-2"><Eye size={16}/> <span>Bảo vệ mắt</span></div>
              <div className="flex items-center gap-3">
                <Moon size={14} className="text-gray-400"/>
                <input type="range" min="0" max="100" value={eyeCareLevel} onChange={(e) => setEyeCareLevel(Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-orange-100 rounded-lg appearance-none cursor-pointer"/>
                <span className="text-xs font-bold text-orange-600 w-6">{eyeCareLevel}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* READER AREA */}
      <div className="flex-1 relative w-full max-w-4xl mx-auto shadow-2xl my-0 md:my-4 md:rounded-lg overflow-hidden transition-all duration-300">
        {loading && (
           <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-sm">
             <div className="flex flex-col items-center animate-pulse">
               <Loader2 className="h-10 w-10 text-teal-600 animate-spin mb-3" />
               <p className="text-sm font-bold text-teal-800">Đang lấy sách...</p>
             </div>
           </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-20">
             <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border border-red-100">
               <h3 className="font-bold text-lg text-red-600 mb-2">Lỗi rồi Trung ơi!</h3>
               <p className="text-gray-600">{error}</p>
             </div>
          </div>
        ) : (
          <div ref={viewerRef} className="h-full w-full relative z-0 custom-selection" />
        )}
        {!loading && !error && (
          <>
            <button onClick={prevPage} className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full hover:bg-gray-500/20 transition-all z-10">
              <ChevronLeft size={32} strokeWidth={1.5} style={{color: prefs.textColor, opacity: 0.5}}/>
            </button>
            <button onClick={nextPage} className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 items-center justify-center rounded-full hover:bg-gray-500/20 transition-all z-10">
              <ChevronRight size={32} strokeWidth={1.5} style={{color: prefs.textColor, opacity: 0.5}}/>
            </button>
          </>
        )}
      </div>

      {/* FOOTER MOBILE */}
      <div className="md:hidden h-14 border-t border-gray-400/20 flex items-center justify-between px-6 z-40 bg-inherit backdrop-blur-md">
         <button onClick={prevPage} className="p-3 active:scale-95 opacity-70"><ChevronLeft size={24}/></button>
         <div className="flex gap-4">
            <button onClick={() => setShowSettings(!showSettings)}><Settings size={20} className="opacity-60"/></button>
            <button onClick={() => setEyeCareLevel(val => val > 0 ? 0 : 50)}><Eye size={20} className={eyeCareLevel > 0 ? "text-orange-500" : "opacity-60"}/></button>
         </div>
         <button onClick={nextPage} className="p-3 active:scale-95 opacity-70"><ChevronRight size={24}/></button>
      </div>

      <style>{`
        .custom-scroll::-webkit-scrollbar { height: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::selection { background: #14b8a6; color: white; }
        .epub-container iframe { overflow: hidden !important; }
      `}</style>
    </div>
  );
}
