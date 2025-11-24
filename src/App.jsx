import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, ChevronLeft, ChevronRight, Settings, 
  Type, Move, Maximize, Minimize, Sun, Moon, 
  Eye, X, Loader2, Github, AlignJustify, AlertCircle
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
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);

  const [prefs, setPrefs] = useState({
    fontFamily: 'Merriweather',
    fontSize: 100,
    lineHeight: 1.6,
    letterSpacing: 0,
    paragraphSpacing: 10,
    textColor: '#2d3748',
    bgColor: '#f7fafc',
    themeMode: 'light',
  });
  const [eyeCareLevel, setEyeCareLevel] = useState(0);

  const fonts = [
    { name: 'Merriweather', label: 'Bookerly (Fake)', type: 'serif' },
    { name: 'Roboto', label: 'Hiện đại', type: 'sans-serif' },
    { name: 'Patrick Hand', label: 'Ghibli Style', type: 'cursive' },
    { name: 'Lora', label: 'Báo chí', type: 'serif' },
  ];

  const colorThemes = [
    { label: 'Sáng', text: '#2d3748', bg: '#ffffff' },
    { label: 'Giấy', text: '#5f4b32', bg: '#f6eec7' },
    { label: 'Dịu', text: '#374151', bg: '#f3f4f6' },
    { label: 'Tối', text: '#e2e8f0', bg: '#1a202c' },
    { label: 'Đêm', text: '#a3a3a3', bg: '#000000' },
  ];

  const getUrlParameter = (name) => {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    var results = regex.exec(window.location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
  };

  // --- LOGIC XỬ LÝ URL ---
  const processUrl = (url) => {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
      let fileId = null;
      const match1 = url.match(/\/d\/(.+?)\//);
      const match2 = url.match(/id=(.+?)(&|$)/);
      if (match1) fileId = match1[1];
      else if (match2) fileId = match2[1];
      if (fileId) {
        return `https://corsproxy.io/?${encodeURIComponent(`https://drive.google.com/uc?export=download&id=${fileId}`)}`;
      }
    } else if (url.includes('github.com') && url.includes('/blob/')) {
      let rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      return rawUrl; 
    }
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

  // --- LOGIC LOAD SÁCH ---
  useEffect(() => {
    if (jszipStatus === 'ready' && epubStatus === 'ready' && !isReady) {
      setIsReady(true);
    }
  }, [jszipStatus, epubStatus]);

  // Load font cho trang chính
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Lora:ital@0;1&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Patrick+Hand&family=Roboto:wght@300;400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (isReady && viewerRef.current) {
      const urlParam = getUrlParameter('url') || getUrlParameter('book');
      if (!urlParam) { setLoading(false); return; }

      const bookUrl = processUrl(urlParam);
      if (book) { book.destroy(); viewerRef.current.innerHTML = ''; }

      const loadBook = async () => {
        try {
          setLoading(true);
          setLoadingStep('Đang tải file sách...');
          
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Không tải được file (Lỗi ${response.status})`);
          const arrayBuffer = await response.arrayBuffer();
          
          setLoadingStep('Đang mở sách...');
          const newBook = window.ePub(arrayBuffer);
          setBook(newBook);

          const newRendition = newBook.renderTo(viewerRef.current, {
            width: '100%', height: '100%', flow: 'scrolled-doc', manager: "continuous",
            allowScriptedContent: false
          });

          // --- QUAN TRỌNG: TIÊM FONT VÀO TRONG SÁCH ---
          newRendition.hooks.content.register((contents) => {
            const link = contents.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Lora:ital@0;1&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Patrick+Hand&family=Roboto:wght@300;400;500&display=swap';
            contents.document.head.appendChild(link);
          });

          setRendition(newRendition);
          await newRendition.display();
          
          setLoading(false);
          // Gọi update style ngay khi mở
          updateBookStyles(newRendition, prefs);

        } catch (err) {
          console.error("Lỗi:", err);
          setError(`Lỗi: ${err.message}. Link có đúng không ông giáo?`);
          setLoading(false);
        }
      };
      loadBook();
    }
  }, [isReady]);

  // --- CẬP NHẬT GIAO DIỆN (FIX MẠNH TAY HƠN) ---
  const updateBookStyles = (rend, settings) => {
    if (!rend) return;
    
    // Tạo style object mạnh mẽ hơn để ghi đè style của sách
    const styles = {
      'body': { 
        'background': `${settings.bgColor} !important`,
        'color': `${settings.textColor} !important`,
        'font-family': `"${settings.fontFamily}", serif !important`, // Thêm dấu ngoặc kép cho chắc
      },
      // Ghi đè lên tất cả các thẻ chứa text phổ biến
      'p, span, div, h1, h2, h3, h4, h5, h6, li, blockquote': {
        'font-family': `"${settings.fontFamily}", serif !important`,
        'color': `${settings.textColor} !important`,
        'line-height': `${settings.lineHeight} !important`,
      },
      'p': {
        'font-size': `${settings.fontSize}% !important`,
        'letter-spacing': `${settings.letterSpacing}px !important`,
        'padding-bottom': `${settings.paragraphSpacing}px !important`,
      },
      'a': { 'color': '#0d9488 !important' }
    };

    rend.themes.default(styles);
    
    // Force update lại view để ăn style ngay lập tức
    const location = rend.currentLocation();
    if (location && location.start) {
       rend.display(location.start.cfi);
    }
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
    <div className="fixed inset-0 pointer-events-none z-[9999] mix-blend-multiply" style={{ backgroundColor: '#ffbf00', opacity: eyeCareLevel / 100 * 0.4 }} />
  );

  const WelcomeScreen = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
      <div className="bg-white/90 p-8 rounded-3xl shadow-xl max-w-lg border-2 border-[#5f4b32]/10 backdrop-blur-sm">
        <div className="mb-4 bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-teal-700">
          <BookOpen size={32} />
        </div>
        <h1 className="text-2xl font-bold text-[#5f4b32] mb-3 font-serif">Thư Viện Ghibli</h1>
        <p className="text-gray-600 mb-6 leading-relaxed">
          Chưa có sách nào được chọn cả Trung ơi! <br/>
          Hãy thêm đường dẫn sách vào link nhé.
        </p>
        <div className="bg-gray-100 p-4 rounded-xl text-left text-sm font-mono text-gray-500 break-all border border-gray-200">
          ?url=<span className="text-teal-600">LINK_GITHUB_CUA_MAY</span>
        </div>
      </div>
    </div>
  );

  if (!isReady) return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f6eec7]">
      <Loader2 className="h-10 w-10 animate-spin text-[#5f4b32]" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-sans transition-colors duration-300" style={{ backgroundColor: prefs.bgColor, color: prefs.textColor }}>
      <EyeProtectionOverlay />
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

      {showSettings && (
        <div className="absolute top-16 right-4 w-80 max-h-[80vh] overflow-y-auto bg-white shadow-2xl rounded-2xl border border-gray-200 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
            <span className="font-bold text-sm uppercase text-gray-500">Cấu hình</span>
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
             <div className="space-y-4 pt-2 border-t">
               <div><div className="flex justify-between mb-1 text-xs text-gray-500 font-medium"><span>Cỡ chữ</span> <span>{prefs.fontSize}%</span></div><input type="range" min="50" max="200" step="10" value={prefs.fontSize} onChange={(e) => setPrefs({...prefs, fontSize: Number(e.target.value)})} className="w-full accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/></div>
               <div><div className="flex justify-between mb-1 text-xs text-gray-500 font-medium"><span className="flex items-center gap-1"><AlignJustify size={12}/> Giãn dòng</span> <span>{prefs.lineHeight}</span></div><input type="range" min="1" max="2.5" step="0.1" value={prefs.lineHeight} onChange={(e) => setPrefs({...prefs, lineHeight: Number(e.target.value)})} className="w-full accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"/></div>
             </div>
             <div className="pt-2 border-t"><div className="flex items-center gap-2 text-orange-600 font-medium mb-2"><Eye size={16}/> <span>Bảo vệ mắt</span></div><div className="flex items-center gap-3"><Moon size={14} className="text-gray-400"/><input type="range" min="0" max="100" value={eyeCareLevel} onChange={(e) => setEyeCareLevel(Number(e.target.value))} className="w-full accent-orange-500 h-2 bg-orange-100 rounded-lg appearance-none cursor-pointer"/><span className="text-xs font-bold text-orange-600 w-6">{eyeCareLevel}%</span></div></div>
          </div>
        </div>
      )}

      <div className="flex-1 relative w-full max-w-4xl mx-auto shadow-2xl my-0 md:my-4 md:rounded-lg overflow-hidden transition-all duration-300">
        {!book && !loading && !error && <WelcomeScreen />}
        {loading && (
           <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/50 backdrop-blur-sm">
             <div className="flex flex-col items-center animate-pulse">
               <Loader2 className="h-10 w-10 text-teal-600 animate-spin mb-3" />
               <p className="text-sm font-bold text-teal-800">{loadingStep}</p>
             </div>
           </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center z-20">
             <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md border border-red-100 flex flex-col items-center">
               <AlertCircle size={48} className="text-red-500 mb-4"/>
               <h3 className="font-bold text-lg text-red-600 mb-2">Hỏng rồi Trung ơi!</h3>
               <p className="text-gray-600 mb-4">{error}</p>
               <button onClick={() => window.location.reload()} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">Thử tải lại (F5)</button>
             </div>
          </div>
        ) : (
          <div ref={viewerRef} className="h-full w-full relative z-0 custom-selection" />
        )}
        {book && !loading && !error && (
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
