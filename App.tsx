import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RadioTower, Headphones, MonitorPlay, Camera, Film, 
  ScreenShare, Dices, Youtube, UploadCloud, User, 
  SwitchCamera, Mic, SatelliteDish, Square, CheckCircle,
  Info, AlertCircle, AlertTriangle, Play, Settings2,
  Lock, Unlock, LogOut
} from 'lucide-react';

export default function App() {
  // --- Estados de Autenticação (Novo Sistema de Roles) ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // --- Estados da Interface ---
  const [isStudioOn, setIsStudioOn] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [activeSource, setActiveSource] = useState('camera');
  const [audienceVolume, setAudienceVolume] = useState(0.8);
  const [useFrontCamera, setUseFrontCamera] = useState(true);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  
  // --- Estados de Mídia ---
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [mediaType, setMediaType] = useState(null); // 'youtube' | 'video' | null
  const [mediaSrc, setMediaSrc] = useState(null);
  
  // --- Estados da Roleta ---
  const [rouletteNames, setRouletteNames] = useState("João\nMaria\nCarlos\nAna\nPedro\nLucas");
  
  // --- Estados de Notificação ---
  const [toasts, setToasts] = useState([]);

  // --- Referências ---
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const studioMediaRef = useRef(null);
  const rouletteCanvasRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const localStreamRef = useRef(null);
  const broadcastStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const wakeLockRef = useRef(null);
  
  const localPeerConnectionRef = useRef(null);
  const remotePeerConnectionRef = useRef(null);
  const videoSenderRef = useRef(null);
  
  const audioContextRef = useRef(null);
  const mixedAudioDestinationRef = useRef(null);
  const isMediaSourceConnectedRef = useRef(false);
  
  const currentAngleRef = useRef(0);
  const isSpinningRef = useRef(false);
  const animationFrameRef = useRef(null);

  // --- Limpeza global ao desmontar o componente ---
  useEffect(() => {
    return () => {
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (screenStreamRef.current) screenStreamRef.current.getTracks().forEach(t => t.stop());
      if (broadcastStreamRef.current) broadcastStreamRef.current.getTracks().forEach(t => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (localPeerConnectionRef.current) localPeerConnectionRef.current.close();
      if (remotePeerConnectionRef.current) remotePeerConnectionRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // --- Login System ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === 'Neyoficial2026') {
      setIsAdmin(true);
      setShowLoginModal(false);
      setPasswordInput('');
      showToast("Acesso concedido! Bem-vindo ao Estúdio.", "success");
    } else {
      showToast("Senha incorreta. Acesso negado.", "error");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    showToast("Você saiu do modo administrador.", "info");
  };

  // --- Setup & WebRTC Logic ---
  const setupBackgroundExecution = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Live Studio',
          artist: 'Transmissão no Ar',
          artwork: [{ src: 'https://placehold.co/512x512/0a0a0a/ef4444?text=AO+VIVO', sizes: '512x512', type: 'image/png' }]
        });
        navigator.mediaSession.playbackState = isBroadcasting ? "playing" : "paused";
      }
    } catch (err) {
      console.warn("Background API limitação:", err);
    }
  };

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        if (!wakeLockRef.current || wakeLockRef.current.released) await setupBackgroundExecution();
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isBroadcasting]);

  const setupAudioMixer = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;
    
    mixedAudioDestinationRef.current = ctx.createMediaStreamDestination();

    if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      const micStream = new MediaStream([audioTrack]);
      const micSource = ctx.createMediaStreamSource(micStream);
      micSource.connect(mixedAudioDestinationRef.current);
    }

    const mediaEl = studioMediaRef.current;
    if (mediaEl && !isMediaSourceConnectedRef.current) {
      if (!mediaEl.captureStream) mediaEl.captureStream = mediaEl.mozCaptureStream;
      try {
        const mediaSource = ctx.createMediaElementSource(mediaEl);
        mediaSource.connect(mixedAudioDestinationRef.current);
        mediaSource.connect(ctx.destination);
        isMediaSourceConnectedRef.current = true;
      } catch (e) {
        console.warn("Media source já conectado", e);
      }
    }

    const bStream = new MediaStream();
    if (mixedAudioDestinationRef.current.stream.getAudioTracks().length > 0) {
      bStream.addTrack(mixedAudioDestinationRef.current.stream.getAudioTracks()[0]);
    }
    if (localStreamRef.current && localStreamRef.current.getVideoTracks().length > 0) {
      bStream.addTrack(localStreamRef.current.getVideoTracks()[0]);
    }
    broadcastStreamRef.current = bStream;
  };

  const initCamera = async () => {
    setIsSwitchingCamera(true);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { facingMode: useFrontCamera ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      
      setupAudioMixer();
      
      if (!isStudioOn) {
        setIsStudioOn(true);
        showToast("Estúdio operacional. Microfone e Câmera ativos.", "success");
        setupBackgroundExecution();
      }

      if (isBroadcasting && activeSource === 'camera') {
        switchBroadcastVideo(stream.getVideoTracks()[0], 'camera');
      }
    } catch (err) {
      console.error("Erro:", err);
      showToast("Falha ao acessar dispositivos de mídia.", "error");
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  useEffect(() => {
    if (isStudioOn && isAdmin) initCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useFrontCamera]);

  const startLive = async () => {
    if (!broadcastStreamRef.current) return;
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    localPeerConnectionRef.current = new RTCPeerConnection(null);
    remotePeerConnectionRef.current = new RTCPeerConnection(null);

    localPeerConnectionRef.current.onicecandidate = e => { if (e.candidate) remotePeerConnectionRef.current.addIceCandidate(e.candidate); };
    remotePeerConnectionRef.current.onicecandidate = e => { if (e.candidate) localPeerConnectionRef.current.addIceCandidate(e.candidate); };

    remotePeerConnectionRef.current.ontrack = e => {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    broadcastStreamRef.current.getTracks().forEach(track => {
      const sender = localPeerConnectionRef.current.addTrack(track, broadcastStreamRef.current);
      if (track.kind === 'video') videoSenderRef.current = sender;
    });

    try {
      const offer = await localPeerConnectionRef.current.createOffer();
      await localPeerConnectionRef.current.setLocalDescription(offer);
      await remotePeerConnectionRef.current.setRemoteDescription(offer);
      const answer = await remotePeerConnectionRef.current.createAnswer();
      await remotePeerConnectionRef.current.setLocalDescription(answer);
      await localPeerConnectionRef.current.setRemoteDescription(answer);
    } catch (e) { console.error("WebRTC Error:", e); }

    setIsBroadcasting(true);
    showToast("Transmissão iniciada. Você está no ar!", "success");
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "playing";
  };

  const stopLive = () => {
    if (localPeerConnectionRef.current) localPeerConnectionRef.current.close();
    if (remotePeerConnectionRef.current) remotePeerConnectionRef.current.close();
    localPeerConnectionRef.current = null; 
    remotePeerConnectionRef.current = null; 
    videoSenderRef.current = null;
    
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setIsBroadcasting(false);
    showToast("Transmissão encerrada.", "info");
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "paused";
  };

  const switchBroadcastVideo = async (track, sourceId) => {
    setActiveSource(sourceId);
    if (isBroadcasting && videoSenderRef.current) {
      try { await videoSenderRef.current.replaceTrack(track); } 
      catch(e) { console.error(e); }
    }
    if (broadcastStreamRef.current) {
      const oldTrack = broadcastStreamRef.current.getVideoTracks()[0];
      if (oldTrack) broadcastStreamRef.current.removeTrack(oldTrack);
      broadcastStreamRef.current.addTrack(track);
    }
  };

  const handleSwitchToCamera = () => {
    if (!localStreamRef.current) return showToast("Ligue o Estúdio primeiro.", "error");
    switchBroadcastVideo(localStreamRef.current.getVideoTracks()[0], 'camera');
  };

  const handleSwitchToMedia = () => {
    const mediaEl = studioMediaRef.current;
    if (!mediaEl) return showToast("Nenhuma mídia carregada.", "warning");
    
    if (!mediaEl.captureStream) mediaEl.captureStream = mediaEl.mozCaptureStream;
    const mStream = mediaEl.captureStream ? mediaEl.captureStream() : null;
    
    if (mStream && mStream.getVideoTracks().length > 0) {
      switchBroadcastVideo(mStream.getVideoTracks()[0], 'media');
    } else {
      showToast("Carregue um arquivo local. YouTube requer captura de tela.", "warning");
      setActiveSource('camera');
    }
  };

  const startScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream;
      showToast("Capturando tela...", "success");
      
      stream.getVideoTracks()[0].onended = () => {
        handleSwitchToCamera();
        showToast("Captura encerrada. Retornando à câmera.", "info");
      };

      switchBroadcastVideo(stream.getVideoTracks()[0], 'screen');
      
      if (stream.getAudioTracks().length > 0 && audioContextRef.current) {
        const screenAudioSource = audioContextRef.current.createMediaStreamSource(stream);
        screenAudioSource.connect(mixedAudioDestinationRef.current);
      }
    } catch(err) {
      showToast("Captura de tela cancelada.", "warning");
      setActiveSource('camera');
    }
  };

  const handleSwitchToRoulette = () => {
    const canvas = rouletteCanvasRef.current;
    if (!canvas) return;
    const canvasStream = canvas.captureStream(30);
    if (canvasStream.getVideoTracks().length > 0) {
      switchBroadcastVideo(canvasStream.getVideoTracks()[0], 'roulette');
    }
  };

  const extractYouTubeID = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleLoadLink = () => {
    if (!mediaUrlInput) return showToast("Insira um link válido.", "warning");

    const ytId = extractYouTubeID(mediaUrlInput);
    if (ytId) {
      setMediaType('youtube');
      setMediaSrc(`https://www.youtube.com/embed/${ytId}?autoplay=1`);
      showToast("YouTube pronto. Use 'Tela YT' na mesa de corte.", "info");
    } else {
      setMediaType('video');
      setMediaSrc(mediaUrlInput);
      setTimeout(() => {
        if (studioMediaRef.current) {
          studioMediaRef.current.play().catch(() => showToast("Formato não suportado.", "error"));
        }
      }, 100);
      showToast("Mídia carregada com sucesso.", "success");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setMediaType('video');
      setMediaSrc(URL.createObjectURL(file));
      setTimeout(() => {
        if (studioMediaRef.current) studioMediaRef.current.play();
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
      }, 100);
      showToast(`Arquivo '${file.name}' em execução.`, "success");
    }
  };

  const getNamesArray = useCallback(() => {
    return rouletteNames.split('\n').filter(n => n.trim() !== '');
  }, [rouletteNames]);

  const drawRoulette = useCallback(() => {
    const canvas = rouletteCanvasRef.current;
    if (!canvas || !canvasContainerRef.current || !isAdmin) return;
    
    const ctx = canvas.getContext('2d');
    const names = getNamesArray();
    
    canvas.width = canvasContainerRef.current.clientWidth;
    canvas.height = canvasContainerRef.current.clientHeight;

    if (names.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;
    const arc = Math.PI * 2 / names.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < names.length; i++) {
      const angle = currentAngleRef.current + i * arc;
      const colors = ['#4f46e5', '#334155', '#7c3aed', '#1e293b'];
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angle, angle + arc, false);
      ctx.lineTo(cx, cy);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      ctx.save();
      ctx.translate(cx + Math.cos(angle + arc / 2) * (radius * 0.65), cy + Math.sin(angle + arc / 2) * (radius * 0.65));
      ctx.rotate(angle + arc / 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(names[i], 0, 4);
      ctx.restore();
    }
    
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.stroke();

  }, [getNamesArray, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      drawRoulette();
      window.addEventListener('resize', drawRoulette);
      return () => window.removeEventListener('resize', drawRoulette);
    }
  }, [drawRoulette, isAdmin]);

  const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);

  const spinRoulette = () => {
    if (isSpinningRef.current || getNamesArray().length === 0) return;
    isSpinningRef.current = true;
    
    const spinDuration = 4000;
    const startTime = performance.now();
    const startAngle = currentAngleRef.current;
    
    const spins = 5 + Math.random() * 5; 
    const targetAngle = startAngle + (Math.PI * 2 * spins);

    const animateSpin = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      
      const easedProgress = easeOutQuart(progress);
      currentAngleRef.current = startAngle + (targetAngle - startAngle) * easedProgress;
      
      drawRoulette();
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateSpin);
      } else {
        isSpinningRef.current = false;
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animateSpin);
  };

  // --- UI Components ---
  const SwitcherBtn = ({ id, icon: Icon, label, onClick }) => {
    const isActive = activeSource === id;
    return (
      <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl font-semibold p-3 text-xs transition-all duration-300 relative overflow-hidden group
        ${isActive 
          ? 'bg-neutral-800 text-white shadow-[inset_0_0_0_2px_#38bdf8,0_4px_15px_rgba(56,189,248,0.3)]' 
          : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800 hover:text-neutral-200 shadow-md'}`}
      >
        <div className={`absolute top-2 right-2 w-2 h-2 rounded-full transition-colors duration-300 ${isActive ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-neutral-700'}`} />
        <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110 text-sky-400' : 'group-hover:scale-110'}`} />
        <span className="tracking-wide">{label}</span>
      </button>
    );
  };

  const Panel = ({ title, icon: Icon, children, rightAction }) => (
    <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl p-4 border border-neutral-800 shadow-lg relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neutral-800 to-transparent opacity-50" />
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-2">
          <Icon className="w-4 h-4 text-neutral-500" /> {title}
        </h3>
        {rightAction && rightAction}
      </div>
      {children}
    </div>
  );

  return (
    <div className="flex flex-col bg-neutral-950 text-neutral-50 h-[100dvh] w-full overflow-hidden font-sans selection:bg-sky-500/30 relative">
      
      {/* Toast Notifications */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 w-[90%] max-w-[400px] pointer-events-none">
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';
          const Icon = isError ? AlertCircle : isSuccess ? CheckCircle : isWarning ? AlertTriangle : Info;
          const bgColors = isError ? 'bg-rose-500/10 border-rose-500/50 text-rose-200' : 
                         isSuccess ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200' : 
                         isWarning ? 'bg-amber-500/10 border-amber-500/50 text-amber-200' : 
                         'bg-sky-500/10 border-sky-500/50 text-sky-200';
          
          return (
            <div key={toast.id} className={`px-4 py-3 rounded-xl text-sm shadow-2xl flex items-center gap-3 border backdrop-blur-md animate-in slide-in-from-top-4 fade-in duration-300 ${bgColors}`}>
              <Icon className="w-5 h-5 shrink-0 opacity-80" />
              <span className="font-medium">{toast.message}</span>
            </div>
          );
        })}
      </div>

      {/* --- ÁREA DE TRANSMISSÃO (Público / Visualizador) --- */}
      {/* Se o usuário for ADM, ocupa apenas 35dvh (topo). Se não for ADM (visualizador), ocupa toda a tela. */}
      <div className={`${isAdmin ? 'flex-none h-[35dvh] border-b border-neutral-900' : 'flex-1 h-[100dvh]'} bg-black relative z-30 shadow-[0_10px_30px_rgba(0,0,0,0.9)] flex items-center justify-center transition-all duration-500`}>
        
        {/* Header/Status Bar */}
        <div className="absolute top-0 left-0 w-full p-4 z-10 flex justify-between items-start">
          <div className="flex items-center gap-3 pointer-events-none">
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-2 backdrop-blur-md border transition-all duration-500
              ${isBroadcasting ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : 'bg-neutral-800/80 text-neutral-500 border-neutral-700'}`}>
              {isBroadcasting && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              {isBroadcasting ? 'ON AIR' : 'STANDBY'}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isAdmin ? (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="bg-neutral-900/80 hover:bg-neutral-800 text-neutral-500 hover:text-white px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest border border-neutral-800 transition flex items-center gap-2 backdrop-blur-md"
              >
                <Lock className="w-3 h-3" /> ADM
              </button>
            ) : (
              <button 
                onClick={handleLogout}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest border border-rose-500/30 transition flex items-center gap-2 backdrop-blur-md"
              >
                <LogOut className="w-3 h-3" /> SAIR
              </button>
            )}
            <span className="text-[10px] font-mono bg-neutral-900/80 text-neutral-500 px-2 py-1 rounded border border-neutral-800 pointer-events-none">1080p60</span>
          </div>
        </div>

        {/* Vídeo Recebido pelo Visualizador */}
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-contain transition-opacity duration-700 ${!isBroadcasting ? 'opacity-0' : 'opacity-100'}`}
          volume={audienceVolume}
        />

        {/* Tela de Offline */}
        {!isBroadcasting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black z-0 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 shadow-inner">
              <RadioTower className="w-8 h-8 text-neutral-600" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 text-center">
              Sinal Interrompido
            </p>
            <p className="text-[10px] text-neutral-600 mt-2">Aguardando início da transmissão...</p>
          </div>
        )}

        {/* Controle de Volume do Espectador */}
        <div className="absolute bottom-4 right-4 bg-neutral-900/80 backdrop-blur-md rounded-xl p-2 px-3 flex items-center gap-3 z-10 border border-neutral-800 group hover:bg-neutral-800 transition-colors">
          <Headphones className="w-4 h-4 text-neutral-400 group-hover:text-sky-400 transition-colors" />
          <input 
            type="range" min="0" max="1" step="0.05" value={audienceVolume}
            onChange={(e) => {
              setAudienceVolume(parseFloat(e.target.value));
              if(remoteVideoRef.current) remoteVideoRef.current.volume = parseFloat(e.target.value);
            }}
            className="w-24 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
        </div>
      </div>

      {/* --- ÁREA DO ESTÚDIO (Visível Apenas para ADM) --- */}
      {isAdmin && (
        <div className="flex-1 overflow-y-auto bg-neutral-950 p-4 pb-[120px] space-y-4 custom-scrollbar animate-in fade-in slide-in-from-bottom-10 duration-500">
          
          <Panel title="Mesa de Corte (Switcher)" icon={MonitorPlay}>
            <div className="grid grid-cols-4 gap-3">
              <SwitcherBtn id="camera" icon={Camera} label="Câmera" onClick={handleSwitchToCamera} />
              <SwitcherBtn id="media" icon={Film} label="Mídia" onClick={handleSwitchToMedia} />
              <SwitcherBtn id="screen" icon={ScreenShare} label="Tela YT" onClick={startScreenCapture} />
              <SwitcherBtn id="roulette" icon={Dices} label="Roleta" onClick={handleSwitchToRoulette} />
            </div>
          </Panel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <Panel 
              title="Câmera Local" 
              icon={User}
              rightAction={
                <button onClick={() => setUseFrontCamera(p => !p)} className="text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 p-2 rounded-lg transition-colors border border-neutral-700">
                  <SwitchCamera className="w-4 h-4" />
                </button>
              }
            >
              <div className="bg-black rounded-xl overflow-hidden aspect-video relative border border-neutral-800 group">
                {isSwitchingCamera && (
                  <div className="absolute inset-0 z-20 bg-neutral-900/80 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-[10px] text-neutral-400 uppercase tracking-widest">Iniciando...</span>
                  </div>
                )}
                <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover transition-opacity duration-300 ${isSwitchingCamera ? 'opacity-0' : 'opacity-100'}`} />
                {!isStudioOn && !isSwitchingCamera && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 z-10">
                    <Camera className="w-8 h-8 text-neutral-700 mb-2" />
                    <p className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">Câmera Offline</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[9px] text-neutral-400 font-mono pointer-events-none">
                  PREVIEW {useFrontCamera ? '(FRONTAL)' : '(TRASEIRA)'}
                </div>
              </div>
            </Panel>

            <Panel title="Mídia & Áudio" icon={Youtube}>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input 
                    type="url" placeholder="URL do YouTube ou Mídia..." 
                    value={mediaUrlInput} onChange={(e) => setMediaUrlInput(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500 transition-colors placeholder:text-neutral-600 shadow-inner"
                  />
                  <button onClick={handleLoadLink} className="bg-neutral-800 hover:bg-sky-600 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition-colors border border-neutral-700 hover:border-sky-500 group flex items-center justify-center">
                    <Play className="w-4 h-4 group-hover:text-white text-neutral-400 transition-colors" />
                  </button>
                </div>
                <label className="bg-neutral-800/50 hover:bg-neutral-800 text-center py-3 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer text-neutral-300 border border-neutral-700 border-dashed">
                  <UploadCloud className="w-4 h-4 text-neutral-400" /> Escolher Arquivo Local
                  <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              
              <div className="mt-4 bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center border border-neutral-800 relative shadow-inner">
                <div className="absolute top-2 left-2 bg-neutral-900/80 px-2 py-1 rounded text-[9px] text-neutral-400 font-mono z-10 pointer-events-none border border-neutral-800">
                  MEDIA PREVIEW
                </div>
                {mediaType === 'youtube' ? (
                  <iframe src={mediaSrc} allow="autoplay; encrypted-media" allowFullScreen className="w-full h-full border-0" />
                ) : (
                  <video ref={studioMediaRef} src={mediaSrc} controls crossOrigin="anonymous" playsInline className="w-full h-full object-contain" />
                )}
                {!mediaSrc && (
                  <div className="flex flex-col items-center gap-2 text-neutral-600">
                    <Film className="w-6 h-6"/>
                    <span className="text-[10px] uppercase tracking-widest font-semibold">Sem Mídia</span>
                  </div>
                )}
              </div>
            </Panel>

          </div>

          <Panel title="Roleta Interativa" icon={Dices}>
            <div className="flex gap-4 h-40">
              <div className="w-[40%] flex flex-col gap-2">
                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Participantes (Um por linha)</label>
                <textarea 
                  value={rouletteNames}
                  onChange={(e) => setRouletteNames(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-300 resize-none focus:outline-none focus:border-indigo-500 transition-colors custom-scrollbar shadow-inner leading-relaxed" 
                />
              </div>
              
              <div className="w-[60%] flex flex-col gap-3 relative">
                <div ref={canvasContainerRef} className="w-full flex-1 bg-black rounded-xl border border-neutral-800 overflow-hidden relative flex items-center justify-center shadow-inner">
                  <canvas ref={rouletteCanvasRef} className="w-full h-full object-contain" />
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[20px] border-l-transparent border-r-transparent border-t-rose-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] z-10" />
                </div>
                <button onClick={spinRoulette} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-[0_4px_15px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Dices className="w-4 h-4" /> GIRAR ROLETA
                </button>
              </div>
            </div>
          </Panel>

        </div>
      )}

      {/* --- DOCK INFERIOR (Visível Apenas para ADM) --- */}
      {isAdmin && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-neutral-900/90 backdrop-blur-xl border border-neutral-700/50 p-2.5 rounded-2xl flex gap-3 z-50 shadow-[0_20px_40px_rgba(0,0,0,0.8)] pb-[calc(10px+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-full duration-500">
          <button 
            onClick={initCamera}
            className={`flex-1 font-bold py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest transition-all duration-300 overflow-hidden relative group
              ${isStudioOn 
                ? 'bg-neutral-800 text-emerald-400 border border-neutral-700' 
                : 'bg-neutral-100 hover:bg-white text-black shadow-lg'}`}
          >
            {isStudioOn && <div className="absolute inset-0 bg-emerald-400/5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            {isStudioOn ? <CheckCircle className="w-5 h-5" /> : <Settings2 className="w-5 h-5" />}
            {isStudioOn ? 'Estúdio Ativo' : 'Ligar Estúdio'}
          </button>

          <button 
            onClick={isBroadcasting ? stopLive : startLive}
            disabled={!isStudioOn}
            className={`flex-1 font-bold py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest transition-all duration-300 relative overflow-hidden
              disabled:bg-neutral-800 disabled:text-neutral-600 disabled:border-neutral-800 disabled:border
              ${!isStudioOn ? '' : isBroadcasting 
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]'}`}
          >
            {isBroadcasting ? <Square className="w-5 h-5 fill-current" /> : <SatelliteDish className="w-5 h-5" />}
            {isBroadcasting ? 'Encerrar Live' : 'Transmitir'}
          </button>
        </div>
      )}

      {/* --- MODAL DE LOGIN ADM --- */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200">
            
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mb-4 border border-neutral-700 shadow-inner">
                <Unlock className="w-6 h-6 text-sky-400" />
              </div>
              <h2 className="text-white text-lg font-bold">Acesso ao Estúdio</h2>
              <p className="text-xs text-neutral-500 mt-1">Área restrita aos administradores da rádio.</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Senha de Acesso</label>
                <input
                  type="password"
                  autoFocus
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-black/50 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 transition-colors shadow-inner"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 py-3 rounded-xl text-neutral-400 font-bold hover:bg-neutral-800 hover:text-white transition-colors border border-transparent hover:border-neutral-700 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold shadow-[0_0_15px_rgba(2,132,199,0.4)] transition-all text-sm"
                >
                  Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #404040; }
      `}</style>
    </div>
  );
}