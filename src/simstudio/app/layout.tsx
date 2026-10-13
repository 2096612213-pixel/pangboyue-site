import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
const geistSans=Geist({variable:"--font-geist-sans",subsets:["latin"]});
const geistMono=Geist_Mono({variable:"--font-geist-mono",subsets:["latin"]});
export const metadata:Metadata={title:"在线拼乐高 | 积木物理实验室",description:"在线拼搭积木并进行物理模拟。"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>}
