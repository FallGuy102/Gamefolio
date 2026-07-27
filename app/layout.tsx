import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: {
      default: "Gamefolio · 游戏设计灵感库",
      template: "%s · Gamefolio",
    },
    description:
      "捕捉游戏灵感，沉淀设计判断。一个属于游戏设计者的个人知识库。",
    applicationName: "Gamefolio",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Gamefolio",
    },
    icons: {
      icon: "/icon.png",
      apple: "/icon.png",
    },
    openGraph: {
      title: "Gamefolio · 游戏设计灵感库",
      description: "捕捉游戏灵感，沉淀设计判断。",
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Gamefolio · 游戏设计灵感库",
      description: "捕捉游戏灵感，沉淀设计判断。",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
