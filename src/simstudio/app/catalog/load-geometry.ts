import { ObjectLoader } from "three";
import { gunzipSync, strFromU8 } from "fflate";

/** 超过托管大小限制的模型使用无损 gzip 数据；几何精度不变。 */
export async function loadCatalogGeometry(url: string) {
  const loader = new ObjectLoader();
  if (!url.endsWith(".gz")) return loader.loadAsync(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`模型资源加载失败：${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  // 兼容托管服务已应用 Content-Encoding: gzip 的情况。
  const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  return loader.parse(JSON.parse(strFromU8(decoded)));
}
