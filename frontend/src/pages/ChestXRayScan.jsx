import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { detectChestAnomaly, checkChestServerHealth } from '../services/lungdetect';
import { fetchReport } from '../services/aiTriage';
import {
    Camera, Upload, Loader2, AlertTriangle, ArrowLeft,
    ShieldAlert, ChevronRight, RefreshCw, Wifi, WifiOff,
    HeartPulse, Scan, Image as ImageIcon, X, FileText,
    CheckCircle2, AlertCircle, Activity, ShieldCheck
} from 'lucide-react';

const URGENCY_STYLES = {
    normal: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
    anomaly: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' }
};

const isNormalClass = (pred) => {
    if (!pred) return true;
    const normalized = pred.toUpperCase();
    return normalized === 'NORMAL' || normalized === 'NORMAL LUNGS';
};

const CHEST_INFO = {
    "NORMAL": {
        what: "Your chest X-ray shows no visible signs of pneumonia or other major lung anomalies. The lung fields are clear, and cardiac size is within normal limits.",
        causes: ["Healthy lung tissue", "Absence of active respiratory infection", "Proper ventilation and hydration", "No significant occupational exposure to irritants"],
        symptoms: ["Clear breathing without pain", "Normal oxygen saturation levels", "No chronic or productive cough", "Good exercise tolerance"],
        treatment: ["Maintain healthy lungs through aerobic exercise", "Avoid smoking and secondhand smoke", "Keep up with routine checkups", "Stay hydrated and practice deep breathing"],
        prevention: ["Get annual influenza and pneumonia vaccines if eligible", "Wash hands regularly to avoid respiratory viruses", "Wear masks in high-dust/polluted areas"],
        prognosis: "Excellent. Keep maintaining a healthy lifestyle to support respiratory wellness."
    },
    "Normal": {
        what: "Your chest X-ray shows no visible signs of pneumonia or other major lung anomalies. The lung fields are clear, and cardiac size is within normal limits.",
        causes: ["Healthy lung tissue", "Absence of active respiratory infection", "Proper ventilation and hydration", "No significant occupational exposure to irritants"],
        symptoms: ["Clear breathing without pain", "Normal oxygen saturation levels", "No chronic or productive cough", "Good exercise tolerance"],
        treatment: ["Maintain healthy lungs through aerobic exercise", "Avoid smoking and secondhand smoke", "Keep up with routine checkups", "Stay hydrated and practice deep breathing"],
        prevention: ["Get annual influenza and pneumonia vaccines if eligible", "Wash hands regularly to avoid respiratory viruses", "Wear masks in high-dust/polluted areas"],
        prognosis: "Excellent. Keep maintaining a healthy lifestyle to support respiratory wellness."
    },
    "PNEUMONIA": {
        what: "An infection that inflames the air sacs in one or both lungs. The air sacs may fill with fluid or pus, causing cough with phlegm, fever, chills, and difficulty breathing.",
        causes: ["Bacterial infection (e.g., Streptococcus pneumoniae)", "Viral infection (e.g., Influenza, COVID-19)", "Fungal infections (more common in immunocompromised individuals)", "Aspiration of food, liquid, or vomit"],
        symptoms: ["Chest pain when breathing or coughing", "Shortness of breath (dyspnea)", "Cough, which may produce phlegm", "Fever, sweating, and shaking chills", "Fatigue and muscle aches"],
        treatment: ["Antibiotics (for bacterial pneumonia)", "Antiviral medications (for viral pneumonia)", "Rest and plenty of fluids", "Cough medicine to calm cough", "Fever reducers (e.g., paracetamol)", "Oxygen therapy or hospitalization in severe cases"],
        prevention: ["Pneumococcal and influenza vaccination", "Practice good hygiene (frequent handwashing)", "Avoid smoking (which damages lung defenses)", "Strengthen immune system with proper nutrition"],
        prognosis: "Good if treated early. Most healthy individuals recover in 1 to 3 weeks, but it can be life-threatening for elderly, infants, or immunocompromised individuals."
    },
    "Pneumonia-Bacterial": {
        what: "An infection of the lungs caused by bacteria, most commonly Streptococcus pneumoniae. It inflames the air sacs (alveoli) and causes them to fill with fluid or pus.",
        causes: ["Streptococcus pneumoniae bacteria", "Haemophilus influenzae bacteria", "Aspiration of fluids or foreign particles", "Secondary infection after a viral respiratory illness"],
        symptoms: ["High fever, shaking chills", "Cough with green, yellow, or rusty-colored phlegm", "Chest pain that worsens with breathing or coughing", "Shortness of breath and rapid breathing", "Fatigue and loss of appetite"],
        treatment: ["Prescription course of antibiotics (critical to complete)", "Rest and warm fluids", "Fever reducers (e.g. Paracetamol)", "Hospital care or oxygen if breathing becomes labored"],
        prevention: ["Pneumococcal conjugate vaccination", "Getting annual flu shots to prevent secondary infections", "Good hygiene and frequent hand washing"],
        prognosis: "Good with early antibiotic therapy. Complete recovery generally takes 1 to 3 weeks."
    },
    "Pneumonia-Viral": {
        what: "A lung infection caused by a virus. It accounts for about a third of all pneumonia cases and is commonly caused by flu, RSV, or coronavirus.",
        causes: ["Influenza viruses (A and B)", "Respiratory Syncytial Virus (RSV)", "Coronaviruses (including SARS-CoV-2)", "Rhinoviruses or Adenoviruses"],
        symptoms: ["Dry or hacking cough", "Moderate fever and muscle aches", "Headaches and progressive fatigue", "Shortness of breath (dyspnea)", "Sore throat and nasal congestion"],
        treatment: ["Antiviral drugs if prescribed early", "Symptomatic treatment (cough syrup, rest, fluids)", "Monitoring oxygen levels", "Supportive care in hospital if breathing becomes difficult"],
        prevention: ["Annual influenza vaccination", "COVID-19 vaccination", "Avoiding close contact with sick people, handwashing"],
        prognosis: "Most viral pneumonias clear in 1-3 weeks. Recovery may take longer in elderly or young patients."
    },
    "Tuberculosis": {
        what: "A contagious bacterial infection caused by Mycobacterium tuberculosis that primarily affects the lungs. It can spread through airborne droplets when an active patient coughs.",
        causes: ["Mycobacterium tuberculosis bacteria", "Prolonged contact with an active TB patient", "Weakened immune system (malnutrition, immune-suppressing drugs, HIV)"],
        symptoms: ["Persistent cough lasting 3 or more weeks", "Coughing up blood or rust-colored sputum", "Unexplained weight loss and loss of appetite", "Fever, chills, and drenching night sweats", "Chest pain during breathing"],
        treatment: ["Long-term combination therapy of specialized antibiotics (Rifampin, Isoniazid, etc.)", "Strict adherence to a 6-month or 9-month medication course", "Directly Observed Therapy (DOT) to ensure adherence"],
        prevention: ["BCG vaccine in endemic countries", "Isolating active infectious patients", "Symptom screenings and preventative treatment for latent TB cases"],
        prognosis: "Excellent if the full medication course is strictly followed. Incomplete treatment risks drug-resistant TB."
    },
    "Covid-19": {
        what: "An acute respiratory disease caused by the SARS-CoV-2 virus, which can progress to viral pneumonia and cause severe lung consolidation.",
        causes: ["SARS-CoV-2 coronavirus infection", "Inhalation of virus-laden respiratory droplets", "Touching contaminated surfaces followed by face contact"],
        symptoms: ["Fever, dry cough, and shortness of breath", "Sudden loss of taste or smell", "Severe fatigue, sore throat, and muscle aches", "Chest tightness or breathing difficulty in severe cases"],
        treatment: ["Symptomatic relief (fever reducers, hydration, rest)", "Antiviral drugs (e.g. Paxlovid) for eligible patients", "Oxygen therapy or ventilation for severe respiratory distress"],
        prevention: ["Up-to-date COVID-19 vaccination and boosters", "Wearing high-filtration masks in crowded settings", "Good ventilation and hand hygiene"],
        prognosis: "Most individuals recover in 1 to 2 weeks, but high-risk populations have a greater risk of long-term symptoms or complications."
    },
    "Emphysema": {
        what: "A chronic lung condition and form of COPD (Chronic Obstructive Pulmonary Disease) characterized by the destruction of the air sacs (alveoli), reducing lung elasticity and oxygen exchange.",
        causes: ["Long-term cigarette smoking (primary risk factor)", "Exposure to secondhand smoke or air pollution", "Occupational exposure to chemical fumes and dust", "Alpha-1 antitrypsin deficiency (genetic deficiency)"],
        symptoms: ["Progressive shortness of breath, especially during exertion", "Chronic wheezing and chest tightness", "Ongoing cough with mucus production", "Fatigue and weight loss in advanced stages"],
        treatment: ["Smoking cessation is critical to halt further damage", "Bronchodilators and inhaled steroids to ease breathing", "Oxygen therapy and pulmonary rehabilitation", "Surgical options or lung transplantation in severe cases"],
        prevention: ["Avoiding active and passive smoking", "Reducing exposure to industrial dust and chemical fumes", "Healthy lifestyle and regular vaccinations (flu/pneumonia)"],
        prognosis: "Irreversible damage, but progression can be successfully slowed and symptoms managed with treatment."
    }
};

function SimpleMarkdown({ text }) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { elements.push(<br key={i} />); continue; }

        if (/^[A-Z][a-zA-Z\s]+:/.test(trimmed)) {
            const [label, ...rest] = trimmed.split(':');
            elements.push(
                <div key={i} className="mb-2">
                    <span className="font-black text-gray-800 text-sm">{label}:</span>
                    <span className="text-gray-600 text-sm ml-1">{rest.join(':').trim()}</span>
                </div>
            );
            continue;
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            elements.push(
                <div key={i} className="flex gap-2 ml-2 mb-1">
                    <span className="text-teal-500 mt-0.5">•</span>
                    <span className="text-gray-600 text-sm">{trimmed.slice(2)}</span>
                </div>
            );
            continue;
        }

        if (trimmed.startsWith('# ')) {
            elements.push(<h3 key={i} className="text-lg font-black text-gray-900 mt-4 mb-2">{trimmed.slice(2)}</h3>);
            continue;
        }

        elements.push(<p key={i} className="text-gray-600 text-sm mb-1">{trimmed}</p>);
    }

    return <div>{elements}</div>;
}

export default function ChestXRayScan() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [imagePreview, setImagePreview] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [reportText, setReportText] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [serverOnline, setServerOnline] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);

    // Check server health on mount
    React.useEffect(() => {
        checkChestServerHealth().then(h => setServerOnline(!!h?.status));
    }, []);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file (JPG, PNG, etc.)');
            return;
        }
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        setResult(null);
        setReportText(null);
        setSaveStatus(null);
        setError(null);
    };

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 640, height: 480 }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setCameraActive(true);
            setError(null);
        } catch (err) {
            setError('Camera access denied. Please allow camera permission or use file upload.');
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (videoRef.current?.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    }, []);

    const capturePhoto = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], 'chest_xray_capture.jpg', { type: 'image/jpeg' });
                setImageFile(file);
                setImagePreview(canvas.toDataURL('image/jpeg'));
                setResult(null);
                setReportText(null);
                setSaveStatus(null);
                stopCamera();
            }
        }, 'image/jpeg', 0.9);
    }, [stopCamera]);

    const handleAnalyze = async () => {
        if (!imageFile) return;
        setIsAnalyzing(true);
        setError(null);
        setResult(null);
        setReportText(null);
        setSaveStatus(null);

        try {
            const res = await detectChestAnomaly(imageFile);
            setResult(res);
            await handleAutoSave(res);
        } catch (err) {
            setError(err.message || 'Analysis failed. Please try again.');
        }
        setIsAnalyzing(false);
    };

    const handleAutoSave = async (analysisResult) => {
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSaveStatus('demo-unsaved');
                setIsSaving(false);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user.id)
                .single();

            const mockImageUrl = `https://supabase.co/storage/v1/object/public/scans/xray_${Date.now()}.jpg`;

            const { error: insertError } = await supabase
                .from('chest_xray_scans')
                .insert({
                    patient_id: profile?.id || null,
                    image_url: mockImageUrl,
                    prediction_label: analysisResult.prediction,
                    confidence_score: analysisResult.confidence,
                    ai_report: isNormalClass(analysisResult.prediction) 
                        ? 'Lungs appear clear.' 
                        : `Possible pulmonary anomaly observed: ${analysisResult.prediction}.`
                });

            if (insertError) throw insertError;
            setSaveStatus('saved');
        } catch (err) {
            console.error('Error saving scan:', err);
            setSaveStatus('error');
        }
        setIsSaving(false);
    };

    const handleLoadReport = async () => {
        if (!result?.prediction) return;
        setReportLoading(true);
        try {
            // lazy-load detailed clinical report using Gemini report API on triage backend
            const report = await fetchReport(result.prediction);
            setReportText(report || `Detailed report for ${result.prediction} could not be generated.`);
        } catch {
            setReportText('Report generation failed. Please try again later.');
        }
        setReportLoading(false);
    };

    const handleReset = () => {
        setImagePreview(null);
        setImageFile(null);
        setResult(null);
        setReportText(null);
        setSaveStatus(null);
        setError(null);
        stopCamera();
    };

    const styleKey = isNormalClass(result?.prediction) ? 'normal' : 'anomaly';
    const activeStyle = result ? URGENCY_STYLES[styleKey] : null;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Navigation */}
            <nav className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-white/80">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-50 rounded-xl transition">
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="w-10 h-10 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-600/20">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-black text-gray-900 text-sm md:text-lg tracking-tight">Chest X-Ray Scanner</h1>
                        <p className="text-[10px] md:text-xs font-bold text-teal-600 uppercase tracking-widest">Respiratory AI Diagnostics</p>
                    </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${serverOnline ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                    {serverOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    {serverOnline ? 'AI Connected' : 'Offline'}
                </div>
            </nav>

            <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
                {/* Instructions */}
                {!imagePreview && !cameraActive && (
                    <div className="bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-teal-100">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                        <div className="relative z-10">
                            <h2 className="text-2xl font-black mb-2">🫁 Chest Anomaly Scanner</h2>
                            <p className="text-teal-100 text-sm font-medium leading-relaxed mb-4">
                                Upload a clear digital Chest X-Ray or take a photo of an X-Ray film. The convolutional neural network will analyze the image for pulmonary anomalies such as pneumonia.
                            </p>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Pneumonia Detection</span>
                                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Instant CNN Inference</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload or Camera choices */}
                {!imagePreview && !cameraActive && (
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={startCamera}
                            className="bg-white border-2 border-dashed border-teal-200 rounded-3xl p-8 flex flex-col items-center gap-4 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-50 transition-all group">
                            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Camera className="w-8 h-8 text-teal-600" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-900 text-sm">Use Camera</p>
                                <p className="text-[10px] text-gray-400 font-bold">Capture X-Ray film</p>
                            </div>
                        </button>

                        <button onClick={() => fileInputRef.current?.click()}
                            className="bg-white border-2 border-dashed border-cyan-200 rounded-3xl p-8 flex flex-col items-center gap-4 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-50 transition-all group">
                            <div className="w-16 h-16 bg-cyan-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-cyan-600" />
                            </div>
                            <div className="text-center">
                                <p className="font-black text-gray-900 text-sm">Upload File</p>
                                <p className="text-[10px] text-gray-400 font-bold">Image from gallery</p>
                            </div>
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                    </div>
                )}

                {/* Active Camera View */}
                {cameraActive && (
                    <div className="bg-black rounded-3xl overflow-hidden relative shadow-xl">
                        <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-[4/3] object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-center gap-4">
                            <button onClick={stopCamera} className="p-3 bg-white/20 backdrop-blur rounded-full text-white hover:bg-white/30">
                                <X className="w-6 h-6" />
                            </button>
                            <button onClick={capturePhoto}
                                className="w-16 h-16 bg-white rounded-full border-4 border-teal-500 shadow-lg hover:scale-110 transition-transform flex items-center justify-center">
                                <div className="w-12 h-12 bg-teal-500 rounded-full" />
                            </button>
                            <div className="w-12" />
                        </div>
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                )}

                {/* Selected/Captured Image Preview */}
                {imagePreview && (
                    <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                        <div className="relative">
                            <img src={imagePreview} alt="Chest X-Ray preview" className="w-full aspect-square object-cover" />
                            <button onClick={handleReset}
                                className="absolute top-3 right-3 p-2.5 bg-black/50 backdrop-blur text-white rounded-xl hover:bg-black/70 transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {!result && (
                            <div className="p-5">
                                <button onClick={handleAnalyze} disabled={isAnalyzing}
                                    className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-teal-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                                    {isAnalyzing ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> CNN Analyzing X-Ray...</>
                                    ) : (
                                        <><Scan className="w-5 h-5" /> RUN DEEP INFERENCE</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Errors display */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-red-700">{error}</p>
                            <button onClick={handleReset} className="text-xs text-red-500 font-bold mt-1 underline">Reset & Try Again</button>
                        </div>
                    </div>
                )}

                {/* Results Card */}
                {result && (
                    <div className={`${activeStyle.bg} ${activeStyle.border} border rounded-3xl p-6 shadow-sm space-y-4`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">CNN Classification</p>
                                <h3 className="text-2xl font-black text-gray-900">{result.prediction}</h3>
                            </div>
                            <span className={`${activeStyle.badge} px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider`}>
                                {isNormalClass(result.prediction) ? '✅ NORMAL' : '⚠️ ANOMALY'}
                            </span>
                        </div>

                        {/* Confidence score */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-500">Classification Confidence</span>
                                <span className="text-sm font-black text-gray-800">{(result.confidence * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-white/80 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${isNormalClass(result.prediction) ? 'bg-green-500' : 'bg-red-500'}`}
                                    style={{ width: `${result.confidence * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Recommended Specialist */}
                        <div className="bg-white/60 rounded-2xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                                <HeartPulse className="w-5 h-5 text-teal-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recommended Specialist</p>
                                <p className="text-sm font-black text-gray-800">
                                    {isNormalClass(result.prediction) ? 'General Physician' : 'Pulmonologist / Chest Specialist'}
                                </p>
                            </div>
                        </div>

                        {/* Database Sync Status */}
                        {saveStatus === 'saved' && (
                            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100/50 p-3 rounded-xl border border-green-200">
                                <ShieldCheck className="w-4 h-4 text-green-600" />
                                <span>Scan result synced and logged to patient health records.</span>
                            </div>
                        )}
                        {saveStatus === 'demo-unsaved' && (
                            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/50 p-3 rounded-xl border border-amber-200">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span>Demo Mode: Scan analyzed but not saved (no active auth session).</span>
                            </div>
                        )}

                        {/* Chest Info Panel */}
                        {CHEST_INFO[result.prediction] && (() => {
                            const info = CHEST_INFO[result.prediction];
                            return (
                                <div className="mt-4 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Clinical Reference</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-gray-800 mb-1">📋 Description</p>
                                        <p className="text-xs text-gray-600 leading-relaxed">{info.what}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-gray-800 mb-1">⚡ Causes / Factors</p>
                                        <div className="space-y-1">
                                            {info.causes.map((c, i) => (
                                                <div key={i} className="flex items-start gap-2 ml-1">
                                                    <span className="text-teal-400 mt-0.5 text-[10px]">•</span>
                                                    <span className="text-xs text-gray-600">{c}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-gray-800 mb-1">🔍 Symptoms</p>
                                        <div className="space-y-1">
                                            {info.symptoms.map((s, i) => (
                                                <div key={i} className="flex items-start gap-2 ml-1">
                                                    <span className="text-amber-400 mt-0.5 text-[10px]">•</span>
                                                    <span className="text-xs text-gray-600">{s}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-gray-800 mb-1">💊 Care Options</p>
                                        <div className="space-y-1">
                                            {info.treatment.map((t, i) => (
                                                <div key={i} className="flex items-start gap-2 ml-1">
                                                    <span className="text-green-400 mt-0.5 text-[10px]">•</span>
                                                    <span className="text-xs text-gray-600">{t}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Gemini AI detailed Report section */}
                        <div>
                            {!reportText ? (
                                <button onClick={handleLoadReport} disabled={reportLoading}
                                    className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-2">
                                    {reportLoading ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI Report...</>
                                    ) : (
                                        <><FileText className="w-4 h-4" /> GENERATE AI MEDICAL EXPLANATION</>
                                    )}
                                </button>
                            ) : (
                                <div className="bg-white rounded-2xl p-5 border border-indigo-100 space-y-3">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gemini AI Explanations</span>
                                        </div>
                                        <span className="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded-full">REALTIME REPORT</span>
                                    </div>
                                    <div className="prose max-w-none">
                                        <SimpleMarkdown text={reportText} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Reset action */}
                        <button onClick={handleReset}
                            className="w-full py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-black text-xs rounded-2xl border border-gray-200 flex items-center justify-center gap-2 shadow-sm">
                            <RefreshCw className="w-4 h-4" /> SCAN ANOTHER X-RAY
                        </button>
                    </div>
                )}

                {/* Disclaimer */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-800 mb-1">Medical Disclaimer</p>
                        <p className="text-[10px] text-amber-700 leading-relaxed">
                            This scanner is powered by a standard machine learning convolutional neural network (CNN) and is intended for informational/rural triage support only. It does not replace professional medical advice, chest exams, or physical doctor consultations.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
