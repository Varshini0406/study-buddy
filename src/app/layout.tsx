import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Buddy | Your learning space",
  description: "Ask questions, explore ideas, and learn from your notes and images with your personal AI tutor.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}