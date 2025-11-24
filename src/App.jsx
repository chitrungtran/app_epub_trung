import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, ChevronLeft, ChevronRight, Settings, 
  Type, Move, Maximize, Minimize, Sun, Moon, 
  Eye, X, Loader2, AlignJustify, AlertCircle, List
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
  
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState([]);
  
  const [progress, setProgress] = useState(0); 

  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);

  const [prefs, setPrefs] = useState({
    fontFamily: 'Merriweather',
    fontSize: 100,
    lineHeight: 1.6,
    letterSpacing: 0,
    paragraphSpacing: 10,
    textColor: '#5f4b32',
    bgColor: '#f6eec7',
    themeMode: 'sepia',
  });
  const [eyeCareLevel, setEyeCareLevel] = useState(0);

  const fonts = [
    { name: 'Merriweather', label: 'Sách Giấy', type: 'serif' },
    { name: 'Roboto', label: 'Hiện đại', type: 'sans-serif' },
    { name: 'Patrick Hand', label: 'Viết Tay', type: 'cursive' },
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

  const processUrl = (url) => {
    if (!url) return null;
    if (url.includes('github.com') && url.includes('/blob/')) {
       let cdnUrl = url.replace('github.com', 'cdn.jsdelivr.net/gh');
       cdnUrl = cdnUrl.replace('/blob/', '@');
       return cdnUrl;
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
      document.documentElement.requestFullscreen().catch(e => {
         // Một số trình duyệt mobile chặn fullscreen nếu không phải do người dùng bấm trực tiếp
         console.warn("Không thể fullscreen:", e);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    if (jszipStatus === 'ready' && epubStatus === 'ready' && !isReady) {
      setIsReady(true);
    }
  }, [jszipStatus, epubStatus]);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Lora:ital@0;1&family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Patrick+Hand&family=Roboto:wght@300;400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!rendition) return;
      if (e.key === 'ArrowDown') {
        if (viewerRef.current) viewerRef.current.scrollBy({ top: 100, behavior: 'smooth' });
        e.preventDefault();
      }
      if (e.key === 'ArrowUp') {
        if (viewerRef.current) viewerRef.current.scrollBy({ top: -100, behavior: 'smooth' });
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') nextChapter();
      if (e.key === 'ArrowLeft') prevChapter();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rendition]);

  useEffect(() => {
    if (isReady && viewerRef.current) {
      const urlParam = getUrlParameter('url') || getUrlParameter('book');
      if (!urlParam) { setLoading(false); return; }

      const bookUrl = processUrl(urlParam);
      if (book) { book.destroy(); viewerRef.current.innerHTML = ''; }

      const loadBook = async () => {
        try {
          setLoading(true);
          setError(null);
          setLoadingStep('Đang tải sách về máy...');
          
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải file (${response.status})`);
          
          const arrayBuffer = await response.arrayBuffer();
          setLoadingStep('Đang mở trang sách...');
          
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
          
          await newBook.ready;
          
          newBook.locations.generate(1000).then(() => {
             console.log("Generated locations");
          }).catch(e => console.warn(e));

          const startCfi = newBook.spine.get(0).href;
          await newRendition.display(startCfi);
          
          setLoading(false);
          
          if (viewerRef.current) { viewerRef.current.focus(); }
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

        } catch (err) {
          console.error("Lỗi:", err);
          setError(err.message);
          setLoading(false);
        }
      };

      loadBook();
    }
  }, [isReady]);

  const updateBookStyles = (rend, settings) => {
    if (!rend) return;
    try {
      rend.themes.font(settings.fontFamily);
      rend.themes.fontSize(`${settings.fontSize}%`);
      rend.themes.default({
        'body': { 
          'background': `${settings.bgColor} !important`,
          'color': `${settings.textColor} !important`,
          'font-family': `${settings.fontFamily}, serif !important`,
          'padding': '20px 10px !important'
        },
        'p': {
          'font-family': `${settings.fontFamily}, serif !important`,
          'line-height': `${settings.lineHeight} !important`,
          'font-size': `${settings.fontSize}% !important`,
          'color': `${settings.textColor} !important`,
          'text-align': 'justify'
        },
        'a': { 'color': '#0d9488 !important' }
      });
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    if (rendition) updateBookStyles(rendition, prefs);
  }, [prefs, rendition]);

  const nextChapter = () => {
     if (rendition) {
       rendition.next().then(() => {
          if(viewerRef.current) viewerRef.current.scrollTop = 0;
       });
     }
  }
  const prevChapter = () => {
     if (rendition) {
       rendition.prev().then(() => {
          if(viewerRef.current) viewerRef.current.scrollTop = 0;
       });
     }
  }

  const navigateToChapter = (href) => {
    if (rendition) {
      const cleanHref = href.split('#')[0]; 
      rendition.display(cleanHref).then(() => {
         setShowToc(false);
         if(viewerRef.current) viewerRef.current.scrollTop = 0;
      }).catch(err => console.warn("Lỗi nhảy trang:", err));
    }
  };

  const toggleTheme = () => {
    if (prefs.themeMode === 'dark') {
      applyColorTheme(colorThemes[1]); 
    } else {
      applyColorTheme(colorThemes[3]); 
    }
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
        <h1 className="text-2xl font-bold text-[#5f4b32] mb-3 font-serif">Thư Viện Ghibli</h1>
        <p className="text-gray-600 mb-6">Chưa có sách nào được chọn cả Trung ơi!</p>
      </div>
    </div>
  );

  if (!isReady) return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-[#f6eec7] gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-[#5f4b32]" />
      <p className="text-[#5f4b32] font-medium animate-pulse">Đang chuẩn bị thư viện...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-sans transition-colors duration-300" style={{ backgroundColor: prefs.bgColor, color: prefs.textColor }}>
      <EyeProtectionOverlay />
      
      {/* Header */}
      <div className="flex-none h-14 px-4 flex items-center justify-between border-b border-gray-400/20 backdrop-blur-sm z-50 relative">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-teal-600" />
          {/* Ẩn chữ Ghibli Reader Pro trên mobile để có chỗ cho nút */}
          <span className="font-bold text-lg hidden sm:block font-serif">Ghibli Reader Pro</span>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
          {/* NÚT MỤC LỤC */}
          <button 
            onClick={() => { setShowToc(!showToc); setShowSettings(false); }} 
            className={`p-2 rounded-full transition-colors ${showToc ? 'bg-teal-100 text-teal-800' : 'hover:bg-gray-400/20'}`}
          >
            <List size={20} />
          </button>

          {/* NÚT THEME */}
          <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-400/20 transition-colors">
            {prefs.themeMode === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
          
          {/* NÚT CÀI ĐẶT */}
          <button 
            onClick={() => { setShowSettings(!showSettings); setShowToc(false); }} 
            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-teal-100 text-teal-800' : 'hover:bg-gray-400/20'}`}
          >
            <Settings size={20} />
          </button>
          
          {/* NÚT FULLSCREEN (ĐÃ BỎ CLASS HIDDEN SM:BLOCK) */}
          <button onClick={toggleFullscreen} className="p-2 rounded-full hover:bg-gray-400/20 transition-colors">
            {isFullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}
          </button>
        </div>
      </div>

      {/* Menu Mục Lục */}
      {showToc && (
        <div className="absolute top-16 right-4 md:right-20 w-72 max-h-[70vh] overflow-y-auto bg-white shadow-2xl rounded-2xl border border-gray-200 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
           <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl sticky top-0 z-10 bg-white"><span className="font-bold text-sm uppercase text-gray-500 flex items-center gap-2"><List size={16}/> Mục lục</span><button onClick={() => setShowToc(false)}><X size={18} className="text-gray-400 hover:text-red-500"/></button></div>
           <div className="p-2">{toc.length > 0 ? (<ul className="space-y-1">{toc.map((chapter, index) => (<li key={index}><button onClick={() => navigateToChapter(chapter.href)} className="w-full text-left px-4 py-3 text-sm hover:bg-teal-50 hover:text-teal-700 rounded-lg transition-colors border-b border-gray-50 last:border-0">{chapter.label ? chapter.label.trim() : `Chương ${index + 1}`}</button></li>))}</ul>) : (<div className="p-4 text-center text-gray-400 text-sm">Không tìm thấy mục lục</div>)}</div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-80 max-h-[80vh] overflow-y-auto bg-white shadow-2xl rounded-2xl border border-gray-200 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
           <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl"><span className="font-bold text-sm uppercase text-gray-500">Cấu hình</span><button onClick={() => setShowSettings(false)}><X size={18} className="text-gray-400 hover:text-red-500"/></button></div>
           <div className="p
