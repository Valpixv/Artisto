import type { NextConfig } from "next";

const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kmcaoujnzpehuylaqrlx.supabase.co").hostname; }
  catch { return "kmcaoujnzpehuylaqrlx.supabase.co"; }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
