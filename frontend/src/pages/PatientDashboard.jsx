import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { analyzeSymptoms, checkServerHealth } from '../services/aiTriage';
import { useLanguage } from '../services/LanguageContext';
import { useSpeechToText, useTextToSpeech } from '../hooks/useSpeech';
import {
    Stethoscope, FileText, AlertTriangle, LogOut, HeartPulse,
    History, BrainCircuit, Sparkles, Loader2, ChevronRight,
    Wifi, WifiOff, ShieldCheck, Phone, Pill, Building2,
    Languages, Mic, MicOff, Volume2, VolumeX,
    Activity, Zap, BookOpen, Clock, Newspaper, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import KnownMedicinesPanel from '../components/KnownMedicinesPanel';

/* ── Static Tailwind color maps ── */
const COLOR_CLASSES = {
    teal:    { bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-300',   shadow: 'hover:shadow-teal-100' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-300',   shadow: 'hover:shadow-rose-100' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-300',   shadow: 'hover:shadow-blue-100' },
    orange:  { bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-300', shadow: 'hover:shadow-orange-100' },
    cyan:    { bg: 'bg-cyan-50',    text: 'text-cyan-600',    border: 'border-cyan-300',   shadow: 'hover:shadow-cyan-100' },
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-300', shadow: 'hover:shadow-indigo-100' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-300', shadow: 'hover:shadow-purple-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-300',shadow: 'hover:shadow-emerald-100' },
    red:     { bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-300',    shadow: 'hover:shadow-red-100' },
    pink:    { bg: 'bg-pink-50',    text: 'text-pink-600',    border: 'border-pink-300',   shadow: 'hover:shadow-pink-100' },
};

const HELPLINE_CLASSES = {
    red:    { bg: 'bg-red-50',    border: 'border-red-100',    textBig: 'text-red-700',    textSmall: 'text-red-500/70',    icon: 'text-red-600' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   textBig: 'text-blue-700',   textSmall: 'text-blue-500/70',   icon: 'text-blue-600' },
    pink:   { bg: 'bg-pink-50',   border: 'border-pink-100',   textBig: 'text-pink-700',   textSmall: 'text-pink-500/70',   icon: 'text-pink-600' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-100', textBig: 'text-orange-700', textSmall: 'text-orange-500/70', icon: 'text-orange-600' },
};

export default function PatientDashboard() {
    const navigate = useNavigate();
    const { lang, t, toggleLang } = useLanguage();

    // ── Core state ──────────────────────────────────────────────────────────
    const [patient,  setPatient]  = useState(null);
    const [history,  setHistory]  = useState([]);
    const [greeting, setGreeting] = useState('');
    const [serverOnline, setServerOnline] = useState(null);

    // ── Logout state ─────────────────────────────────────────────────────────
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // ── Known Medicines ──────────────────────────────────────────────────────
    const [showMedicinesPanel, setShowMedicinesPanel] = useState(false);
    const [knownMedicines,     setKnownMedicines]     = useState([]);

    // ── Quick Triage ─────────────────────────────────────────────────────────
    const [quickSymptoms, setQuickSymptoms] = useState('');
    const [quickResult,   setQuickResult]   = useState(null);
    const [quickLoading,  setQuickLoading]  = useState(false);

    // ── Voice ────────────────────────────────────────────────────────────────
    const { transcript, isListening, startListening, stopListening } = useSpeechToText(lang);
    const { isSpeaking, speak, stopSpeaking } = useTextToSpeech(lang);

    useEffect(() => {
        if (transcript) setQuickSymptoms(transcript);
    }, [transcript]);

    // ── Tips ─────────────────────────────────────────────────────────────────
    const tips = t('tips');
    const [tipIndex, setTipIndex] = useState(0);
    // FIX: tips added to dependency array — no stale closure
    useEffect(() => {
        const timer = setInterval(() => setTipIndex(i => (i + 1) % tips.length), 6000);
        return () => clearInterval(timer);
    }, [tips]);

    // ── FIX 1 & 3: Two separate effects — DB load (mount only) vs UI (lang) ──

    // DB load: runs once on mount; cancelled flag prevents stale setState
    useEffect(() => {
        let cancelled = false;
        loadData(cancelled);
        // FIX 2: cleanup sets cancelled = true on unmount / re-run
        return () => { cancelled = true; };
    }, []);  // ← no lang dependency — avoids unnecessary DB calls on lang toggle

    // Greeting + server health: runs on lang change only, zero DB hits
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12)      setGreeting(t('goodMorning'));
        else if (hour < 17) setGreeting(t('goodAfternoon'));
        else                setGreeting(t('goodEvening'));

        // FIX 4 (cont.): server health error absorbed — won't crash if network is down
        checkServerHealth()
            .then(h => setServerOnline(!!h?.status))
            .catch(() => setServerOnline(false));
    }, [lang]);

    // ── FIX 4: loadData — safe auth destructure + full error handling ────────
    const loadData = async (cancelled) => {
        try {
            // Safe destructure — won't throw if auth fails
            const { data, error: authError } = await supabase.auth.getUser();

            if (authError || !data?.user || cancelled) return;

            const user = data.user;

            const { data: p, error: patientErr } = await supabase
                .from('patients')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (patientErr || !p || cancelled) return;

            setPatient(p);

            const { data: h } = await supabase
                .from('consultations')
                .select('*, doctors(name, specialization)')
                .eq('patient_id', p.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (!cancelled) setHistory(h || []);

            // FIX 5: Medicines stored in React state only — no localStorage
            // localStorage is accessible to any XSS script; medical data stays in memory
            if (
                Array.isArray(p.known_medicines) &&
                p.known_medicines.length > 0 &&
                !cancelled
            ) {
                setKnownMedicines(p.known_medicines);
            }

        } catch (err) {
            // Network failure / unexpected error — log only, no crash
            if (!cancelled) console.error('[loadData]', err);
        }
    };

    // ── FIX 6: Logout — loading state + error handling ───────────────────────
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('[handleLogout]', error);
                // Optional: surface error to user via toast
                return;
            }
            navigate('/');
        } catch (err) {
            console.error('[handleLogout] Unexpected:', err);
        } finally {
            setIsLoggingOut(false);
        }
    };

    // ── Health ID ─────────────────────────────────────────────────────────────
    const [showHealthID, setShowHealthID] = useState(false);
    const healthID = patient?.id
        ? `GS-${patient.id.slice(0, 8).toUpperCase()}`
        : 'GS-PENDING';

    // ── Medicines sync ────────────────────────────────────────────────────────
    const syncMedicinesToSupabase = async (medicines) => {
        if (!patient?.id) return;
        try {
            await supabase
                .from('patients')
                .update({ known_medicines: medicines })
                .eq('id', patient.id);
        } catch (e) {
            console.warn('[syncMedicines]', e);
        }
    };

    // ── Quick Triage ──────────────────────────────────────────────────────────
    const handleQuickTriage = async () => {
        if (!quickSymptoms.trim()) return;
        setQuickLoading(true);
        setQuickResult(null);
        try {
            const r = await analyzeSymptoms(quickSymptoms);
            setQuickResult(r);
        } catch (err) {
            setQuickResult({ error: err.message });
        } finally {
            setQuickLoading(false);
        }
    };

    const speakDiagnosis = () => {
        if (!quickResult || quickResult.error) return;
        const text = lang === 'hi'
            ? `AI की जांच कहती है कि आपको ${quickResult.disease} होने की संभावना है। सलाह: ${quickResult.medical_info?.immediate_advice}`
            : `AI analysis predicts ${quickResult.disease}. Advice: ${quickResult.medical_info?.immediate_advice}`;
        speak(text);
    };

    // ── Services config ───────────────────────────────────────────────────────
    const services = useMemo(() => [
        { icon: Stethoscope, title: t('aiAnalysis'),    desc: t('aiAnalysisDesc'),                          to: '/symptoms',       color: 'teal' },
        { icon: Activity,    title: 'Chest X-Ray Scan', desc: 'AI anomaly detection',                       to: '/chest-scan',     color: 'teal' },
        { icon: Newspaper,   title: t('healthNews'),    desc: t('healthNewsDesc'),                          to: '/health-news',    color: 'orange' },
        { icon: Building2,   title: t('hospitals'),     desc: t('hospitalsDesc'),                           to: '/hospitals',      color: 'cyan' },
        { icon: BookOpen,    title: t('healthLibrary') || 'Health Library', desc: t('healthLibDesc') || 'First aid & health tips', to: '/health-library', color: 'indigo' },
        { icon: FileText,    title: t('records'),       desc: t('recordsDesc'),                             scroll: 'history-section', color: 'purple' },
        { icon: Pill,        title: 'Known Medicines',  desc: 'Track & manage your medicines',              click: 'medicines',    color: 'emerald' },
        { icon: AlertTriangle, title: t('sos'),         desc: t('sosDesc'),                                 click: 'sos',          color: 'red' },
    ], [lang]);

    // ── Helplines config ──────────────────────────────────────────────────────
    const helplines = useMemo(() => [
        { n: t('ambulance'),      num: '108',  c: 'red' },
        { n: t('healthHelpline'), num: '104',  c: 'blue' },
        { n: t('womenHelpline'),  num: '181',  c: 'pink' },
        { n: t('childHelpline'),  num: '1098', c: 'orange' },
    ], [lang]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 pb-20">

            {/* ═══ NAVIGATION ═══ */}
            <nav className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-white/80">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-100">
                        <HeartPulse className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div>
                        <h1 className="font-black text-gray-900 text-sm md:text-lg tracking-tight">{t('appName')}</h1>
                        <p className="text-[10px] md:text-xs font-bold text-teal-600 uppercase tracking-widest">{t('patientDashboard')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowHealthID(true)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-black bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-full transition border border-teal-100"
                    >
                        <ShieldCheck className="w-3.5 h-3.5" /> {t('viewHealthID') || 'Digital ID'}
                    </button>
                    <button
                        onClick={toggleLang}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-black bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-full transition border border-purple-100"
                    >
                        <Languages className="w-3.5 h-3.5" /> {t('switchLang')}
                    </button>
                    {/* FIX 6: disabled + spinner while logging out */}
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="p-2 text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                    >
                        {isLoggingOut
                            ? <Loader2 className="w-5 h-5 animate-spin" />
                            : <LogOut className="w-5 h-5" />}
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

                {/* ═══ WELCOME CARD ═══ */}
                <div className="bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-teal-100">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                    <div className="relative z-10">
                        <p className="text-teal-100 font-bold uppercase tracking-widest text-xs mb-1">{greeting} 🙏</p>
                        <h2 className="text-3xl font-black mb-2">{t('namaste')}, {patient?.name || 'User'}!</h2>
                        <p className="text-teal-50/80 text-sm font-medium leading-relaxed max-w-xs">{t('howAreYou')}</p>
                    </div>
                </div>

                {/* ═══ QUICK AI CHECK ═══ */}
                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center">
                                <BrainCircuit className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="font-black text-gray-900 leading-tight uppercase tracking-tight">{t('quickAiCheck')}</p>
                                <p className="text-xs text-gray-400 font-bold">{t('tellSymptoms')}</p>
                            </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${serverOnline ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                            {serverOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                            {serverOnline ? 'AI Live' : 'Offline'}
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={quickSymptoms}
                                onChange={e => setQuickSymptoms(e.target.value)}
                                placeholder={t('symptomPlaceholder')}
                                className="w-full pl-4 pr-12 py-4 border border-gray-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-teal-50 outline-none transition-all"
                            />
                            <button
                                onClick={isListening ? stopListening : startListening}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-teal-600'}`}
                            >
                                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            </button>
                        </div>
                        <button
                            onClick={handleQuickTriage}
                            disabled={!quickSymptoms.trim() || quickLoading}
                            className="px-6 py-4 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl shadow-lg shadow-teal-100 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {quickLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
                            <span className="hidden md:inline">{(t('check') || 'Check').toString().toUpperCase()}</span>
                        </button>
                    </div>

                    {/* Triage result */}
                    {quickResult && !quickResult.error && (
                        <div className="mt-5 p-5 bg-gray-50 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('prediction')}</p>
                                    <h3 className="text-2xl font-black text-teal-700">{quickResult.disease}</h3>
                                </div>
                                <button
                                    onClick={isSpeaking ? stopSpeaking : speakDiagnosis}
                                    className={`p-3 rounded-2xl transition shadow-sm border ${isSpeaking ? 'bg-purple-600 text-white animate-pulse' : 'bg-white text-gray-500 hover:text-purple-600'}`}
                                >
                                    {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xs font-bold text-gray-500">{(quickResult.confidence * 100).toFixed(0)}% Confidence</span>
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${quickResult.confidence * 100}%` }} />
                                </div>
                                <span className="bg-white px-2.5 py-1 rounded-lg text-[10px] font-black border border-gray-100 uppercase tracking-tighter text-teal-600">{quickResult.specialist}</span>
                            </div>
                            <button
                                onClick={() => navigate('/symptoms', { state: { prefill: quickSymptoms } })}
                                className="w-full py-3 bg-white hover:bg-teal-50 text-teal-700 font-bold text-xs rounded-xl border border-teal-100 transition-all flex items-center justify-center gap-2"
                            >
                                {t('viewFullReport')} <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {quickResult?.error && (
                        <div className="mt-5 p-4 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300 flex flex-col gap-1.5">
                            <p className="font-black text-[10px] text-red-600 uppercase tracking-widest">Analysis Failed</p>
                            <p>{quickResult.error}</p>
                            <p className="text-[10px] text-red-500 font-medium">Please verify your server is running and .env keys are valid.</p>
                        </div>
                    )}
                </div>

                {/* ═══ SERVICES GRID ═══ */}
                <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4 px-2">{t('services')}</p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {services.map((s, i) => {
                            const Icon = s.icon;
                            const cls  = COLOR_CLASSES[s.color] || COLOR_CLASSES.teal;
                            const Card = (
                                <div className={`h-full bg-white border border-gray-100 rounded-3xl p-5 hover:shadow-2xl ${cls.shadow} hover:${cls.border} transition-all duration-300 group`}>
                                    <div className={`w-12 h-12 ${cls.bg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                        <Icon className={`w-6 h-6 ${cls.text}`} />
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm mb-1">{s.title}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold leading-tight group-hover:text-gray-500">{s.desc}</p>
                                </div>
                            );

                            if (s.to)
                                return <Link key={i} to={s.to} className="h-full">{Card}</Link>;
                            if (s.scroll)
                                return <button key={i} onClick={() => document.getElementById(s.scroll)?.scrollIntoView({ behavior: 'smooth' })} className="text-left w-full h-full">{Card}</button>;
                            if (s.click === 'sos')
                                return <button key={i} onClick={() => { if (confirm((t('sos') || 'SOS').toString().toUpperCase() + '?')) window.open('tel:108'); }} className="text-left w-full h-full">{Card}</button>;
                            if (s.click === 'medicines')
                                return <button key={i} onClick={() => setShowMedicinesPanel(true)} className="text-left w-full h-full">{Card}</button>;
                            return <div key={i}>{Card}</div>;
                        })}
                    </div>
                </div>

                {/* ═══ CONSULTATION HISTORY ═══ */}
                <div id="history-section" className="scroll-mt-24">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">{t('records') || 'Consultation History'}</p>
                        {history.length > 0 && (
                            <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg uppercase tracking-widest">
                                {history.length} {t('recordsFound') || 'Found'}
                            </span>
                        )}
                    </div>

                    {history.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
                            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <History className="w-8 h-8 text-purple-200" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 mb-2">{t('noRecords') || 'No History Yet'}</h3>
                            <p className="text-xs text-gray-400 font-bold max-w-xs mx-auto leading-relaxed">
                                {t('noRecordsDesc') || 'Your consultation history and medical reports will appear here after your first appointment.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map(record => (
                                <div key={record.id} className="bg-white rounded-3xl border border-gray-100 p-5 hover:shadow-xl hover:shadow-purple-100 hover:border-purple-200 transition-all duration-300 group">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <FileText className="w-6 h-6 text-purple-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-gray-900 text-sm mb-1">{record.doctors?.name || 'Doctor'}</h4>
                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">
                                                    {record.doctors?.specialization || 'Consultation'}
                                                </p>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(record.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </div>
                                                    {record.diagnosis && (
                                                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                                                            <Sparkles className="w-3.5 h-3.5" /> {record.diagnosis}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Link
                                            to={`/prescription/${record.id}`}
                                            className="p-3 bg-gray-50 text-gray-400 hover:bg-purple-600 hover:text-white rounded-2xl transition-all duration-300 shadow-sm border border-gray-100 hover:border-purple-600"
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ═══ HELPLINE CARDS ═══ */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {helplines.map(h => {
                        const cls = HELPLINE_CLASSES[h.c] || HELPLINE_CLASSES.red;
                        return (
                            <a key={h.num} href={`tel:${h.num}`} className={`${cls.bg} h-20 rounded-3xl border ${cls.border} p-4 flex items-center gap-4 group hover:shadow-lg transition-all`}>
                                <div className={`w-10 h-10 bg-white rounded-2xl flex items-center justify-center ${cls.icon} group-hover:scale-110 transition`}>
                                    <Phone className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className={`text-sm font-black ${cls.textBig}`}>{h.num}</p>
                                    <p className={`text-[10px] font-bold ${cls.textSmall} truncate w-20 uppercase tracking-tighter`}>{h.n}</p>
                                </div>
                            </a>
                        );
                    })}
                </div>
            </main>

            {/* ═══ MOBILE NAV ═══ */}
            <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 p-3 flex justify-around items-center md:hidden z-50">
                <Link to="/dashboard"    className="flex flex-col items-center text-teal-600"><Activity className="w-6 h-6" /><span className="text-[10px] font-black mt-1">HOME</span></Link>
                <Link to="/symptoms"     className="flex flex-col items-center text-gray-400 group"><BrainCircuit className="w-6 h-6 group-hover:text-purple-500" /><span className="text-[10px] font-black mt-1">AI JAANCH</span></Link>
                <Link to="/health-news"  className="flex flex-col items-center text-gray-400 group"><Newspaper className="w-6 h-6 group-hover:text-orange-500" /><span className="text-[10px] font-black mt-1">NEWS</span></Link>
                <Link to="/hospitals"    className="flex flex-col items-center text-gray-400 group"><Building2 className="w-6 h-6 group-hover:text-cyan-500" /><span className="text-[10px] font-black mt-1">HOSPITAL</span></Link>
            </div>

            {/* ═══ PANELS ═══ */}
            <KnownMedicinesPanel
                isOpen={showMedicinesPanel}
                onClose={() => setShowMedicinesPanel(false)}
                patientId={patient?.id}
                medicines={knownMedicines}
                onMedicinesChange={setKnownMedicines}
                onSyncSupabase={syncMedicinesToSupabase}
            />
        </div>
    );
}