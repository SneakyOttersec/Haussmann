"use client";

import { createContext, useContext, useState, useEffect, useCallback, useSyncExternalStore } from "react";

interface User {
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, signOut: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

const SESSION_KEY = "haussmann-auth-user";

// ── Auth state as an external store ──
//
// We can't read sessionStorage during SSR / build, so we expose the auth state through
// useSyncExternalStore: build snapshot is "loading", client snapshot is the resolved
// state. This avoids setState-in-effect (which would skip React Compiler optimization
// and trigger an extra render after mount).

type AuthState =
  | { phase: "loading" }
  | { phase: "bypass" }                       // no client ID configured → skip auth
  | { phase: "logged-out" }
  | { phase: "logged-in"; user: User };

function readInitialAuthState(): AuthState {
  if (typeof window === "undefined") return { phase: "loading" };
  const clientId = getClientId();
  if (!clientId) return { phase: "bypass" };
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return { phase: "logged-in", user: JSON.parse(stored) as User };
  } catch { /* ignore */ }
  return { phase: "logged-out" };
}

const LOADING_STATE: AuthState = { phase: "loading" };
let cachedAuthState: AuthState | null = null;
const authSubscribers = new Set<() => void>();

function getAuthSnapshot(): AuthState {
  if (cachedAuthState === null) cachedAuthState = readInitialAuthState();
  return cachedAuthState;
}

function setAuthState(next: AuthState): void {
  cachedAuthState = next;
  authSubscribers.forEach((fn) => fn());
}

function subscribeAuth(callback: () => void): () => void {
  authSubscribers.add(callback);
  return () => { authSubscribers.delete(callback); };
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") { resolve(); return; }
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

function getClientId(): string | null {
  try {
    const raw = localStorage.getItem("sci-immobilier-data");
    if (!raw) return null;
    return JSON.parse(raw)?.settings?.googleClientId ?? null;
  } catch { return null; }
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const clientId = getClientId();
    if (!clientId) {
      setError("Google Client ID manquant. Configurez-le dans Parametres → Sauvegarde Google Drive, puis rechargez.");
      return;
    }

    loadGisScript().then(() => {
      setReady(true);
    }).catch(() => setError("Impossible de charger Google Identity Services"));
  }, [onLogin]);

  const handleClick = () => {
    setError("");
    const clientId = getClientId();
    if (!clientId) return;
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: async (response: google.accounts.oauth2.TokenResponse) => {
        if (response.error) { setError(response.error); return; }
        try {
          const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${response.access_token}` },
          });
          if (!res.ok) throw new Error("Failed to fetch user info");
          const info = await res.json();
          onLogin({ email: info.email, name: info.name, picture: info.picture });
        } catch {
          setError("Erreur de connexion");
        }
      },
      error_callback: (err: { type: string; message?: string }) => {
        setError(err.message ?? err.type);
      },
    });
    client.requestAccessToken();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background font-mono">
      <div className="w-full max-w-sm space-y-6 px-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-primary">Haussmann</h1>
          <p className="text-sm text-muted-foreground">Suivi des investissements immobiliers</p>
        </div>
        <div className="border border-dotted rounded-lg p-6 space-y-4">
          <p className="text-sm text-center text-muted-foreground">Connectez-vous pour acceder a vos donnees</p>
          {ready && (
            <button
              onClick={handleClick}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-muted-foreground/20 bg-background hover:bg-muted/50 transition-colors text-sm font-medium"
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.01 24.01 0 000 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continuer avec Google
            </button>
          )}
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
        </div>
        <p className="text-[10px] text-center text-muted-foreground/50">Prototype — donnees stockees localement</p>
      </div>
    </div>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authState = useSyncExternalStore(subscribeAuth, getAuthSnapshot, () => LOADING_STATE);

  const handleLogin = useCallback((u: User) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
    setAuthState({ phase: "logged-in", user: u });
    // Redirect to basePath root after login
    const basePath = process.env.__NEXT_ROUTER_BASEPATH || "";
    if (basePath && !window.location.pathname.startsWith(basePath)) {
      window.location.href = basePath;
    }
  }, []);

  const handleSignOut = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthState({ phase: "logged-out" });
  }, []);

  if (authState.phase === "loading") return null;

  // No client ID configured → skip login (allow setup)
  if (authState.phase === "bypass") return <>{children}</>;

  // Not logged in → show login screen
  if (authState.phase === "logged-out") return <LoginScreen onLogin={handleLogin} />;

  return (
    <AuthContext.Provider value={{ user: authState.user, loading: false, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}
