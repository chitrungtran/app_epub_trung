import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, ChevronLeft, ChevronRight, Settings, 
  Maximize, Minimize, Sun, Moon, 
  Eye, X, Loader2, AlignJustify, AlertCircle, List, Type
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

  const settingsRef = useRef(null); 
  const settingsBtnRef = useRef(null); 
  const tocRef = useRef(null); 
  const tocBtnRef = useRef(null); 

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

  // --- XỬ LÝ CLICK OUTSIDE ---
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

  // Xử lý thay đổi fullscreen (chủ yếu cho PC)
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

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Patrick+Hand&display=swap';
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
      let urlParam = getUrlParameter('url') || getUrlParameter('book');
      if (!urlParam) { setLoading(false); return; }

      // --- VẪN GIỮ NGUYÊN MÃ HÓA LINK NHÉ ---
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
          
          // Đóng menu khi click vào sách
          newRendition.on('click', () => {
             setShowSettings(false);
             setShowToc(false);
          });
          newRendition.on('touchstart', () => {
             setShowSettings(false);
             setShowToc(false);
          });
          
          await newBook.ready;
          const startCfi = newBook.spine.get(0).href;
          await newRendition.display(startCfi);
          
          setLoading(false);
          
          if (viewerRef.current) { 
             viewerRef.current.focus(); 
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

  const updateBookStyles = (rend, settings) => {
    if (!rend) return;
    try {
      rend.themes.fontSize(`${settings.fontSize}%`);
      rend.themes.default({
        'body': { 
          'background': `${settings.bgColor} !important`,
          'color': `${settings.textColor} !important`,
          'padding': '20px 10px !important'
        },
        'p': {
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
      rendition.display(href).then(() => {
         setShowToc(false);
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
      
      <div className="flex-none h-14 px-4 flex items-center justify-between border-b border-gray-400/20 backdrop-blur-sm z-50 relative">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-teal-600" />
          <span className="font-bold text-lg hidden sm:block font-serif">Ghibli Reader Pro</span>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2">
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
          
          {/* 👇 QUAN TRỌNG: Thêm class 'hidden md:block' để ẩn nút này trên mobile */}
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
          onMouseLeave={() => setShowToc(
