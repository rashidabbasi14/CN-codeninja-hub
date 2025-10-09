import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";
import { AlertProvider } from "@/contexts/AlertContext";

export const metadata: Metadata = {
  title: "CodeNinja Hub",
  description: "Annual sports tournament for CodeNinja Consulting team members",
  keywords: ["sports", "tournament", "codeninja", "consulting", "team building"],
  authors: [{ name: "CodeNinja Consulting" }],
  creator: "CodeNinja Consulting",
  publisher: "CodeNinja Consulting",
  robots: "noindex, nofollow", // Private internal app
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body
        className="font-sans antialiased min-h-screen bg-slate-900 text-slate-100"
        suppressHydrationWarning
      >
        <UserProvider>
          <AlertProvider>
            <div className="relative flex min-h-screen flex-col">
              <div className="flex-1">{children}</div>
            </div>
          </AlertProvider>
        </UserProvider>
      </body>
    </html>
  );
}
