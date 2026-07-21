import type { Metadata } from "next";
import { headers } from "next/headers";
import "maplibre-gl/dist/maplibre-gl.css";
import "@geoapify/geocoder-autocomplete/styles/minimal.css";
import "./globals.css";
import "./refinements.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: "Artisto — Discover art made nearby",
    description: "Find handmade art, crafts, and creative goods from independent artists near you.",
    icons: { icon: "/favicon.svg" },
    openGraph: { title: "Artisto — Discover art made nearby", description: "Find handmade art, crafts, and creative goods from independent artists near you.", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Artisto — Discover art made nearby" }] },
    twitter: { card: "summary_large_image", title: "Artisto — Discover art made nearby", description: "Find handmade art, crafts, and creative goods from independent artists near you.", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
