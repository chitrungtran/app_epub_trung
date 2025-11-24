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
  
  // --- THÊM STATE CHO TIẾN ĐỘ ---
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
      document.documentElement.requestFullscreen();
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
          
          // --- TẠO DỮ LIỆU VỊ TRÍ ĐỂ TÍNH % (CHẠY NGẦM) ---
          // Cái này cần thiết để tính % chính xác
          newBook.locations.generate(1000).then(() => {
             console.log("Đã tạo xong bản đồ vị trí sách!");
          }).catch(e => console.warn("Lỗi tạo vị trí:", e));

          const startCfi = newBook.spine.get(0).href;
          await newRendition.display(startCfi);
          
          setLoading(false);
          
          if (viewerRef.current) { viewerRef.current.focus(); }
          updateBookStyles(newRendition, prefs);

          const navigation = await newBook.loaded.navigation;
          setToc(navigation.toc); 

          // --- LẮNG NGHE SỰ KIỆN CUỘN ĐỂ CẬP NHẬT % ---
          newRendition.on('relocated', (location) => {
             if (location && location.start) {
                // Tính phần trăm
                const percent = newBook.locations.percentageFromCfi(location.start.cfi);
                // Cập nhật thanh trạng thái (Làm tròn số)
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
    if (prefs.themeMode === '
