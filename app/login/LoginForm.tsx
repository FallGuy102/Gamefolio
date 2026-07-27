"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "signing-in" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("signing-in");
    setMessage("");
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    const response = await fetch("/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, next }),
    });
    const result = (await response.json().catch(() => null)) as
      | { error?: string; next?: string }
      | null;
    if (!response.ok) {
      setStatus("error");
      setMessage(result?.error ?? "暂时无法登录，请稍后重试。");
      return;
    }
    window.location.assign(result?.next || "/");
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="email">邮箱</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <label htmlFor="password">密码</label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        placeholder="输入你的密码"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button type="submit" disabled={status === "signing-in"}>
        {status === "signing-in" ? "正在登录…" : "登录"}
      </button>
      {message && <p className="login-error">{message}</p>}
    </form>
  );
}
