
import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileDown, 
  Play, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  FileSpreadsheet, 
  Sparkles, 
  Eye, 
  X,
  Settings,
  LayoutDashboard,
  Zap,
  BookOpen,
  MessageSquareQuote,
  ChefHat,
  FileText,
  Save,
  Terminal,
  Info,
  Download,
  FolderOpen,
  Link,
  Search,
  Plus,
  Menu
} from 'lucide-react';
import { RecipeInput, GeneratedRecipe, GenerationStep, MasterRecipe } from './types';
import { parseExcelFile, parseMasterExcel, exportRecipesExcel, exportStepsExcel, exportFaqsExcel } from './utils/excelHandler';
import { generateRecipeContent, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from './services/geminiService';

const AVAILABLE_MODELS = [
  { id: 'gemini-3-flash-preview', provider: 'gemini', name: 'Gemini 3.0 Flash' },
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini' },
  { id: 'claude-3-5-sonnet-latest', provider: 'anthropic', name: 'Sonnet 4' },
  { id: 'gemini-3-pro-preview', provider: 'gemini', name: 'Gemini 3.0 Pro' },
];

const GB_LOGO_URL = "https://worldbranddesign.com/wp-content/uploads/2023/11/GALLINA_BLANCA_LBB_07.jpg";

export default function App() {
  const [provider, setProvider] = useState(() => localStorage.getItem('aerogen_ai_provider') || 'gemini');
  const [selectedModelId, setSelectedModelId] = useState(() => localStorage.getItem('aerogen_ai_model') || 'gemini-3-flash-preview');
  const [openAiKey, setOpenAiKey] = useState(() => localStorage.getItem('aerogen_openai_key') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('aerogen_gemini_key') || '');
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('aerogen_anthropic_key') || '');
  
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem('gb_system_prompt') || DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(() => localStorage.getItem('gb_user_prompt_template') || DEFAULT_USER_PROMPT_TEMPLATE);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [masterRecipes, setMasterRecipes] = useState<MasterRecipe[]>([]);
  const [step, setStep] = useState<GenerationStep>(GenerationStep.IDLE);
  const [progress, setProgress] = useState(0);
  const [previewRecipe, setPreviewRecipe] = useState<GeneratedRecipe | null>(null);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const masterInputRef = useRef<HTMLInputElement>(null);

  const updateSetting = (key: string, value: string) => {
    localStorage.setItem(key, value);
    if (key === 'aerogen_ai_provider') setProvider(value);
    if (key === 'aerogen_ai_model') setSelectedModelId(value);
    if (key === 'aerogen_openai_key') setOpenAiKey(value);
    if (key === 'aerogen_gemini_key') setGeminiKey(value);
    if (key === 'aerogen_anthropic_key') setAnthropicKey(value);
    if (key === 'gb_system_prompt') setSystemPrompt(value);
    if (key === 'gb_user_prompt_template') setUserPrompt(value);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStep(GenerationStep.PARSING);
    try {
      const data = await parseExcelFile(file);
      setRecipes(data.map(input => ({
        input, introduccion: '', infoNutricional: '', energia: '', hidratos: '', fibra: '', proteinas: '', grasas: '',
        pasos: [], conclusion: '', faqList: [], status: 'pending'
      })));
      setStep(GenerationStep.IDLE);
    } catch (e) { 
      alert("Error cargando Excel."); 
      setStep(GenerationStep.IDLE); 
    }
    event.target.value = ''; // Reset to allow same file re-upload
  };

  const handleMasterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await parseMasterExcel(file);
      setMasterRecipes(data);
      alert(`Master List cargado: ${data.length} recetas para interlinking.`);
    } catch (e) {
      alert("Error cargando Master List.");
    }
    event.target.value = '';
  };

  const handleSaveSession = () => {
    if (recipes.length === 0) return alert("No hay datos para guardar.");
    const sessionData = {
      recipes,
      masterRecipes
    };
    const dataStr = JSON.stringify(sessionData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `GB_Session_${new Date().toISOString().slice(0,10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleLoadSession = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.recipes && Array.isArray(json.recipes)) {
          setRecipes(json.recipes);
          if (json.masterRecipes) setMasterRecipes(json.masterRecipes);
          alert("Sesión cargada con éxito.");
        } else if (Array.isArray(json)) {
          setRecipes(json);
          alert("Sesión (solo recetas) cargada con éxito.");
        } else {
          throw new Error("Formato de sesión inválido.");
        }
      } catch (err) {
        alert("Error al cargar la sesión.");
      }
    };
    reader.readAsText(file);
  };

  const runBulkGeneration = async () => {
    if (provider === 'gemini' && !geminiKey && !process.env.API_KEY) return alert("Falta API Key.");
    setStep(GenerationStep.GENERATING);
    let completed = 0;
    for (let i = 0; i < recipes.length; i++) {
      if (recipes[i].status === 'completed') { completed++; continue; }
      setRecipes(prev => { const n = [...prev]; n[i].status = 'processing'; return n; });
      try {
        const result = await generateRecipeContent(recipes[i].input, masterRecipes);
        setRecipes(prev => {
          const n = [...prev];
          n[i] = { 
            ...n[i], 
            introduccion: result.introduccion, 
            infoNutricional: result.nutrientes.tablaHtml, 
            energia: result.nutrientes.energia, 
            hidratos: result.nutrientes.hidratos, 
            fibra: result.nutrientes.fibra, 
            proteinas: result.nutrientes.proteinas, 
            grasas: result.nutrientes.grasas, 
            pasos: result.pasos, 
            conclusion: result.conclusion, 
            relatedRecipesHtml: result.relatedRecipesHtml,
            faqList: result.faqs, 
            status: 'completed' 
          };
          return n;
        });
      } catch (e: any) {
        setRecipes(prev => { const n = [...prev]; n[i].status = 'error'; n[i].error = e.message; return n; });
      }
      completed++;
      setProgress(Math.round((completed / recipes.length) * 100));
    }
    setStep(GenerationStep.COMPLETED);
  };

  const totalCompleted = recipes.filter(r => r.status === 'completed').length;

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-8 flex flex-col items-center gap-4 bg-[#FFD200] border-b border-[#005999]/20 shadow-inner">
        <div className="bg-white p-1 rounded-xl shadow-sm">
          <img src={GB_LOGO_URL} alt="Gallina Blanca" className="h-16 w-32 object-contain" />
        </div>
        <span className="font-black text-[#005999] text-[10px] tracking-[0.25em] uppercase border-t border-[#005999]/30 pt-2">Bulk Engine AI</span>
      </div>
      
      <nav className="flex-1 p-6 space-y-8">
        {/* Gestión de Sesión */}
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gestión de Sesión</p>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleSaveSession}
              disabled={recipes.length === 0}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold transition-all border border-white/10 disabled:opacity-30"
            >
              <Download size={16} className="text-[#FFD200]" /> Guardar .JSON
            </button>
            <button 
              onClick={() => jsonInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-bold transition-all border border-white/10"
            >
              <FolderOpen size={16} className="text-[#FFD200]" /> Cargar .JSON
              <input type="file" ref={jsonInputRef} className="hidden" accept=".json" onChange={handleLoadSession} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Interlinking Status</p>
          <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold">Base de Datos:</span>
              <span className={`text-[10px] font-black uppercase ${masterRecipes.length > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                {masterRecipes.length > 0 ? `${masterRecipes.length} recetas` : 'No cargada'}
              </span>
            </div>
            <button 
              onClick={() => masterInputRef.current?.click()}
              className="w-full py-2 bg-[#005999] text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-[#004a80] transition-all flex items-center justify-center gap-2"
            >
              <Plus size={12}/> {masterRecipes.length > 0 ? 'Actualizar Master' : 'Cargar Master'}
              <input type="file" ref={masterInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleMasterUpload} />
            </button>
            {masterRecipes.length > 0 && (
               <button 
               onClick={() => setMasterRecipes([])}
               className="w-full py-2 border border-red-500/30 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
             >
               <Trash2 size={12}/> Limpiar Master
             </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proveedor AI</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => updateSetting('aerogen_ai_provider', 'gemini')} className={`py-2 rounded-lg text-[10px] font-bold ${provider === 'gemini' ? 'bg-[#005999] text-white' : 'bg-white/5 text-slate-300'}`}>Gemini</button>
            <button onClick={() => updateSetting('aerogen_ai_provider', 'openai')} className={`py-2 rounded-lg text-[10px] font-bold ${provider === 'openai' ? 'bg-[#005999] text-white' : 'bg-white/5 text-slate-300'}`}>OpenAI</button>
            <button onClick={() => updateSetting('aerogen_ai_provider', 'anthropic')} className={`py-2 rounded-lg text-[10px] font-bold ${provider === 'anthropic' ? 'bg-[#005999] text-white' : 'bg-white/5 text-slate-300'}`}>Claude</button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Credenciales</p>
          <div className="space-y-4">
            <CredentialInput label="Gemini Key" value={geminiKey} onChange={v => updateSetting('aerogen_gemini_key', v)} />
            <CredentialInput label="OpenAI Key" value={openAiKey} onChange={v => updateSetting('aerogen_openai_key', v)} />
            <CredentialInput label="Anthropic Key" value={anthropicKey} onChange={v => updateSetting('aerogen_anthropic_key', v)} />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Configuración Avanzada</p>
          <button onClick={() => { setShowPromptsModal(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-black bg-[#005999]/10 hover:bg-[#005999]/20 border border-[#005999]/30 text-white shadow-lg transition-all">
            <Terminal size={16} className="text-[#FFD200]" /> PROMPTS (TODOS)
          </button>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#fdfdfd] text-slate-900 font-sans relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-80 bg-[#1a1a1a] text-slate-400 border-r border-slate-800 transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0 lg:flex lg:flex-col shrink-0
      `}>
        <SidebarContent />
        {/* Close Button for Mobile Sidebar */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-2 text-white/50 hover:text-white"
        >
          <X size={24} />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 bg-[#FFD200] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20 shadow-md shrink-0">
          <div className="flex items-center gap-3 lg:gap-6">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-[#005999] hover:bg-white/20 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="bg-white p-1 rounded-lg shadow-sm h-10 lg:h-12 flex items-center">
               <img src={GB_LOGO_URL} alt="Gallina Blanca" className="h-full w-auto object-contain" />
            </div>
            <h2 className="text-[10px] lg:text-sm font-black text-[#005999] uppercase tracking-widest flex items-center gap-2">
              <ChefHat size={18} className="hidden sm:inline" /> <span className="hidden sm:inline">Recipe Bulk Engine</span>
              <span className="sm:hidden">Bulk Engine</span>
            </h2>
          </div>
          {recipes.length > 0 && (
            <div className="flex gap-1 lg:gap-2">
              <ActionButton onClick={() => exportRecipesExcel(recipes)} disabled={totalCompleted === 0} icon={<BookOpen size={14}/>} label="Rec" />
              <ActionButton onClick={() => exportStepsExcel(recipes)} disabled={totalCompleted === 0} icon={<FileSpreadsheet size={14}/>} label="Stp" />
              <ActionButton onClick={() => exportFaqsExcel(recipes)} disabled={totalCompleted === 0} icon={<MessageSquareQuote size={14}/>} label="FAQ" />
            </div>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {recipes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-10">
              <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
                {/* Card 1: Excel a Generar */}
                <div className="bg-white border rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-12 text-center shadow-xl lg:shadow-2xl relative flex flex-col items-center">
                  <div className="bg-[#FFD200]/10 p-4 lg:p-6 rounded-full w-fit mb-6 lg:mb-8">
                    <FileSpreadsheet className="w-8 h-8 lg:w-12 lg:h-12 text-[#005999]" />
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-black text-[#005999] mb-2 lg:mb-4 italic">Excel Base</h2>
                  <p className="text-slate-500 mb-6 lg:mb-10 text-xs lg:text-sm leading-relaxed">Sube el archivo con las recetas que quieres crear contenido SEO hoy.</p>
                  
                  <label className="w-full cursor-pointer bg-[#005999] text-white px-6 py-3 lg:px-8 lg:py-4 rounded-xl lg:rounded-2xl font-black text-base lg:text-lg shadow-xl hover:bg-[#004a80] transition-all flex items-center justify-center gap-3">
                    <Upload className="inline" size={20} /> Cargar Excel
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                  </label>
                </div>

                {/* Card 2: Master List Interlinking */}
                <div className="bg-white border rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-12 text-center shadow-xl lg:shadow-2xl relative flex flex-col items-center border-dashed border-[#005999]/20">
                  <div className={`p-4 lg:p-6 rounded-full w-fit mb-6 lg:mb-8 ${masterRecipes.length > 0 ? 'bg-green-50' : 'bg-[#005999]/5'}`}>
                    <Link className={`w-8 h-8 lg:w-12 lg:h-12 ${masterRecipes.length > 0 ? 'text-green-500' : 'text-[#005999]'}`} />
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-black text-[#005999] mb-2 lg:mb-4 italic">Interlinking</h2>
                  <p className="text-slate-500 mb-6 lg:mb-10 text-xs lg:text-sm leading-relaxed">Sube el Master List (4500 recetas) para automatizar el enlazado interno.</p>
                  
                  <label className={`w-full cursor-pointer px-6 py-3 lg:px-8 lg:py-4 rounded-xl lg:rounded-2xl font-black text-base lg:text-lg shadow-lg transition-all flex items-center justify-center gap-3 border-2 ${masterRecipes.length > 0 ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-[#005999]/30 text-[#005999] hover:bg-slate-50'}`}>
                    <Search className="inline" size={20} /> {masterRecipes.length > 0 ? 'Master Cargado ✓' : 'Subir Master Excel'}
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleMasterUpload} />
                  </label>
                  {masterRecipes.length > 0 && (
                    <button onClick={() => setMasterRecipes([])} className="mt-2 text-[9px] font-bold text-red-500 uppercase hover:underline">Eliminar Master</button>
                  )}
                </div>

                <div className="md:col-span-2 mt-4">
                  <button 
                    onClick={() => jsonInputRef.current?.click()}
                    className="w-full px-6 py-4 bg-slate-100 text-slate-600 rounded-xl lg:rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 text-sm lg:text-base"
                  >
                    <FolderOpen size={20} /> Restaurar Sesión completa (.JSON)
                    <input type="file" ref={jsonInputRef} className="hidden" accept=".json" onChange={handleLoadSession} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
              {/* Contextual Warning for Interlinking */}
              {masterRecipes.length === 0 && (
                 <div className="bg-blue-50 border border-blue-200 p-4 lg:p-6 rounded-[1.5rem] lg:rounded-2xl flex flex-col sm:flex-row items-center justify-between shadow-sm gap-4">
                    <div className="flex items-center gap-4 text-blue-700 w-full sm:w-auto">
                      <div className="bg-blue-500 text-white p-2 rounded-lg shrink-0"><Info size={20}/></div>
                      <div>
                        <p className="text-sm font-black italic">¿Añadir Interlinking?</p>
                        <p className="text-[10px] lg:text-xs font-medium opacity-80">Carga el Master List para el párrafo de variaciones.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => masterInputRef.current?.click()}
                        className="flex-1 sm:flex-none px-4 lg:px-6 py-2 bg-blue-600 text-white text-[10px] lg:text-xs font-black rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Upload size={14}/> Cargar Master
                      </button>
                      <button className="flex-1 sm:flex-none px-4 lg:px-6 py-2 bg-white text-blue-400 text-[10px] lg:text-xs font-black rounded-xl hover:bg-slate-50 transition-all">Omitir</button>
                    </div>
                 </div>
              )}

              <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
                  <StatCard label="Cargadas" value={recipes.length} icon={<FileSpreadsheet size={16}/>} />
                  <StatCard label="Master" value={masterRecipes.length} icon={<Link size={16}/>} />
                  <StatCard label="OK" value={totalCompleted} isHighlight icon={<CheckCircle size={16}/>} />
                  <StatCard label="Errores" value={recipes.filter(r => r.status === 'error').length} isError icon={<AlertCircle size={16}/>} />
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                   <button onClick={() => { if(confirm("¿Seguro que quieres limpiar todo?")) setRecipes([]); }} className="p-4 bg-white border rounded-2xl text-slate-300 hover:text-red-500 transition-all shadow-sm flex-1 lg:flex-none flex justify-center items-center"><Trash2 /></button>
                   <button onClick={runBulkGeneration} disabled={step === GenerationStep.GENERATING} className="flex-1 px-8 lg:px-10 py-4 bg-[#005999] text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 hover:bg-[#004a80] transition-all active:scale-95">
                    {step === GenerationStep.GENERATING ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />} 
                    <span className="whitespace-nowrap">Iniciar Bulk</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl lg:rounded-3xl border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-6 lg:px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Receta</th>
                        <th className="px-6 lg:px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Producto</th>
                        <th className="px-6 lg:px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Interlinking</th>
                        <th className="px-6 lg:px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-center">Estado</th>
                        <th className="px-6 lg:px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {recipes.map((r, i) => (
                        <tr key={i} className="hover:bg-[#FFD200]/5 transition-colors">
                          <td className="px-6 lg:px-8 py-4 font-bold text-sm lg:text-base">{r.input.heroKeyword}</td>
                          <td className="px-6 lg:px-8 py-4 text-[10px] lg:text-xs font-black text-[#005999]">{r.input.gbProduct}</td>
                          <td className="px-6 lg:px-8 py-4 text-center">
                            {masterRecipes.length > 0 ? (
                              <span className="text-green-500 flex justify-center" title={`${masterRecipes.length} opciones disponibles`}><Link size={14}/></span>
                            ) : (
                              <span className="text-slate-300 flex justify-center" title="No hay master de interlinking cargado">-</span>
                            )}
                          </td>
                          <td className="px-6 lg:px-8 py-4 text-center">
                            <span className={`px-2 lg:px-3 py-1 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest ${r.status === 'completed' ? 'bg-[#005999] text-white' : r.status === 'error' ? 'bg-red-500 text-white' : r.status === 'processing' ? 'bg-[#FFD200] text-[#005999] animate-pulse' : 'bg-slate-100 text-slate-400'}`}>{r.status}</span>
                          </td>
                          <td className="px-6 lg:px-8 py-4 text-right">
                            {r.status === 'completed' && <button onClick={() => setPreviewRecipe(r)} className="text-[#005999] p-2 hover:bg-[#FFD200]/20 rounded-lg"><Eye size={18}/></button>}
                            {r.status === 'error' && <span title={r.error} className="text-red-500"><AlertCircle size={18} /></span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {showPromptsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 lg:p-12 bg-[#005999]/40 backdrop-blur-md overflow-hidden">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-7xl sm:max-h-[90vh] sm:rounded-[2rem] lg:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border">
            <div className="px-6 lg:px-10 py-4 lg:py-6 border-b flex items-center justify-between sticky top-0 z-20 bg-white">
              <div className="flex items-center gap-3 lg:gap-6">
                <div className="bg-[#005999] text-[#FFD200] p-2 lg:p-4 rounded-xl lg:rounded-3xl shadow-xl"><Terminal size={24} /></div>
                <div>
                  <h3 className="font-black text-[#005999] text-lg lg:text-3xl italic">Control de Prompts</h3>
                  <p className="text-[9px] lg:text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2"><Info size={10} className="text-[#FFD200]" /> Variables dinámicas del Excel</p>
                </div>
              </div>
              <button onClick={() => setShowPromptsModal(false)} className="p-2 text-[#005999] hover:rotate-90 transition-all"><X size={28} /></button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-slate-50/50">
              <div className="w-full lg:w-72 border-b lg:border-r p-4 lg:p-8 space-y-4 lg:space-y-8 overflow-y-auto shrink-0 bg-white lg:bg-transparent">
                <h4 className="text-[10px] font-black text-[#005999] uppercase tracking-widest bg-[#FFD200]/20 px-3 py-1.5 rounded-lg">Variables Dinámicas</h4>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                  {[
                    { t: '{{heroKW}}', d: 'Receta' },
                    { t: '{{topKeyword}}', d: 'KW TOP' },
                    { t: '{{secondaryKws}}', d: 'Kws Intro' },
                    { t: '{{relatedRecipesCandidates}}', d: 'Links' },
                    { t: '{{gbIngredient}}', d: 'Producto' }
                  ].map(v => (
                    <div key={v.t} className="bg-white border p-2 lg:p-3 rounded-xl shadow-sm">
                      <code className="text-[9px] lg:text-[11px] font-black text-[#005999] block">{v.t}</code>
                      <span className="text-[8px] lg:text-[9px] text-slate-400 uppercase font-bold">{v.d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 p-4 lg:p-12 overflow-y-auto space-y-8 lg:space-y-12 bg-white">
                <div className="space-y-2 lg:space-y-4">
                  <label className="text-[10px] lg:text-[11px] font-black uppercase text-[#005999]">1. System Prompt</label>
                  <textarea value={systemPrompt} onChange={(e) => updateSetting('gb_system_prompt', e.target.value)} className="w-full h-32 lg:h-48 bg-slate-900 rounded-xl lg:rounded-3xl p-4 lg:p-8 text-xs lg:text-sm text-emerald-400 font-mono focus:ring-4 focus:ring-[#FFD200]/10 outline-none shadow-xl" />
                </div>
                <div className="space-y-2 lg:space-y-4">
                  <label className="text-[10px] lg:text-[11px] font-black uppercase text-[#005999]">2. User Prompt Template</label>
                  <textarea value={userPrompt} onChange={(e) => updateSetting('gb_user_prompt_template', e.target.value)} className="w-full h-[300px] lg:h-[600px] bg-slate-900 rounded-xl lg:rounded-[2.5rem] p-4 lg:p-8 text-xs lg:text-sm text-blue-300 font-mono focus:ring-4 focus:ring-[#005999]/10 outline-none shadow-xl" />
                </div>
              </div>
            </div>

            <div className="p-4 lg:p-10 bg-white border-t flex flex-col sm:flex-row items-center justify-between gap-4">
              <button onClick={() => { if(confirm("¿Restaurar originales?")) { updateSetting('gb_system_prompt', DEFAULT_SYSTEM_PROMPT); updateSetting('gb_user_prompt_template', DEFAULT_USER_PROMPT_TEMPLATE); } }} className="w-full sm:w-auto px-6 py-3 text-[10px] lg:text-xs font-black text-red-500 hover:bg-red-50 rounded-xl uppercase tracking-widest border border-transparent hover:border-red-100">Restaurar Fábrica</button>
              <button onClick={() => setShowPromptsModal(false)} className="w-full sm:w-auto px-10 py-4 lg:px-14 lg:py-5 bg-[#005999] text-white rounded-xl lg:rounded-[2rem] font-black shadow-2xl hover:bg-[#004a80] transition-all active:scale-95 flex items-center justify-center gap-2">
                <Save size={18} /> GUARDAR CONFIGURACIÓN
              </button>
            </div>
          </div>
        </div>
      )}

      {previewRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 bg-[#005999]/30 backdrop-blur-sm overflow-hidden">
          <div className="bg-white w-full h-full sm:max-w-6xl sm:max-h-full sm:rounded-[2rem] lg:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border-t-[8px] lg:border-t-[12px] border-[#FFD200]">
            <div className="px-6 lg:px-10 py-6 lg:py-8 border-b flex items-center justify-between sticky top-0 z-10 bg-white">
              <div className="flex items-center gap-4 lg:gap-6">
                <img src={GB_LOGO_URL} alt="GB" className="h-8 lg:h-10" />
                <div>
                  <h3 className="font-black text-[#005999] text-lg lg:text-2xl italic line-clamp-1">{previewRecipe.input.heroKeyword}</h3>
                  <p className="text-[9px] lg:text-xs text-slate-400 font-black uppercase tracking-tighter">PRODUCTO: {previewRecipe.input.gbProduct}</p>
                </div>
              </div>
              <button onClick={() => setPreviewRecipe(null)} className="p-2 text-[#005999] hover:bg-slate-50 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 lg:p-12 space-y-8 lg:space-y-12 bg-slate-50/20">
              <Section label="Editorial Gallina Blanca" content={previewRecipe.introduccion} />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="overflow-x-auto">
                  <Section label="Tabla Nutricional" content={previewRecipe.infoNutricional} />
                </div>
                <div className="bg-white p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] border shadow-sm space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-[#005999] border-b border-[#FFD200]/30 pb-2">Macros</h4>
                  <div className="grid grid-cols-2 gap-3 lg:gap-4 text-center">
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] uppercase font-bold text-slate-400">Energía</p><p className="font-black text-sm lg:text-base text-[#005999]">{previewRecipe.energia}</p></div>
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] uppercase font-bold text-slate-400">Hidratos</p><p className="font-black text-sm lg:text-base text-[#005999]">{previewRecipe.hidratos}</p></div>
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] uppercase font-bold text-slate-400">Grasas</p><p className="font-black text-sm lg:text-base text-[#005999]">{previewRecipe.grasas}</p></div>
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] uppercase font-bold text-slate-400">Proteínas</p><p className="font-black text-sm lg:text-base text-[#005999]">{previewRecipe.proteinas}</p></div>
                  </div>
                </div>
              </div>

              <Section label="Preparación Detallada" content={previewRecipe.pasos.map((p, idx) => `
                <div class="mb-8 lg:mb-12 bg-white p-6 lg:p-8 rounded-2xl lg:rounded-3xl border shadow-sm">
                  <strong class="text-lg lg:text-xl text-[#005999] block mb-4 italic border-l-4 border-[#FFD200] pl-4">${idx+1}. ${p.title}</strong>
                  <div class="text-slate-600 space-y-4 text-xs lg:text-sm">${p.content}</div>
                </div>`).join('')} 
              />
              
              <div className="space-y-4 lg:space-y-6">
                <Section label="Conclusión y Servicio" content={previewRecipe.conclusion} />
                {previewRecipe.relatedRecipesHtml && (
                  <div className="bg-[#005999]/5 border border-[#005999]/10 p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] shadow-inner">
                    <h4 className="text-[10px] font-black uppercase text-[#005999] mb-4 flex items-center gap-2">
                      <Link size={12} /> Variaciones y Recetas Similares
                    </h4>
                    <div className="prose prose-blue max-w-none text-slate-700 font-medium italic text-xs lg:text-sm" dangerouslySetInnerHTML={{ __html: previewRecipe.relatedRecipesHtml }} />
                  </div>
                )}
              </div>

              <div className="space-y-4 pb-10">
                <p className="text-[10px] font-black text-[#005999] uppercase">Dudas de la Comunidad</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {previewRecipe.faqList.map((f, i) => (
                    <div key={i} className="bg-white p-5 lg:p-6 rounded-2xl border shadow-sm group hover:border-[#FFD200] transition-colors">
                      <h4 className="font-bold text-[#005999] mb-2 text-sm lg:text-base">{f.question}</h4>
                      <p className="text-xs lg:text-sm text-slate-500 italic leading-relaxed">{f.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const StatCard = ({ label, value, icon, isHighlight, isError }: any) => (
  <div className={`p-4 lg:p-5 rounded-xl lg:rounded-2xl border transition-all ${isHighlight ? 'bg-white border-[#FFD200] text-[#005999] shadow-lg shadow-[#FFD200]/10' : isError ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}>
    <div className="flex items-center justify-between mb-1 lg:mb-2">
      <span className="text-[8px] lg:text-[9px] font-black uppercase opacity-60 tracking-widest">{label}</span>
      <div className={isHighlight ? 'text-[#FFD200]' : 'text-[#005999]'}>{icon}</div>
    </div>
    <p className="text-xl lg:text-2xl font-black truncate">{value}</p>
  </div>
);

const Section = ({ label, content }: any) => (
  <div className="bg-white p-5 lg:p-8 rounded-2xl lg:rounded-[2rem] border shadow-sm relative overflow-hidden">
    <h4 className="text-[10px] font-black uppercase text-[#005999] mb-4 lg:mb-6 border-b border-[#FFD200]/20 pb-2">{label}</h4>
    <div className="prose prose-slate max-w-none text-slate-600 text-xs lg:text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />
  </div>
);

const ActionButton = ({ onClick, disabled, icon, label }: any) => (
  <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 px-2 sm:px-4 lg:px-5 py-2 lg:py-2.5 bg-[#005999] hover:bg-[#004a80] text-white rounded-lg lg:rounded-xl text-[9px] lg:text-xs font-black disabled:opacity-50 transition-all shadow-md active:scale-95 uppercase tracking-tighter shrink-0">
    <span className="shrink-0">{icon}</span> 
    <span className="hidden xs:inline">{label}</span>
  </button>
);

const CredentialInput = ({ label, value, onChange }: any) => (
  <div className="space-y-1">
    <label className="text-[8px] lg:text-[9px] uppercase font-bold text-slate-500">{label}</label>
    <input type="password" value={value} onChange={e => onChange(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 lg:py-3 text-xs text-white outline-none focus:ring-1 focus:ring-[#FFD200] transition-all" placeholder="••••••••" />
  </div>
);
