import { LoginForm } from "./LoginForm";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">G</div>
        <p className="login-eyebrow">GAME DESIGN VAULT</p>
        <h1>回到你的灵感库</h1>
        <p className="login-intro">使用你在 Supabase 中设置的邮箱和密码登录。</p>
        <LoginForm />
      </section>
    </main>
  );
}
