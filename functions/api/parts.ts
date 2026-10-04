// Cloudflare Pages 适配：复用上游的 LDraw 外部零件查询接口。
import { GET } from "../../simstudio-src/app/api/parts/route";
export const onRequestGet = ({ request }: { request: Request }) => GET(request);
