import type { Metadata, Viewport } from "next";
import "./globals.css";
import GlobalNavProgress from "@/components/GlobalNavProgress";

export const metadata: Metadata = {
  title: "BeadReader",
  description: "A private book reader.",
  manifest: "/manifest.json",
  applicationName: "BeadReader",
  // Adds the Apple standalone meta tags. iOS ignores the manifest's `display`
  // field, so these are what actually hide Safari's chrome when the app is
  // launched from the Home Screen.
  appleWebApp: {
    capable: true,
    title: "BeadReader",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f6f3",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Standalone (no browser chrome) when launched from the Home Screen. */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Apply the saved theme before paint to avoid a flash of the wrong one. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <GlobalNavProgress />
        {children}
      </body>
    </html>
  );
}
