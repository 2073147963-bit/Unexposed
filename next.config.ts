import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 独立输出：next build 产出 .next/standalone（自带精简 node_modules + server.js），
  // 目标服务器无需安装依赖即可 node server.js 运行。
  // Vercel 上关闭：其部署适配器读不到 standalone 布局下的 .next/next-server.js.nft.json
  // （构建报 ENOENT），且 Vercel 托管本身不需要 standalone。
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // 基础安全响应头（麦克风权限保留给本站：语音输入功能使用）。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
