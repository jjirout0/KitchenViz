import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Upload, Image as ImageIcon, Loader2, CheckCircle2, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { KitchenConfig, GenerationResult } from './types';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'config' | 'result'>('upload');
  const [config, setConfig] = useState<KitchenConfig>({
    cabinetMaterial: 'Dub H1318',
    countertopMaterial: 'Černá žula',
    style: 'Moderní'
  });
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
        setStep('config');
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const generateVisualization = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      // Initialize inside the function to ensure the latest API key is used
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API klíč nebyl nalezen. \n\n1. V AI Studiu: Klikněte na Settings (ozubené kolečko) vpravo nahoře a vyberte API klíč.\n2. Na Vercelu: Přidejte proměnnou GEMINI_API_KEY do nastavení projektu (Environment Variables).");
      }

      const ai = new GoogleGenAI({ apiKey });
      const base64Image = await fileToBase64(file);

      // Step 1: Use Gemini to analyze the sketch and generate a high-quality prompt for Pollinations.ai
      const promptResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Image
              }
            },
            {
              text: `Analyzuj tento náčrt kuchyně a vytvoř detailní anglický prompt pro generátor obrázků (DALL-E/Midjourney styl).
              Náčrt obsahuje rozvržení kuchyně.
              Požadavky na materiály a styl:
              - Materiál skříněk: ${config.cabinetMaterial}
              - Materiál pracovní desky: ${config.countertopMaterial}
              - Styl: ${config.style}
              
              Prompt musí být v angličtině, velmi detailní, zaměřený na fotorealismus, profesionální osvětlení, 8k rozlišení, architektonický render. 
              Musí přesně popisovat rozvržení z náčrtu.
              Odpověz POUZE výsledným promptem v angličtině.`
            }
          ]
        }
      });

      const generatedPrompt = promptResponse.text?.trim() || `Professional architectural 3D render of a kitchen, ${config.style} style, ${config.cabinetMaterial} cabinets, ${config.countertopMaterial} countertop, highly detailed, photorealistic, 8k, based on a hand-drawn sketch layout.`;

      // Step 2: Use Pollinations.ai to generate the image
      const POLLINATIONS_API_KEY = "sk_EUDBZvGHhYHePpcAw1aBEhH0NbPUUtew";
      const seed = Math.floor(Math.random() * 1000000);
      const width = 1280;
      const height = 720;
      
      // We use the prompt to generate a URL for Pollinations.ai
      // Pollinations supports a simple GET request for images
      const encodedPrompt = encodeURIComponent(generatedPrompt);
      const pollinationsUrl = `https://pollinations.ai/p/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;

      // We can fetch the image to verify it's working or just use the URL
      // Since we want to show it in the result, we'll use the URL directly
      // But to ensure it's "generated" before showing, we can pre-load it
      const img = new Image();
      img.src = pollinationsUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      setResult({
        imageUrl: pollinationsUrl
      });
      setStep('result');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("403") || err.message?.includes("permission")) {
        setError("Chyba oprávnění (403). Tento model je ZDARMA, ale vyžaduje nastavený API klíč v AI Studiu. Klikněte na ozubené kolečko (Settings) vpravo nahoře a ujistěte se, že máte vybraný platný API klíč.");
      } else {
        setError(err.message || "Během generování došlo k chybě. Zkuste to prosím znovu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep('upload');
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12 max-w-2xl"
      >
        <div className="inline-flex items-center justify-center p-3 bg-stone-200 rounded-2xl mb-4">
          <ImageIcon className="w-8 h-8 text-stone-700" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl mb-2">
          KitchenSketch <span className="text-stone-500 font-light italic">Viz</span>
        </h1>
        <p className="text-stone-500 font-medium mb-4">pro Truhlářství Jirout</p>
        <p className="text-lg text-stone-600">
          Nahrajte náčrt a získejte 3D vizualizaci zdarma.
        </p>
      </motion.header>

      <main className="w-full max-w-4xl">
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl p-8 border border-stone-200"
            >
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 rounded-2xl p-12 text-center cursor-pointer hover:border-stone-400 transition-colors group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <div className="bg-stone-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-stone-200 transition-colors">
                  <Upload className="w-8 h-8 text-stone-500" />
                </div>
                <h3 className="text-xl font-medium text-stone-900 mb-2">Nahrajte náčrt</h3>
                <p className="text-stone-500">Klikněte nebo přetáhněte soubor</p>
              </div>
            </motion.div>
          )}

          {step === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8"
            >
              <div className="bg-white rounded-3xl shadow-lg p-6 border border-stone-200">
                <h3 className="text-lg font-medium mb-4">Váš náčrt</h3>
                <div className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
                  <img src={preview!} alt="Sketch preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
                <button 
                  onClick={() => setStep('upload')}
                  className="mt-4 text-sm text-stone-500 hover:text-stone-800 flex items-center gap-1"
                >
                  <RefreshCw className="w-4 h-4" /> Změnit obrázek
                </button>
              </div>

              <div className="bg-white rounded-3xl shadow-lg p-8 border border-stone-200">
                <h3 className="text-2xl font-semibold mb-6">Nastavení</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Materiál skříněk</label>
                    <input 
                      type="text"
                      value={config.cabinetMaterial}
                      onChange={(e) => setConfig({...config, cabinetMaterial: e.target.value})}
                      placeholder="Např. Dub H1318"
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Materiál pracovní desky</label>
                    <input 
                      type="text"
                      value={config.countertopMaterial}
                      onChange={(e) => setConfig({...config, countertopMaterial: e.target.value})}
                      placeholder="Např. Černá žula, Beton..."
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Styl</label>
                    <select 
                      value={config.style}
                      onChange={(e) => setConfig({...config, style: e.target.value})}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 outline-none"
                    >
                      <option>Moderní</option>
                      <option>Skandinávský</option>
                      <option>Industriální</option>
                      <option>Rustikální</option>
                    </select>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    onClick={generateVisualization}
                    disabled={loading}
                    className={cn(
                      "w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2",
                      loading ? "bg-stone-400 cursor-not-allowed" : "bg-stone-900 hover:bg-stone-800 shadow-lg"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generuji...
                      </>
                    ) : (
                      <>
                        Vytvořit vizualizaci
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'result' && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200">
                <div className="aspect-video w-full bg-stone-100 relative group">
                  <img 
                    src={result.imageUrl} 
                    alt="Generated Kitchen" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-stone-900">Vaše nová kuchyně</h2>
                      <p className="text-stone-500">Vizualizace vytvořená na základě vašeho náčrtu</p>
                    </div>
                    <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm font-medium border border-green-100">
                      <CheckCircle2 className="w-4 h-4" />
                      Hotovo
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    {[
                      { label: "Skříňky", value: config.cabinetMaterial },
                      { label: "Deska", value: config.countertopMaterial },
                      { label: "Styl", value: config.style }
                    ].map((item, i) => (
                      <div key={i} className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                        <span className="text-xs text-stone-400 uppercase tracking-wider block mb-1">{item.label}</span>
                        <span className="text-stone-800 font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={reset}
                      className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Zkusit jiný náčrt
                    </button>
                    <a 
                      href={result.imageUrl} 
                      download="kuchyne-vizualizace.png"
                      className="flex-1 py-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      Stáhnout obrázek
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-20 text-stone-400 text-sm flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <span>Powered by Pollinations.ai & Gemini</span>
          <span className="w-1 h-1 bg-stone-300 rounded-full"></span>
          <span>Architectural Visualization AI</span>
        </div>
        <p>© 2026 KitchenSketch Viz. Všechna práva vyhrazena.</p>
      </footer>
    </div>
  );
}
