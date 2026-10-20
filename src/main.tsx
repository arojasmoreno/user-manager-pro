import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from '../vly-toolbar-readonly.tsx';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { I18nProvider } from '@/i18n';
import React, { StrictMode, useEffect, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
} from 'react-router';
import './index.css';

const Landing = lazy(() => import('./pages/Landing.tsx'));
const AuthPage = lazy(() => import('./pages/Auth.tsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const FichaViewer = lazy(() => import('./pages/FichaViewer.tsx'));
const NotFound = lazy(() => import('./pages/NotFound.tsx'));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn('[VlyToolbar] Caught error, toolbar disabled:', err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: '', stack: '' };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || 'Unknown runtime error',
      stack: error.stack || '',
    };
  }
  componentDidCatch(err: Error) {
    console.error('[Preview] Root crash:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="w-full max-w-lg border border-border bg-card p-10 text-center">
            <p className="kicker">Error</p>
            <p className="font-display mt-2 text-xl font-semibold">
              Algo ha fallado en la aplicación
            </p>
            <p className="mt-3 text-xs break-words text-muted-foreground">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 max-h-40 overflow-auto rounded-sm border border-border/60 p-2 text-left text-[10px] leading-4 text-muted-foreground/80">
                {this.state.stack}
              </pre>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="font-ui inline-flex h-10 items-center justify-center rounded-sm bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Reintentar
              </button>
              <a
                href="/"
                className="font-ui inline-flex h-10 items-center justify-center rounded-sm border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-accent"
              >
                Volver al inicio
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convexUrl = import.meta.env.VITE_CONVEX_URL;

let convex: ConvexReactClient | null = null;

if (convexUrl) {
  convex = new ConvexReactClient(convexUrl);
} else {
  console.warn('VITE_CONVEX_URL not set; Convex client disabled.');
}

export function AppRoutes() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <RouteSyncer />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/auth"
              element={<AuthPage redirectAfterAuth="/dashboard" />}
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            {/* Visor de una ficha: lo que abre el QR pegado en la máquina. */}
            <Route
              path="/fichas/:id"
              element={
                <RequireAuth redirectImmediately>
                  <FichaViewer />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </I18nProvider>
  );
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: 'iframe-route-change', path: location.pathname },
      '*',
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'navigate') {
        if (event.data.direction === 'back') window.history.back();
        if (event.data.direction === 'forward') window.history.forward();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return null;
}

// Registra el service worker (sólo en producción y si el navegador lo
// soporta). Cacha el armazón de la app y el último PDF consultado para poder
// abrirlo sin cobertura en planta. En desarrollo no se registra, para no
// interferir con el recargado en caliente.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] No se pudo registrar el service worker:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      {convex ? (
        <ConvexAuthProvider client={convex}>
          <AppRoutes />
        </ConvexAuthProvider>
      ) : (
        <AppRoutes />
      )}
    </RootErrorBoundary>
  </StrictMode>,
);
