import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/Web3Provider";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MindSpark | Study Pomodoro on Avalanche",
  description: "AI-Supervised Proof of Cognitive Effort on Avalanche Fuji",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={jakarta.className}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
