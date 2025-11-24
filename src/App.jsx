import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, ChevronLeft, ChevronRight, Settings, 
  Type, Move, Maximize, Minimize, Sun, Moon, 
  Eye, X, Loader2, AlignJustify, AlertCircle
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef(null);

  // Cấu hình mặc định
  const [prefs, setPrefs] = useState({
    fontFamily: 'Merriweather',
    fontSize: 100,
    lineHeight: 1.6,
    letterSpacing: 0,
    paragraphSpacing: 10,
    textColor: '#5f4b32', // Màu chữ nâu đất Ghibli
    bgColor: '#f6eec7',   // Màu giấy cũ
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
    { label: 'Giấy', text: '#5f4b32', bg: '#f6eec7' }, // Chuẩn Ghibli
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
    // Chuyển GitHub sang jsDelivr cho nhanh
    if (url.includes('github.com') && url.includes('/blob/')) {
       let cdnUrl = url.replace('github.com', 'cdn.jsdelivr.net/gh');
       cdnUrl = cdnUrl.replace('/blob/', '@');
       return cdnUrl;
    }
    // Google Drive hoặc link khác thì qua Proxy
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
          
          // Bước 1: Tải file về RAM trước (ArrayBuffer) - Cách này ổn định nhất
          const response = await fetch(bookUrl);
          if (!response.ok) throw new Error(`Lỗi tải file (${response.status}). Link hỏng rồi!`);
          
          const arrayBuffer = await response.arrayBuffer();
          setLoadingStep('Đang mở trang sách...');
          
          // Bước 2: Nạp vào ePub
          const newBook = window.ePub(arrayBuffer);
          setBook(newBook);

          // Bước 3: Vẽ lên màn hình (Chế độ Cuộn Dọc - Scrolled)
          const newRendition = newBook.renderTo(viewerRef.current, {
            width: '100%',
            height: '100%',
            flow: 'scrolled',       // Cuộn dọc
            manager: 'continuous',  // Load liên tục
            allowScriptedContent: false
          });

          setRendition(newRendition);
          
          await newRendition.display();
          setLoading(false);
          
          // Áp dụng cài đặt ngay sau khi load
          updateBookStyles(newRendition, prefs);

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
    } catch (e) { console.log(e); }
  };

  useEffect(() => {
    if (rendition) updateBookStyles(rendition, prefs);
  }, [prefs, rendition]);

  // Hàm điều hướng (Cho cuộn dọc thì dùng scroll)
  const scrollUp = () => {
     if (viewerRef.current) viewerRef.current.scrollTop -= window.innerHeight * 0.8;
  }
  const scrollDown = () => {
     if (viewerRef.current) viewerRef.current.scrollTop += window.innerHeight * 0.8;
  }

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
      
      {/* HEADER
