import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../services/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Clock, Star, Power, LogOut, HeartPulse, FileText,
    Activity, Bell, Phone, ShieldCheck, Stethoscope,
    CheckCircle2, XCircle, Loader2, Calendar, TrendingUp,
    MessageSquare, Settings, User, ChevronRight, Pill, X,
    ClipboardList, BarChart3, Award, Zap, Globe, RefreshCw
} from 'lucide-react';

export default function DoctorDashboard() {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [doctor, setDoctor] = useState(null);
    const [isOnline, setIsOnline] = useState(false);
    const [consultations, setConsultations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [togglingStatus, setTogglingStatus] = useState(false);

    // Prescription Modal States
    const [selectedConsultation, setSelectedConsultation] = useState(null);
    const [prescriptionOpen, setPrescriptionOpen] = useState(false);
    const [prescriptionSaving, setPrescriptionSaving] = useState(false);
    const [prescription, setPrescription] = useState({
        diagnosis: '',
        medicines: [{ name: '', dosage: '', duration: '' }],
        advice: '',
        followUp: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Not logged in? Redirect to login
            if (!user) {
                navigate('/login', { replace: true });
                return;
            }

            const userId = user.id;
            const { data: d, error: docError } = await supabase.from('doctors').select('*').eq('user_id', userId).single();

            if (docError || !d) {
                // User exists but no doctor record
                navigate('/login', { replace: true });
                return;
            }

            // Real doctor found!
            setDoctor({ ...d, _userId: userId });
            setIsOnline(d.is_online || false);
            const { data: c } = await supabase.from('consultations').select('*').eq('doctor_id', d.id).order('created_at', { ascending: false }).limit(50);
            setConsultations(c || []);
        } catch (err) {
            console.error('Load error:', err);
            navigate('/login', { replace: true });
            return;
        }
        setLoading(false);
    };


    const toggleOnline = async () => {
        if (!doctor || togglingStatus) return;
        setTogglingStatus(true);
        const newStatus = !isOnline;

        // Use user_id for the WHERE clause — this matches the RLS policy exactly
        const { error } = await supabase
            .from('doctors')
            .update({ is_online: newStatus })
            .eq('user_id', doctor._userId || doctor.user_id);

        if (!error) {
            setIsOnline(newStatus);
            setDoctor(prev => ({ ...prev, is_online: newStatus }));
            console.log('✅ Status updated to:', newStatus ? 'Online' : 'Offline');
        } else {
            console.error('Toggle error:', error);
            alert(`Could not update status: ${error.message}. Check if the SQL was run in Supabase.`);
        }
        setTogglingStatus(false);
    };

    const joinCall = async (consultation) => {
        await supabase.from('consultations').update({ status: 'active' }).eq('id', consultation.id);
        setSelectedConsultation(consultation);
        setPrescription({
            diagnosis: '',
            medicines: [{ name: '', dosage: '', duration: '' }],
            advice: '',
            followUp: ''
        });
        setPrescriptionOpen(true);
    };

    const declineCall = async (consultation) => {
        await supabase.from('consultations').update({ status: 'cancelled' }).eq('id', consultation.id);
    };

    const addMedicine = () => {
        setPrescription(prev => ({
            ...prev,
            medicines: [...prev.medicines, { name: '', dosage: '', duration: '' }]
        }));
    };

    const updateMedicine = (index, field, value) => {
        setPrescription(prev => {
            const list = [...prev.medicines];
            list[index] = { ...list[index], [field]: value };
            return { ...prev, medicines: list };
        });
    };

    const removeMedicine = (index) => {
        setPrescription(prev => ({
            ...prev,
            medicines: prev.medicines.filter((_, idx) => idx !== index)
        }));
    };

    const savePrescription = async (e) => {
        e?.preventDefault();
        if (!prescription.diagnosis.trim()) {
            alert('Please enter a diagnosis.');
            return;
        }
        if (prescription.medicines.length === 0 || !prescription.medicines[0].name.trim()) {
            alert('Please add at least one medicine.');
            return;
        }

        setPrescriptionSaving(true);
        try {
            const consultationId = selectedConsultation?.id;
            const patientId = selectedConsultation?.patient_id;
            const doctorId = doctor?.id;

            const { error: pError } = await supabase.from('prescriptions').insert({
                consultation_id: consultationId,
                patient_id: patientId,
                doctor_id: doctorId,
                diagnosis: prescription.diagnosis,
                medicines: prescription.medicines.filter(m => m.name.trim()),
                instructions: prescription.advice,
                follow_up: prescription.followUp
            });

            if (pError) throw pError;

            const { error: cError } = await supabase.from('consultations')
                .update({ status: 'completed', end_time: new Date().toISOString() })
                .eq('id', consultationId);

            if (cError) throw cError;

            alert('Prescription successfully saved and consultation completed.');
            setPrescriptionOpen(false);
            setSelectedConsultation(null);
            loadData();
        } catch (err) {
            console.error('Error saving prescription:', err);
            alert('Failed to save prescription: ' + err.message);
        } finally {
            setPrescriptionSaving(false);
        }
    };



    const handleLogout = async () => {
        if (doctor) await supabase.from('doctors').update({ is_online: false }).eq('id', doctor.id);
        await supabase.auth.signOut();
        navigate('/');
    };

    // Stats
    const todayCount = consultations.filter(c => new Date(c.created_at).toDateString() === new Date().toDateString()).length;
    const completedCount = consultations.filter(c => c.status === 'completed').length;
    const pendingCount = consultations.filter(c => c.status === 'pending').length;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (!doctor && !loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center max-w-sm">
                    <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h2 className="font-black text-gray-700 text-lg">No Doctor Profile Found</h2>
                    <p className="text-gray-400 text-sm mt-2">You may not be registered as a doctor, or the database is not set up.</p>
                    <div className="flex flex-col gap-2 mt-5">
                        <Link to="/login" className="text-xs text-gray-400 hover:text-teal-600 underline underline-offset-2 transition">
                            Go to Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">

            {/* ── Sidebar + Main Layout ── */}
            <div className="flex min-h-screen">
                {/* ── Sidebar ── */}
                <aside className="w-72 bg-white border-r border-gray-100 flex flex-col sticky top-0 h-screen">
                    {/* Logo */}
                    <div className="px-6 py-5 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/20">
                                <HeartPulse className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-black text-gray-900 text-sm">GramSeva Health</h1>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Doctor Portal</p>
                            </div>
                        </div>
                    </div>

                    {/* Doctor Profile Card */}
                    <div className="px-6 py-5 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg">
                                {doctor?.name?.charAt(0) || 'D'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-black text-gray-900 text-sm truncate">Dr. {doctor?.name || 'Doctor'}</h2>
                                <p className="text-xs text-gray-400 truncate">{doctor?.specialization || 'General Physician'}</p>
                            </div>
                        </div>

                        {/* Online/Offline Toggle */}
                        <button onClick={toggleOnline} disabled={togglingStatus}
                            className={`w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.97] disabled:opacity-50 ${isOnline
                                ? 'bg-green-50 text-green-700 border-2 border-green-200 shadow-md shadow-green-100 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-500 border-2 border-gray-200 hover:bg-gray-200'
                                }`}>
                            {togglingStatus ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Power className="w-4 h-4" />
                            )}
                            {togglingStatus ? 'Updating...' : isOnline ? '🟢 Online — Available' : '⚫ Offline — Go Online'}
                        </button>
                    </div>

                    {/* Nav Items */}
                    <nav className="flex-1 px-3 py-4 space-y-1">
                        {[
                            { id: 'overview', label: 'Overview', icon: BarChart3 },
                            { id: 'consultations', label: 'Consultations', icon: Stethoscope, badge: pendingCount },
                            { id: 'schedule', label: 'Schedule', icon: Calendar },
                            { id: 'patients', label: 'My Patients', icon: Users },
                            { id: 'prescriptions', label: 'Prescriptions', icon: ClipboardList },
                            { id: 'earnings', label: 'Earnings', icon: TrendingUp },
                        ].map(item => (
                            <button key={item.id} onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === item.id
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                    }`}>
                                <item.icon className="w-4.5 h-4.5" />
                                {item.label}
                                {item.badge > 0 && (
                                    <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse">{item.badge}</span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Bottom Actions */}
                    <div className="px-3 py-4 border-t border-gray-100 space-y-1">
                        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition">
                            <Settings className="w-4.5 h-4.5" /> Settings
                        </button>
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition">
                            <LogOut className="w-4.5 h-4.5" /> Sign Out
                        </button>
                    </div>
                </aside>

                {/* ── Main Content ── */}
                <main className="flex-1 overflow-y-auto">
                    {/* Top Bar */}
                    <div className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between sticky top-0 z-40">
                        <div>
                            <h2 className="font-black text-gray-900 text-xl">
                                {activeTab === 'overview' && 'Dashboard Overview'}
                                {activeTab === 'consultations' && 'Consultations'}
                                {activeTab === 'schedule' && 'Schedule'}
                                {activeTab === 'patients' && 'My Patients'}
                                {activeTab === 'prescriptions' && 'Prescriptions'}
                                {activeTab === 'earnings' && 'Earnings'}
                            </h2>
                            <p className="text-sm text-gray-400 mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={loadData} className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition text-gray-400 hover:text-gray-600">
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <div className="relative">
                                <Bell className="w-5 h-5 text-gray-400" />
                                {pendingCount > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        {/* ── Online Status Alert ── */}
                        {!isOnline && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 flex items-center gap-4">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                                    <Bell className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-amber-800">You are currently Offline</p>
                                    <p className="text-sm text-amber-600">Go online to start receiving patient consultations.</p>
                                </div>
                                <button onClick={toggleOnline} disabled={togglingStatus}
                                    className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-2xl text-sm shrink-0 shadow-lg shadow-green-600/20 transition active:scale-95 disabled:opacity-50">
                                    {togglingStatus ? 'Updating...' : 'Go Online'}
                                </button>
                            </motion.div>
                        )}

                        {isOnline && (
                            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                                className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6 flex items-center gap-4">
                                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                                    <Activity className="w-5 h-5 text-green-600 animate-pulse" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-green-800">You are Online — Waiting for patients</p>
                                    <p className="text-sm text-green-600">Incoming consultations will appear automatically. Keep this tab open.</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">

                                    <button onClick={toggleOnline} disabled={togglingStatus}
                                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-black rounded-2xl text-sm transition active:scale-95 disabled:opacity-50">
                                        {togglingStatus ? 'Updating...' : 'Go Offline'}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Overview Tab ── */}
                        {activeTab === 'overview' && (
                            <>
                                {/* Stats Cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                    {[
                                        { label: 'Total Consultations', value: doctor?.total_consultations || consultations.length, icon: Users, color: 'from-teal-500 to-teal-600', change: '+12%' },
                                        { label: 'Today', value: todayCount, icon: Calendar, color: 'from-blue-500 to-blue-600', change: 'Active' },
                                        { label: 'Rating', value: `${doctor?.rating || 4.5}`, icon: Star, color: 'from-amber-500 to-amber-600', change: '⭐' },
                                        { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'from-green-500 to-green-600', change: '100%' },
                                    ].map((s, i) => (
                                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                                            className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:shadow-gray-100 transition group">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`w-10 h-10 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition`}>
                                                    <s.icon className="w-5 h-5 text-white" />
                                                </div>
                                                <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{s.change}</span>
                                            </div>
                                            <p className="text-3xl font-black text-gray-900">{s.value}</p>
                                            <p className="text-xs text-gray-400 font-medium mt-1">{s.label}</p>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Quick Actions */}
                                <div className="mb-8">
                                    <h3 className="font-black text-gray-900 text-sm mb-4">Quick Actions</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Write Prescription', icon: Pill, color: 'bg-purple-50 text-purple-600 border-purple-200', desc: 'Create new Rx' },
                                            { label: 'View Patients', icon: Users, color: 'bg-blue-50 text-blue-600 border-blue-200', desc: 'Patient records' },
                                            { label: 'Consultation History', icon: ClipboardList, color: 'bg-teal-50 text-teal-600 border-teal-200', desc: 'Past sessions' },
                                            { label: 'Update Profile', icon: User, color: 'bg-pink-50 text-pink-600 border-pink-200', desc: 'Edit details' },
                                        ].map((a, i) => (
                                            <button key={i} onClick={() => a.label === 'Consultation History' && setActiveTab('consultations')}
                                                className={`${a.color} border rounded-2xl p-4 text-left hover:shadow-md transition active:scale-[0.97]`}>
                                                <a.icon className="w-5 h-5 mb-2" />
                                                <p className="font-black text-sm">{a.label}</p>
                                                <p className="text-[10px] opacity-60 font-medium mt-0.5">{a.desc}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Recent Consultations Preview */}
                                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                    <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                                        <h3 className="font-black text-gray-900 flex items-center gap-2">
                                            <Stethoscope className="w-5 h-5 text-teal-600" /> Recent Consultations
                                        </h3>
                                        <button onClick={() => setActiveTab('consultations')} className="text-xs text-teal-600 font-bold hover:underline flex items-center gap-1">
                                            View All <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {consultations.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                            <p className="text-gray-400 font-bold">No consultations yet</p>
                                            <p className="text-gray-300 text-sm mt-1">Go online to receive patients</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-50">
                                            {consultations.slice(0, 5).map((c, i) => (
                                                <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-gray-900 text-sm">Patient Consultation</p>
                                                            <StatusBadge status={c.status} />
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-0.5">{c.symptoms?.slice(0, 60) || 'No symptoms recorded'}</p>
                                                        <p className="text-[10px] text-gray-300 mt-1">{new Date(c.created_at).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ── Consultations Tab ── */}
                        {activeTab === 'consultations' && (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                                    <h3 className="font-black text-gray-900">All Consultations ({consultations.length})</h3>
                                    <button onClick={loadData} className="text-xs text-teal-600 font-bold hover:underline flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3" /> Refresh
                                    </button>
                                </div>
                                {consultations.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <Stethoscope className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-400 font-bold">No consultations yet</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {consultations.map((c) => (
                                            <div key={c.id} className="px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-gray-900">Consultation</p>
                                                        <StatusBadge status={c.status} />
                                                        {c.urgency && c.urgency !== 'low' && (
                                                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${c.urgency === 'critical' ? 'bg-red-50 text-red-600' :
                                                                c.urgency === 'high' ? 'bg-orange-50 text-orange-600' :
                                                                    'bg-yellow-50 text-yellow-600'
                                                                }`}>{c.urgency}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-1">{c.symptoms || 'No symptoms recorded'}</p>
                                                    <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(c.created_at).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {c.status === 'completed' && (
                                                        <span className="flex items-center gap-1 text-green-500 text-xs font-bold"><CheckCircle2 className="w-4 h-4" /> Completed</span>
                                                    )}
                                                    {c.status === 'cancelled' && (
                                                        <span className="flex items-center gap-1 text-gray-400 text-xs font-bold"><XCircle className="w-4 h-4" /> Cancelled</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Schedule Tab ── */}
                        {activeTab === 'schedule' && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                                <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <h3 className="font-black text-gray-700 text-lg">Schedule Management</h3>
                                <p className="text-gray-400 text-sm mt-2 max-w-sm mx-auto">Set your availability hours and manage appointments. Coming soon!</p>
                                <div className="mt-6 grid grid-cols-7 gap-2 max-w-md mx-auto">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                        <div key={day} className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                                            <p className="text-[10px] font-black text-teal-600 uppercase">{day}</p>
                                            <p className="text-xs text-teal-700 font-bold mt-1">9-5</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Patients Tab ── */}
                        {activeTab === 'patients' && (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="border-b border-gray-100 px-6 py-4">
                                    <h3 className="font-black text-gray-900">Patients from Consultations</h3>
                                    <p className="text-xs text-gray-400 mt-0.5">{consultations.length} total consultations</p>
                                </div>
                                {consultations.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-400 font-bold">No patients yet</p>
                                        <p className="text-gray-300 text-sm mt-1">Patients will appear after consultations</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {consultations.map((c) => (
                                            <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                                                        <User className="w-5 h-5 text-teal-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-sm">Patient Consultation</p>
                                                        <p className="text-xs text-gray-400">{c.symptoms?.slice(0, 80) || 'No symptoms recorded'}</p>
                                                        <p className="text-[10px] text-gray-300 mt-0.5">{new Date(c.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <StatusBadge status={c.status} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Prescriptions Tab ── */}
                        {activeTab === 'prescriptions' && (
                            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                                <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                                    <div>
                                        <h3 className="font-black text-gray-900">E-Prescriptions Written</h3>
                                        <p className="text-xs text-gray-400 mt-0.5">Prescriptions you have issued</p>
                                    </div>
                                    <button onClick={() => { if (demoMode) { setPrescriptionOpen(true); setChatOpen(false); } }}
                                        className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-black rounded-xl transition border border-purple-200">
                                        + Write Prescription
                                    </button>
                                </div>
                                {consultations.filter(c => c.status === 'completed').length === 0 ? (
                                    <div className="p-12 text-center">
                                        <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                        <p className="text-gray-400 font-bold">No prescriptions yet</p>
                                        <p className="text-gray-300 text-sm mt-1">Complete a consultation to write a prescription</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {consultations.filter(c => c.status === 'completed').map((c) => (
                                            <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                                        <Pill className="w-5 h-5 text-purple-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900 text-sm">Prescription</p>
                                                        <p className="text-xs text-gray-400">{c.symptoms?.slice(0, 60) || 'Consultation'}</p>
                                                        <p className="text-[10px] text-gray-300 mt-0.5">{new Date(c.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => navigate(`/prescription/${c.id}`)}
                                                    className="px-3 py-1.5 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition border border-purple-200">
                                                    View Rx
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Earnings Tab ── */}
                        {activeTab === 'earnings' && (
                            <div className="space-y-4">
                                <div className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 text-white">
                                    <p className="text-teal-200 text-sm font-bold">Total Earnings</p>
                                    <p className="text-4xl font-black mt-1">₹{completedCount * 0}</p>
                                    <p className="text-teal-200 text-xs mt-2">Free consultations for rural health</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <Award className="w-5 h-5 text-amber-500" />
                                        <h3 className="font-black text-gray-900">Impact Report</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-teal-50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-teal-700">{consultations.length}</p>
                                            <p className="text-[10px] font-bold text-teal-600 uppercase mt-1">Lives Touched</p>
                                        </div>
                                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-blue-700">{completedCount}</p>
                                            <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Completed</p>
                                        </div>
                                        <div className="bg-amber-50 rounded-xl p-4 text-center">
                                            <p className="text-2xl font-black text-amber-700">{doctor?.rating || 4.5}★</p>
                                            <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Avg Rating</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* ── PRESCRIPTION MODAL ── */}
            <AnimatePresence>
                {prescriptionOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setPrescriptionOpen(false);
                                setSelectedConsultation(null);
                            }}
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-teal-600 to-purple-600 p-6 text-white flex-shrink-0 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                                        <Pill className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg tracking-tight">Issue Digital Prescription</h3>
                                        <p className="text-teal-100 text-xs mt-0.5">
                                            {selectedConsultation ? `Patient Symptoms: ${selectedConsultation.symptoms?.slice(0, 40) || 'Active Consultation'}` : 'New Prescription'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPrescriptionOpen(false);
                                        setSelectedConsultation(null);
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <form onSubmit={savePrescription} className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Diagnosis */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5 font-sans">Diagnosis</label>
                                    <textarea
                                        value={prescription.diagnosis}
                                        onChange={(e) => setPrescription(p => ({ ...p, diagnosis: e.target.value }))}
                                        placeholder="Enter clinical diagnosis (e.g. Acute Bronchitis, Mild Viral Fever)"
                                        required
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-teal-50 focus:border-teal-300 outline-none transition"
                                    />
                                </div>

                                {/* Medicines List */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-bold text-gray-700">Prescribed Medicines</label>
                                        <button
                                            type="button"
                                            onClick={addMedicine}
                                            className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-black rounded-lg transition border border-purple-200"
                                        >
                                            + Add Medicine
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {prescription.medicines.map((m, idx) => (
                                            <div key={idx} className="flex gap-2 items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                                                <div className="flex-1 space-y-2">
                                                    <input
                                                        type="text"
                                                        value={m.name}
                                                        onChange={(e) => updateMedicine(idx, 'name', e.target.value)}
                                                        placeholder="Medicine Name (e.g. Paracetamol 500mg)"
                                                        required
                                                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-100 focus:border-teal-300 outline-none transition"
                                                    />
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={m.dosage}
                                                            onChange={(e) => updateMedicine(idx, 'dosage', e.target.value)}
                                                            placeholder="Dosage (e.g. 1-0-1 after food)"
                                                            required
                                                            className="w-1/2 px-3 py-2 border border-gray-200 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-teal-100 focus:border-teal-300 outline-none transition"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={m.duration}
                                                            onChange={(e) => updateMedicine(idx, 'duration', e.target.value)}
                                                            placeholder="Duration (e.g. 5 days)"
                                                            required
                                                            className="w-1/2 px-3 py-2 border border-gray-200 rounded-xl text-[11px] font-medium focus:ring-2 focus:ring-teal-100 focus:border-teal-300 outline-none transition"
                                                        />
                                                    </div>
                                                </div>
                                                {prescription.medicines.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMedicine(idx)}
                                                        className="p-2 bg-white hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-xl border border-gray-200 hover:border-red-100 transition"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* General Advice */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Dietary & lifestyle advice</label>
                                    <textarea
                                        value={prescription.advice}
                                        onChange={(e) => setPrescription(p => ({ ...p, advice: e.target.value }))}
                                        placeholder="General instructions for patient (e.g. Drink warm water, rest, avoid oily food)"
                                        rows={3}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-teal-50 focus:border-teal-300 outline-none transition"
                                    />
                                </div>

                                {/* Follow Up */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Follow-up Recommendation</label>
                                    <input
                                        type="text"
                                        value={prescription.followUp}
                                        onChange={(e) => setPrescription(p => ({ ...p, followUp: e.target.value }))}
                                        placeholder="When should the patient consult again? (e.g. In 5 days or if fever persists)"
                                        className="w-full px-4 py-3.5 border border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-teal-50 focus:border-teal-300 outline-none transition"
                                    />
                                </div>

                                {/* Submit Actions */}
                                <div className="flex gap-3 pt-4 border-t border-gray-100 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPrescriptionOpen(false);
                                            setSelectedConsultation(null);
                                        }}
                                        className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-2xl transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={prescriptionSaving}
                                        className="flex-1 py-3.5 bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-700 hover:to-purple-700 text-white font-black text-sm rounded-2xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {prescriptionSaving ? (
                                            <><Loader2 className="w-5 h-5 animate-spin" /> Saving Rx...</>
                                        ) : (
                                            <>Save & Complete Consultation</>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Status Badge Component
function StatusBadge({ status }) {
    const styles = {
        completed: 'bg-green-50 text-green-600 border-green-200',
        active: 'bg-blue-50 text-blue-600 border-blue-200',
        pending: 'bg-yellow-50 text-yellow-600 border-yellow-200 animate-pulse',
        cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${styles[status] || styles.pending}`}>
            {status}
        </span>
    );
}
