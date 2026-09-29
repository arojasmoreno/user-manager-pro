import { BackToHome } from "@/components/BackToHome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar el código. Inténtalo de nuevo.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect, { replace: true });
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("El código introducido no es correcto.");
      setOtp("");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-sm border border-foreground/25 bg-card">
            <span className="font-display text-sm font-semibold">U</span>
          </div>
          <span className="font-ui text-sm font-medium tracking-wide">
            User Manager Pro
          </span>
        </Link>
        <BackToHome />
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-24 pt-16">
        <div className="w-full max-w-sm">
          {step === "signIn" ? (
            <form onSubmit={handleEmailSubmit}>
              <p className="kicker">Acceso</p>
              <h1 className="mt-4 text-3xl font-semibold">
                Entra con tu correo
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Te enviaremos un código de seis dígitos. Sin contraseñas.
              </p>

              <div className="relative mt-8">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="email"
                  placeholder="nombre@empresa.com"
                  type="email"
                  className="h-11 rounded-sm pl-9"
                  autoComplete="email"
                  disabled={isLoading}
                  required
                />
              </div>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="font-ui mt-6 h-11 w-full rounded-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Enviar código
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <p className="mt-8 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
                ¿Primera vez? La primera cuenta que inicia sesión puede
                convertirse en administradora. Si tu administrador ya te invitó,
                tu nombre, rol y centros se aplicarán automáticamente al
                verificar el código.
              </p>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit}>
              <p className="kicker">Verificación</p>
              <h1 className="mt-4 text-3xl font-semibold">Revisa tu correo</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Hemos enviado un código de seis dígitos a{" "}
                <span className="text-foreground">{step.email}</span>.
              </p>

              <input type="hidden" name="email" value={step.email} />
              <input type="hidden" name="code" value={otp} />

              <div className="mt-8 flex justify-start">
                <InputOTP
                  value={otp}
                  onChange={setOtp}
                  maxLength={6}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                      const form = (e.target as HTMLElement).closest("form");
                      form?.requestSubmit();
                    }
                  }}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {error && (
                <p className="mt-3 text-sm text-destructive">{error}</p>
              )}

              <Button
                type="submit"
                className="font-ui mt-6 h-11 w-full rounded-sm"
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verificando…
                  </>
                ) : (
                  <>
                    Verificar y entrar
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep("signIn");
                  setError(null);
                  setOtp("");
                }}
                className="font-ui mt-6 text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Usar otro correo
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense fallback={null}>
      <Auth {...props} />
    </Suspense>
  );
}
