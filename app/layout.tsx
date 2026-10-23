import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CartProvider } from "./cart-provider";
import { AdminDataProvider } from "./admin-data-provider";
import GlobalStoreChrome from "./global-store-chrome";
import InstitutionalFooter from "./institutional-footer";
import {
  getLocalBusinessStructuredData,
  getLocalPageMetadata,
  getLocalSeoContext,
} from "@/lib/local-seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [local, localMetadata] = await Promise.all([
    getLocalSeoContext(),
    getLocalPageMetadata({
      title: "Supermercado com hortifrúti, açougue e entrega",
      description:
        "Encontre hortifrúti fresco, carnes do açougue, ofertas e entrega de supermercado na sua região.",
      path: "/",
    }),
  ]);
  return {
    ...localMetadata,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: local.storeName,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#067647",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [local, localBusiness] = await Promise.all([
    getLocalSeoContext(),
    getLocalBusinessStructuredData(),
  ]);
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(localBusiness).replace(/</g, '\\u003c'),
          }}
        />
        <AdminDataProvider initialSettings={local.settings}>
          <CartProvider>
            <GlobalStoreChrome />
            {children}
            <InstitutionalFooter />
          </CartProvider>
        </AdminDataProvider>
      </body>
    </html>
  );
}
