/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // web-push is an optional runtime dependency for Web Push notifications.
  // If not installed, the notify() function silently skips push delivery.
  serverExternalPackages: ['web-push'],
}

export default nextConfig
