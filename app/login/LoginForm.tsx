"use client";

import { FormEvent, useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    const response = await fetch("/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    });
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus("error");
      setMessage(result?.error ?? "暂时无法发送，请稍后重试。");
      return;
    }
    setStatus("sent");
    setMessage("登录邮件已发送，请打开邮件中的链接。");
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="email">邮箱</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <button type="submit" disabled={status === "sending" || status === "sent"}>
        {status === "sending" ? "正在发送…" : status === "sent" ? "已发送" : "发送登录链接"}
      </button>
      {message && <p className={status === "error" ? "login-error" : "login-message"}>{message}</p>}
    </form>
  );
}
