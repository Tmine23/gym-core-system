"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { GymLogo } from "@/app/_components/GymLogo";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push("/");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Completa todos los campos");
      triggerShake();
      return;
    }

    setError("");
    setSubmitting(true);

    const result = await login(email.trim(), password);

    if (result.success) {
      router.push("/");
    } else {
      setError(result.error || "Error desconocido");
      triggerShake();
      setSubmitting(false);
    }
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="h-8 w-8 rounded-full border-2 border-brand-green border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#020617] overflow-hidden">
      {/* Animated gradient orbs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
        style={{
          background: "radial-gradient(circle, #76CB3E 0%, transparent 70%)",
          animation: "floatOrb1 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
        style={{
          background: "radial-gradient(circle, #3d7a1a 0%, transparent 70%)",
          animation: "floatOrb2 15s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full opacity-10 blur-[80px]"
        style={{
          background: "radial-gradient(circle, #76CB3E 0%, transparent 70%)",
          animation: "floatOrb3 10s ease-in-out infinite",
        }}
      />

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
        style={{
          animation: mounted ? "fadeIn 0.6s ease-out forwards" : "none",
          opacity: mounted ? undefined : 0,
        }}
      >
        <div className="rounded-3xl border border-[#1e293b] bg-[#0b1220]/80 backdrop-blur-xl p-8 shadow-2xl">
          {/* Logo */}
          <div
            className="flex justify-center mb-6"
            style={{
              animation: mounted ? "fadeIn 0.8s ease-out 0.1s both" : "none",
            }}
          >
            <GymLogo size={180} />
          </div>

          {/* Title */}
          <h1
            className="text-center text-2xl font-bold text-slate-100 mb-6"
            style={{
              animation: mounted ? "slideUp 0.5s ease-out 0.3s both" : "none",
            }}
          >
            Iniciar Sesión
          </h1>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div
              style={{
                animation: mounted ? "slideUp 0.5s ease-out 0.4s both" : "none",
              }}
            >
              <label className="block text-slate-400 mb-1.5 text-sm font-medium">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20"
              />
            </div>

            {/* Password */}
            <div
              style={{
                animation: mounted ? "slideUp 0.5s ease-out 0.5s both" : "none",
              }}
            >
              <label className="block text-slate-400 mb-1.5 text-sm font-medium">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-[#1e293b] bg-[#0b1220] px-4 py-3 pr-12 text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 text-center"
                style={{
                  animation: shake ? "shake 0.4s ease-in-out" : "slideUp 0.3s ease-out",
                }}
              >
                {error}
              </div>
            )}

            {/* Submit button */}
            <div
              style={{
                animation: mounted ? "slideUp 0.5s ease-out 0.6s both" : "none",
              }}
            >
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-brand-green px-4 py-3.5 text-base font-bold text-[#020617] transition-all hover:bg-brand-green/90 hover:shadow-lg hover:shadow-brand-green/20 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-[#020617] border-t-transparent animate-spin" />
                    Ingresando...
                  </span>
                ) : (
                  "Ingresar"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p
          className="text-center text-xs text-slate-600 mt-6"
          style={{
            animation: mounted ? "slideUp 0.5s ease-out 0.8s both" : "none",
          }}
        >
          Body Xtreme Gym OS © 2025
        </p>
      </div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -20px); }
          66% { transform: translate(-20px, 20px); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-25px, 15px); }
          66% { transform: translate(20px, -25px); }
        }
        @keyframes floatOrb3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-15px, -15px); }
        }
      `}</style>
    </div>
  );
}
