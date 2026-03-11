import React, { useState, useRef, useEffect } from 'react';
import { Camera, History, BookOpen, Settings, X, CheckCircle, AlertTriangle, XCircle, Activity, Droplet, Flame, Wheat, ChevronRight, Trash2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';

type HealthStatus = 'saludable' | 'moderado' | 'poco saludable';

interface FoodAnalysis {
  id: string;
  date: string;
  name: string;
  status: HealthStatus;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar: number;
  recommendation: string;
  imageUrl: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'history' | 'learn' | 'admin'>('scanner');
  const [history, setHistory] = useState<FoodAnalysis[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminError, setAdminError] = useState('');

  // Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<FoodAnalysis | null>(null);
  const [cameraError, setCameraError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load history from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('foodscan_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Save history to local storage
  useEffect(() => {
    localStorage.setItem('foodscan_history', JSON.stringify(history));
  }, [history]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setCameraError('No se pudo acceder a la cámara. Por favor, otorga los permisos necesarios.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageDataUrl);
        stopCamera();
        analyzeFood(imageDataUrl);
      }
    }
  };

  const analyzeFood = async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        alert("Error: No se encontró la clave de API de Gemini. Asegúrate de configurarla en las variables de entorno de Vercel (GEMINI_API_KEY).");
        setCapturedImage(null);
        return;
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const base64Data = imageDataUrl.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg'
            }
          },
          {
            text: 'Analiza este alimento. Identifica qué es, si es saludable, moderado o poco saludable. Estima calorías, proteínas (g), grasas (g), carbohidratos (g) y azúcar (g). Da una breve recomendación.'
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'Nombre del alimento' },
              status: { type: Type.STRING, description: 'saludable, moderado, o poco saludable' },
              calories: { type: Type.NUMBER, description: 'Calorías estimadas' },
              protein: { type: Type.NUMBER, description: 'Proteínas en gramos' },
              fat: { type: Type.NUMBER, description: 'Grasas en gramos' },
              carbs: { type: Type.NUMBER, description: 'Carbohidratos en gramos' },
              sugar: { type: Type.NUMBER, description: 'Azúcar en gramos' },
              recommendation: { type: Type.STRING, description: 'Breve recomendación de salud' }
            },
            required: ['name', 'status', 'calories', 'protein', 'fat', 'carbs', 'sugar', 'recommendation']
          }
        }
      });

      const resultText = response.text;
      if (resultText) {
        const parsed = JSON.parse(resultText);
        
        // Normalize status
        let normalizedStatus: HealthStatus = 'moderado';
        const s = parsed.status.toLowerCase();
        if (s.includes('poco')) normalizedStatus = 'poco saludable';
        else if (s.includes('saludable')) normalizedStatus = 'saludable';

        const newAnalysis: FoodAnalysis = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          name: parsed.name,
          status: normalizedStatus,
          calories: parsed.calories,
          protein: parsed.protein,
          fat: parsed.fat,
          carbs: parsed.carbs,
          sugar: parsed.sugar,
          recommendation: parsed.recommendation,
          imageUrl: imageDataUrl
        };

        setCurrentResult(newAnalysis);
        setHistory(prev => [newAnalysis, ...prev]);
      }
    } catch (error) {
      console.error("Error analyzing food:", error);
      alert("Hubo un error al analizar el alimento. Intenta de nuevo.");
      setCapturedImage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetScanner = () => {
    setCapturedImage(null);
    setCurrentResult(null);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === '8718') {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminError('');
      setActiveTab('admin');
    } else {
      setAdminError('Clave incorrecta. Acceso denegado.');
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearAllHistory = () => {
    if (window.confirm('¿Estás seguro de borrar todo el historial?')) {
      setHistory([]);
    }
  };

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'saludable': return 'text-green-500 bg-green-100 border-green-200';
      case 'moderado': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'poco saludable': return 'text-red-500 bg-red-100 border-red-200';
      default: return 'text-gray-500 bg-gray-100 border-gray-200';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'saludable': return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'moderado': return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'poco saludable': return <XCircle className="w-6 h-6 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10 px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 p-2 rounded-xl">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
            FoodScan AI
          </h1>
        </div>
        <button 
          onClick={() => {
            if (isAdmin) setActiveTab('admin');
            else setShowAdminLogin(true);
          }}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full max-w-md mx-auto relative">
        <AnimatePresence mode="wait">
          {/* SCANNER TAB */}
          {activeTab === 'scanner' && (
            <motion.div 
              key="scanner"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 h-full flex flex-col"
            >
              {!capturedImage ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-semibold text-slate-800">Descubre lo que comes</h2>
                    <p className="text-slate-500">Apunta la cámara a tu comida para analizar su valor nutricional al instante.</p>
                  </div>

                  {isCameraActive ? (
                    <div className="relative w-full aspect-[3/4] bg-black rounded-3xl overflow-hidden shadow-xl">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-3xl m-4 pointer-events-none">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl"></div>
                      </div>
                      
                      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 px-4">
                        <button 
                          onClick={stopCamera}
                          className="p-4 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/30 transition"
                        >
                          <X className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={captureImage}
                          className="w-16 h-16 bg-emerald-500 rounded-full border-4 border-white shadow-lg flex items-center justify-center hover:bg-emerald-600 transition"
                        >
                          <Camera className="w-6 h-6 text-white" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-[3/4] bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-center gap-4">
                      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                        <Camera className="w-10 h-10 text-emerald-600" />
                      </div>
                      <p className="text-slate-500">La cámara está inactiva</p>
                      {cameraError && <p className="text-red-500 text-sm">{cameraError}</p>}
                      <button 
                        onClick={startCamera}
                        className="mt-4 px-8 py-4 bg-slate-900 text-white rounded-2xl font-medium shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        Escanear alimento
                      </button>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : isAnalyzing ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-emerald-100 shadow-xl">
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover opacity-50" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-slate-800">Analizando alimento...</h3>
                    <p className="text-slate-500">La IA está calculando los nutrientes</p>
                  </div>
                </div>
              ) : currentResult ? (
                <div className="flex flex-col gap-6 pb-6">
                  <div className="relative w-full h-64 rounded-3xl overflow-hidden shadow-lg">
                    <img src={currentResult.imageUrl} alt={currentResult.name} className="w-full h-full object-cover" />
                    <button 
                      onClick={resetScanner}
                      className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-black/70 transition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h2 className="text-3xl font-bold text-slate-900 capitalize">{currentResult.name}</h2>
                        {getStatusIcon(currentResult.status)}
                      </div>
                      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(currentResult.status)}`}>
                        {currentResult.status.toUpperCase()}
                      </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        Calorías: {currentResult.calories} kcal
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-1"><Activity className="w-4 h-4 text-blue-500"/> Proteínas</span>
                            <span className="font-medium">{currentResult.protein}g</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${Math.min((currentResult.protein / 50) * 100, 100)}%` }} 
                              className="h-full bg-blue-500 rounded-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-1"><Wheat className="w-4 h-4 text-amber-500"/> Carbohidratos</span>
                            <span className="font-medium">{currentResult.carbs}g</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${Math.min((currentResult.carbs / 100) * 100, 100)}%` }} 
                              className="h-full bg-amber-500 rounded-full"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-1"><Droplet className="w-4 h-4 text-yellow-500"/> Grasas</span>
                            <span className="font-medium">{currentResult.fat}g</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${Math.min((currentResult.fat / 50) * 100, 100)}%` }} 
                              className="h-full bg-yellow-500 rounded-full"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-1"><Activity className="w-4 h-4 text-purple-500"/> Azúcar</span>
                            <span className="font-medium">{currentResult.sugar}g</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${Math.min((currentResult.sugar / 50) * 100, 100)}%` }} 
                              className="h-full bg-purple-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
                      <h4 className="font-semibold text-blue-900 mb-2">Recomendación</h4>
                      <p className="text-blue-800 text-sm leading-relaxed">{currentResult.recommendation}</p>
                    </div>

                    <button 
                      onClick={resetScanner}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-medium shadow-lg hover:bg-slate-800 transition-all active:scale-95"
                    >
                      Escanear otro alimento
                    </button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 h-full flex flex-col"
            >
              <h2 className="text-2xl font-bold mb-6">Historial</h2>
              
              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 text-slate-500">
                  <History className="w-16 h-16 text-slate-300" />
                  <p>Aún no has escaneado ningún alimento.</p>
                </div>
              ) : (
                <div className="space-y-4 pb-6">
                  {history.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-center">
                      <img src={item.imageUrl} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-1">
                        <h3 className="font-semibold capitalize text-slate-900">{item.name}</h3>
                        <p className="text-sm text-slate-500">{item.calories} kcal</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            item.status === 'saludable' ? 'bg-green-500' : 
                            item.status === 'moderado' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="text-xs text-slate-500 capitalize">{item.status}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* LEARN TAB */}
          {activeTab === 'learn' && (
            <motion.div 
              key="learn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 h-full flex flex-col gap-6 pb-6"
            >
              <h2 className="text-2xl font-bold">Aprende</h2>
              
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-4">
                  <Flame className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">¿Qué son las calorías?</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Las calorías son la energía que los alimentos proporcionan a tu cuerpo. Consumir más de las que quemas lleva al aumento de peso, mientras que consumir menos ayuda a perderlo.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                  <Activity className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Macronutrientes</h3>
                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <strong className="text-slate-900">Proteínas:</strong> Construyen y reparan tejidos.
                  </li>
                  <li className="flex gap-2">
                    <strong className="text-slate-900">Carbohidratos:</strong> Principal fuente de energía.
                  </li>
                  <li className="flex gap-2">
                    <strong className="text-slate-900">Grasas:</strong> Esenciales para hormonas y absorción de vitaminas.
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                <h3 className="text-lg font-semibold text-emerald-900 mb-3">Consejos Saludables</h3>
                <ul className="space-y-2 text-sm text-emerald-800 list-disc list-inside">
                  <li>Bebe al menos 2 litros de agua al día.</li>
                  <li>Prioriza alimentos enteros sobre procesados.</li>
                  <li>Come porciones adecuadas.</li>
                  <li>Incluye verduras en cada comida.</li>
                </ul>
              </div>
            </motion.div>
          )}

          {/* ADMIN TAB */}
          {activeTab === 'admin' && isAdmin && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 h-full flex flex-col gap-6 pb-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Panel Admin</h2>
                <button 
                  onClick={() => setIsAdmin(false)}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Cerrar Sesión
                </button>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-semibold mb-4">Estadísticas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-slate-500 text-sm">Total Escaneos</p>
                    <p className="text-2xl font-bold">{history.length}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <p className="text-slate-500 text-sm">Saludables</p>
                    <p className="text-2xl font-bold text-green-600">
                      {history.filter(h => h.status === 'saludable').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Gestión de Historial</h3>
                  <button 
                    onClick={clearAllHistory}
                    className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Borrar Todo
                  </button>
                </div>
                
                {history.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-center">
                    <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-xl object-cover" />
                    <div className="flex-1">
                      <h4 className="font-medium capitalize text-sm">{item.name}</h4>
                      <p className="text-xs text-slate-500">{new Date(item.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteHistoryItem(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-3xl w-full max-w-sm shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Acceso Admin</h3>
                <button onClick={() => { setShowAdminLogin(false); setAdminError(''); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PIN de acceso</label>
                  <input 
                    type="password" 
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ingresa el PIN"
                    autoFocus
                  />
                </div>
                {adminError && <p className="text-red-500 text-sm">{adminError}</p>}
                <button 
                  type="submit"
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition"
                >
                  Ingresar
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 pb-safe z-40">
        <div className="max-w-md mx-auto flex justify-around p-2">
          <button 
            onClick={() => setActiveTab('scanner')}
            className={`flex flex-col items-center p-2 w-20 rounded-xl transition-colors ${activeTab === 'scanner' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Camera className={`w-6 h-6 mb-1 ${activeTab === 'scanner' ? 'fill-emerald-100' : ''}`} />
            <span className="text-[10px] font-medium">Escanear</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center p-2 w-20 rounded-xl transition-colors ${activeTab === 'history' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History className={`w-6 h-6 mb-1 ${activeTab === 'history' ? 'fill-emerald-100' : ''}`} />
            <span className="text-[10px] font-medium">Historial</span>
          </button>
          <button 
            onClick={() => setActiveTab('learn')}
            className={`flex flex-col items-center p-2 w-20 rounded-xl transition-colors ${activeTab === 'learn' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <BookOpen className={`w-6 h-6 mb-1 ${activeTab === 'learn' ? 'fill-emerald-100' : ''}`} />
            <span className="text-[10px] font-medium">Aprende</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
