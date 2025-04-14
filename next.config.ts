import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  transpilePackages: ['@react-email/components', '@react-email/render'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ugwbwscnygljsjabegqc.supabase.co', // for dev and all other branches
        port: '',
        pathname: '/storage/v1/object/public/ticket-attachments/**',
      },
      {
        protocol: 'https',
        hostname: 'bvtfxhqqrxvbkcbjguoy.supabase.co', // only for main production
        port: '',
        pathname: '/storage/v1/object/public/ticket-attachments/**',
      },
    ],
  },
  async headers() {
    // Use production Supabase URL only for app.aiedify.com, dev Supabase URL for everything else
    const isMainProduction = process.env.NEXT_PUBLIC_APP_URL === 'https://app.aiedify.com';
    const supabaseUrl = isMainProduction 
      ? 'https://bvtfxhqqrxvbkcbjguoy.supabase.co'
      : 'https://ugwbwscnygljsjabegqc.supabase.co';
    
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' 
              ? `http://localhost:3000, ${supabaseUrl}`
              : `https://edify-dev.vercel.app, https://app.aiedify.com, ${supabaseUrl}`
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Client-Info, apikey, X-CSRF-Token'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400'
          }
        ]
      }
    ];
  },
  async redirects() {
    return [
      {
        source: '/accounts.aiedify.com/waitlist',
        destination: '/waitlist',
        permanent: true,
      },
      {
        source: '/accounts.aiedify.com/:path*',
        destination: '/:path*',
        permanent: true,
      }
    ]
  }
};

export default nextConfig;