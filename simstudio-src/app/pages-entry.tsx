import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "./page";
import "./globals.css";

const root=document.getElementById("root");
if(!root)throw new Error("未找到应用主容器");
createRoot(root).render(<StrictMode><Home/></StrictMode>);
