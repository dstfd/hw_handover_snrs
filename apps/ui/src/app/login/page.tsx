import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sonrise</h1>
        <p className="text-muted-foreground text-sm">Sign in to manage alerts</p>
      </div>
      <LoginForm />
    </div>
  );
}
