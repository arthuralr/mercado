/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**', 
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**', 
      },
      {
        protocol: 'https',
        hostname: 'qvttywrmzrnxhbjmnybk.supabase.co',
        pathname: '/**', 
      },
    ],
  },
};

export default nextConfig;