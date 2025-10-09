import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    name: "CodeNinja Hub",
    short_name: "CodeNinja Hub",
    description: "Annual sports tournament for CodeNinja Consulting team members",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png"
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png"
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
    },
  });
}