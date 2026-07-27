import { LoginForm } from "./LoginForm";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-mark">G</div>
        <p className="login-eyebrow">GAME DESIGN VAULT</p>
        <h1>回到你的灵感库</h1>
        <p className="login-intro">无需密码。输入邮箱后，我们会发给你一个安全登录链接。</p>
        <LoginForm />
      </section>
    </main>
  );
}
