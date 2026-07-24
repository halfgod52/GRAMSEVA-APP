import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Lock, Eye, EyeOff, ActivitySquare, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        if (!isSupabaseConfigured) {
            setError('Supabase is not configured.');
            setCheckingSession(false);
            return;
        }

        // Listen for the PASSWORD_RECOVERY auth event.
        // When a user clicks the reset link from their email, Supabase
        // exchanges the token in the URL hash for a session and fires
        // this event. This is the correct way to detect a password
        // reset flow (not via query params).
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsRecoveryMode(true);
                setCheckingSession(false);
                setError(null);
            }
        });

        // Also check if user already has an active session (e.g. page was refreshed
        // after clicking the reset link). In that case, onAuthStateChange might
        // have already fired before this component mounted, so we fallback to
        // checking the current session.
        const checkExistingSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    // User has a valid session — likely arrived via the reset link.
                    // Allow password update.
                    setIsRecoveryMode(true);
                }
            } catch (err) {
                console.error('Session check error:', err);
            } finally {
                setCheckingSession(false);
            }
        };

        checkExistingSession();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { data, error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) {
                if (updateError.message?.toLowerCase().includes('same')) {
                    throw new Error('New password must be different from your current password.');
                }
                const msg = updateError.message && updateError.message !== '{}' ? updateError.message : 'Failed to update password.';
                throw new Error(msg);
            }

            setMessage('Password updated successfully! Redirecting to login...');
            
            // Sign out and redirect to login
            setTimeout(async () => {
                await supabase.auth.signOut();
                navigate('/login');
            }, 2500);
        } catch (err) {
            const errMsg = err?.message && err.message !== '{}' ? err.message : '';
            if (errMsg === 'Failed to fetch' || err.name === 'TypeError') {
                setError('Network error: Unable to reach the authentication server. Please check your internet connection.');
            } else {
                setError(errMsg || 'An unexpected error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Show loading state while checking session
    if (checkingSession) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-500 font-medium text-sm">Verifying reset link...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-[20%] right-[-5%] w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-72 h-72 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
                <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
                    <div className="bg-teal-600 p-2 rounded-xl group-hover:scale-110 transition-transform shadow-lg shadow-teal-500/20">
                        <ActivitySquare className="w-8 h-8 text-white" />
                    </div>
                    <span className="text-3xl font-black text-slate-800 tracking-tight">Gram<span className="text-teal-600">Seva</span></span>
                </Link>

                <div className="bg-white py-8 px-6 shadow-2xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-100">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Set New Password</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">
                            Please enter your new password below.
                        </p>
                    </div>

                    {message && (
                        <div className="mb-6 bg-teal-50 border-l-4 border-teal-500 p-4 rounded-r-lg flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-teal-600" />
                            <p className="text-sm font-bold text-teal-800">{message}</p>
                        </div>
                    )}
                    
                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <p className="text-sm font-bold text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Show form only if in recovery mode and no success message */}
                    {!isRecoveryMode && !message && (
                        <div className="text-center py-6">
                            <p className="text-slate-500 text-sm mb-4">
                                This link is invalid or has expired. Please request a new password reset.
                            </p>
                            <Link 
                                to="/forgot-password" 
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition text-sm"
                            >
                                Request New Reset Link
                            </Link>
                        </div>
                    )}

                    {isRecoveryMode && !message && (
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:text-sm font-medium transition-colors"
                                        placeholder="••••••••"
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:text-sm font-medium transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-teal-600/20 active:scale-[0.98]"
                            >
                                {loading ? (
                                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating...</>
                                ) : (
                                    <>Reset Password</>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
