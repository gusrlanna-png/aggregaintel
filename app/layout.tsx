import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { Providers } from "@/components/providers";
import "./globals.css";

// Inter auto-hospedada (woff2 no repo) — evita falha de build por rede ao
// buscar do Google Fonts na VPS.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "AggregaIntel",
  title: {
    default: "AggregaIntel",
    template: "%s · AggregaIntel",
  },
  description: "Inteligência de mercado para agregados — Martins Lanna Group",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AggregaIntel",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0F6E56",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Auto-recuperação: se um chunk antigo falhar ao carregar (após um
            deploy), limpa service worker + caches e recarrega uma única vez.
            Evita a tela branca "client-side exception" em PWAs já instalados. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
  function ehErroDeChunk(m){return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|'text\\/html'/.test(String(m||""));}
  function recuperar(){
    try{
      if(sessionStorage.getItem('sw-recuperado'))return;
      sessionStorage.setItem('sw-recuperado','1');
    }catch(e){}
    var done=function(){location.reload();};
    try{
      if('caches'in window){caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));}).catch(function(){});}
      if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations){
        navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister();}));}).then(done).catch(done);
      }else{done();}
    }catch(e){done();}
  }
  window.addEventListener('error',function(e){if(ehErroDeChunk(e&&e.message))recuperar();},true);
  window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;if(ehErroDeChunk(r&&(r.message||r)))recuperar();});
})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
