import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Mail, ArrowLeft, ArrowRight, ActivitySquare, HeartPulse } from 'lucide-react';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    // Production URL for password reset redirect
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        // Guard: Supabase must be configured
        if (!isSupabaseConfigured) {
            setError('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
            setLoading(false);
            return;
        }

        try {
            const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${siteUrl}/reset-password`,
            });

            if (resetError) {
                // Handle specific Supabase error codes
                if (resetError.message?.toLowerCase().includes('rate') || resetError.message?.toLowerCase().includes('limit')) {
                    throw new Error('Too many reset requests. Please wait a few minutes before trying again.');
                }
                if (resetError.message?.toLowerCase().includes('not found') || resetError.message?.toLowerCase().includes('invalid')) {
                    // Don't reveal whether the email exists — security best practice
                    // Show success message even if email doesn't exist
                    setMessage('If an account exists with this email, you will receive a password reset link shortly. Please check your inbox and spam folder.');
                    setLoading(false);
                    return;
                }
                const msg = resetError.message && resetError.message !== '{}' ? resetError.message : 'Failed to send reset email. Please verify your Supabase deployment and credentials.';
                throw new Error(msg);
            }

            setMessage('Password reset link sent! Please check your email inbox and spam folder. The link will expire in 1 hour.');
        } catch (err) {
            const errMsg = err?.message && err.message !== '{}' ? err.message : '';
            // Distinguish network errors from API errors
            if (errMsg === 'Failed to fetch' || err.name === 'TypeError') {
                setError('Network error: Unable to reach the authentication server. Please check your internet connection and try again.');
            } else {
                setError(errMsg || 'An unexpected error occurred while communicating with authentication service. Please check your deployment environment variables.');
            }
        } finally {
            setLoading(false);
        }
    };

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
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reset Password</h2>
                        <p className="text-slate-500 text-sm mt-2 font-medium">
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                    </div>

                    {message && (
                        <div className="mb-6 bg-teal-50 border-l-4 border-teal-500 p-4 rounded-r-lg">
                            <p className="text-sm font-bold text-teal-800">{message}</p>
                        </div>
                    )}
                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                            <p className="text-sm font-bold text-red-800">{error}</p>
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:text-sm font-medium transition-colors"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-teal-600/20 active:scale-[0.98]"
                        >
                            {loading ? (
                                <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
                            ) : (
                                <>Send Reset Link <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link to="/login" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-teal-600 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
