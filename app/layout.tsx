import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "./_components/Sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Body Xtreme Gym OS",
  description: "Body Xtreme Gym OS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-[#020617] text-slate-200"
        suppressHydrationWarning
      >
        <div className="min-h-full flex">
          <Sidebar />
          <main className="flex-1 min-w-0">
            <div className="p-4 pt-16 md:p-6 md:pt-6 lg:p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
