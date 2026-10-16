"""将参考 GIF 拟合为八阶连续灰度谐波场，更新银花页面内嵌系数。"""
from pathlib import Path
import argparse, base64, hashlib, io, json, re
import numpy as np
from PIL import Image, ImageFilter, ImageSequence
from scipy import ndimage

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('gif', type=Path, help='参考 GIF 路径；仅重建时需要')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
source = root / 'src/silver-blossom/index.html'
html = source.read_text()
size, harmonics = 384, 8
frames, durations = [], []
with Image.open(args.gif) as image:
    for frame in ImageSequence.Iterator(image):
        gray = frame.convert('RGB').resize((size, size), Image.Resampling.LANCZOS).convert('L').filter(ImageFilter.GaussianBlur(.45))
        frames.append(np.asarray(gray, dtype=np.float32))
        durations.append(frame.info.get('duration', 30))
if len(frames) <= harmonics * 2:
    raise ValueError('参考动画帧数不足以拟合八阶谐波')
phases = np.r_[0, np.cumsum(durations)[:-1]] / sum(durations) * (2 * np.pi)
basis = np.stack([np.ones(len(phases))] + [f(n * phases) for n in range(1, harmonics + 1) for f in (np.cos, np.sin)], axis=1)
values = np.stack(frames).reshape(len(frames), -1)
coeff = np.linalg.lstsq(basis, values, rcond=None)[0].reshape(17, size, size)
assert np.isfinite(coeff).all()
scales = np.maximum(np.max(np.abs(coeff[1:]), axis=(1, 2)) / 126, 1 / 126)
channels = np.zeros((18, size, size), np.uint8)
channels[0] = np.round(np.clip(coeff[0], 0, 255)).astype(np.uint8)
channels[1:17] = np.round(np.clip(coeff[1:] / scales[:, None, None] + 128, 1, 255)).astype(np.uint8)
# 第十八通道复用为花朵实体遮罩，消除原黑底边缘污染，不增加运行时图集。
flower_b64 = re.search(r'const ATLAS_B64 = "data:image/[^;]+;base64,([^"\n]+)"', html).group(1)
flower = np.asarray(Image.open(io.BytesIO(base64.b64decode(flower_b64))).convert('RGB'), dtype=np.float32)[:, :600]
magnitude = flower[:, :, 0] + .85 * np.sqrt(((flower[:, :, 1] - 128) / .9) ** 2 + ((flower[:, :, 2] - 128) / .9) ** 2)
labels, _ = ndimage.label(magnitude > 13)
sizes = np.bincount(labels.ravel()); sizes[0] = 0
mask = ndimage.binary_fill_holes(labels == np.argmax(sizes))
mask = ndimage.binary_erosion(mask, iterations=2)
matte = Image.fromarray(np.uint8(mask) * 255).filter(ImageFilter.GaussianBlur(.85)).resize((size, size), Image.Resampling.LANCZOS)
channels[17] = np.asarray(matte)
atlas = np.zeros((size * 2, size * 3, 3), np.uint8)
for tile in range(6):
    atlas[(tile // 3) * size:(tile // 3 + 1) * size, (tile % 3) * size:(tile % 3 + 1) * size] = np.moveaxis(channels[tile * 3:tile * 3 + 3], 0, -1)
output = io.BytesIO()
Image.fromarray(atlas).save(output, format='WEBP', lossless=True, method=6)
blob = output.getvalue()
encoded = base64.b64encode(blob).decode()
html, count = re.subn(r'const CAUSTIC_ATLAS_B64 = "[^"]+";', lambda _: 'const CAUSTIC_ATLAS_B64 = "data:image/webp;base64,' + encoded + '";', html)
assert count == 1
start = html.index('    float sharedCausticField(')
end = html.index('    // Complete 3D Water Surface', start)
function = '    float sharedCausticField(vec2 uv, float phase) {\n      // 以镜像延展系数场，宽屏不拉伸水纹，也不重复花朵。\n      uv = 1.0 - abs(mod(uv, 2.0) - 1.0);\n'
for tile in range(6):
    function += f'      vec3 c{tile} = sampleCausticTile({tile}, uv);\n'
function += '      float value = c0.r * 255.0\n'
for index, scale in enumerate(scales, 1):
    harmonic = (index + 1) // 2
    trig = 'cos' if index % 2 else 'sin'
    component = 'rgb'[index % 3]
    function += f'        + (c{index // 3}.{component} * 255.0 - 128.0) * {scale:.10f} * {trig}({harmonic}.0 * phase)\n'
function += '        ;\n      return clamp(value / 255.0, 0.0, 1.0);\n    }\n\n'
html = html[:start] + function + html[end:]
reconstructed = np.einsum('ij,jk->ik', basis, coeff.reshape(17, -1), optimize=False)
assert np.isfinite(reconstructed).all()
metadata = dict(frames=len(frames), periodSeconds=sum(durations) / 1000, size=size, harmonics=harmonics,
                scales=scales.tolist(), mae=float(np.mean(np.abs(reconstructed - values))), atlasBytes=len(blob),
                matteChannel='tile 5 blue; filled flower silhouette with 2px fringe erosion',
                referenceSha256=hashlib.sha256(args.gif.read_bytes()).hexdigest())
source.write_text(html)
(source.parent / 'caustic-fit.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(f'已重建 {len(frames)} 帧参考动画：{harmonics} 阶谐波，系数图集 {len(blob)} 字节；灰度拟合 MAE {metadata["mae"]:.3f}/255。')
print('请运行 node scripts/build-silver-blossom.mjs 同步发布页面。')
