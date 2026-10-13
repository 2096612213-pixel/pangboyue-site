/**
 * LDraw color palette and CSS filters used by catalog thumbnails.
 * The renderer uses the same hexadecimal table when recoloring real meshes.
 */

export const colorHex: Record<number, string> = {
  0: "#05131d",
  1: "#0055bf",
  2: "#257a3e",
  3: "#00838f",
  4: "#c91a09",
  5: "#c870a0",
  6: "#583927",
  7: "#9ba19d",
  8: "#6d6e5c",
  9: "#b4d2e3",
  10: "#4b9f4a",
  11: "#55a5af",
  12: "#f2705e",
  13: "#fc97ac",
  14: "#f2cd37",
  15: "#ffffff",
  17: "#c2dab8",
  18: "#fbe696",
  19: "#e4cd9e",
  20: "#c9cae2",
  22: "#81007b",
  23: "#2032b0",
  25: "#fe8a18",
  26: "#923978",
  27: "#bbe90b",
  28: "#958a73",
  29: "#e4adc8",
  68: "#f3cf9b",
  70: "#582a12",
  71: "#a0a5a9",
  72: "#6c6e68",
  73: "#5a93db",
  74: "#73dca1",
  77: "#fecccf",
  78: "#f6d7b3",
  84: "#cc702a",
  85: "#3f3691",
  86: "#7c503a",
  89: "#4c61db",
  92: "#d09168",
  110: "#4354a3",
  118: "#b3d7d1",
  191: "#f8bb3d",
  212: "#86c1e1",
  216: "#b31004",
  226: "#fff03a",
  272: "#0a3463",
  288: "#184632",
  308: "#352100",
  320: "#720e0f",
  321: "#1498d7",
  322: "#3ec2dd",
  323: "#bddcd8",
  326: "#d9e4a7",
  330: "#9b9a5a",
  353: "#ff6d77",
  379: "#6074a1",
};

export const ldrawColorNames: Record<
  number,
  { es: string; en: string; "zh-CN": string }
> = {
  0: { es: "Negro", en: "Black", "zh-CN": "黑色" },
  1: { es: "Azul", en: "Blue", "zh-CN": "蓝色" },
  2: { es: "Verde", en: "Green", "zh-CN": "绿色" },
  3: { es: "Turquesa oscuro", en: "Dark turquoise", "zh-CN": "深青色" },
  4: { es: "Rojo", en: "Red", "zh-CN": "红色" },
  5: { es: "Rosa oscuro", en: "Dark pink", "zh-CN": "深粉色" },
  6: { es: "Marrón", en: "Brown", "zh-CN": "棕色" },
  7: { es: "Gris claro", en: "Light gray", "zh-CN": "浅灰色" },
  8: { es: "Gris oscuro", en: "Dark gray", "zh-CN": "深灰色" },
  9: { es: "Azul claro", en: "Light blue", "zh-CN": "浅蓝色" },
  10: { es: "Verde brillante", en: "Bright green", "zh-CN": "亮绿色" },
  11: { es: "Turquesa claro", en: "Light turquoise", "zh-CN": "浅青色" },
  12: { es: "Salmón", en: "Salmon", "zh-CN": "鲑红色" },
  13: { es: "Rosa", en: "Pink", "zh-CN": "粉色" },
  14: { es: "Amarillo", en: "Yellow", "zh-CN": "黄色" },
  15: { es: "Blanco", en: "White", "zh-CN": "白色" },
  17: { es: "Verde claro", en: "Light green", "zh-CN": "浅绿色" },
  18: { es: "Amarillo claro", en: "Light yellow", "zh-CN": "浅黄色" },
  19: { es: "Arena", en: "Tan", "zh-CN": "沙色" },
  20: { es: "Violeta claro", en: "Light violet", "zh-CN": "浅紫色" },
  22: { es: "Púrpura", en: "Purple", "zh-CN": "紫色" },
  23: { es: "Azul violeta", en: "Blue violet", "zh-CN": "蓝紫色" },
  25: { es: "Naranja", en: "Orange", "zh-CN": "橙色" },
  26: { es: "Magenta", en: "Magenta", "zh-CN": "品红色" },
  27: { es: "Lima", en: "Lime", "zh-CN": "黄绿色" },
  28: { es: "Arena oscuro", en: "Dark tan", "zh-CN": "深沙色" },
  29: { es: "Rosa brillante", en: "Bright pink", "zh-CN": "亮粉色" },
  68: { es: "Naranja muy claro", en: "Very light orange", "zh-CN": "极浅橙色" },
  70: { es: "Marrón rojizo", en: "Reddish brown", "zh-CN": "红棕色" },
  71: { es: "Gris azulado claro", en: "Light bluish gray", "zh-CN": "浅蓝灰色" },
  72: { es: "Gris azulado oscuro", en: "Dark bluish gray", "zh-CN": "深蓝灰色" },
  73: { es: "Azul medio", en: "Medium blue", "zh-CN": "中蓝色" },
  74: { es: "Verde medio", en: "Medium green", "zh-CN": "中绿色" },
  77: { es: "Rosa claro", en: "Light pink", "zh-CN": "浅粉色" },
  78: { es: "Carne claro", en: "Light flesh", "zh-CN": "浅肤色" },
  84: { es: "Carne medio oscuro", en: "Medium dark flesh", "zh-CN": "中深肤色" },
  85: { es: "Púrpura oscuro", en: "Dark purple", "zh-CN": "深紫色" },
  86: { es: "Carne oscuro", en: "Dark flesh", "zh-CN": "深肤色" },
  89: { es: "Azul violeta", en: "Blue violet", "zh-CN": "蓝紫色" },
  92: { es: "Carne", en: "Flesh", "zh-CN": "肤色" },
  110: { es: "Violeta", en: "Violet", "zh-CN": "紫罗兰色" },
  118: { es: "Aguamarina", en: "Aqua", "zh-CN": "水绿色" },
  191: { es: "Naranja claro brillante", en: "Bright light orange", "zh-CN": "亮浅橙色" },
  212: { es: "Azul claro brillante", en: "Bright light blue", "zh-CN": "亮浅蓝色" },
  216: { es: "Óxido", en: "Rust", "zh-CN": "铁锈色" },
  226: { es: "Amarillo claro brillante", en: "Bright light yellow", "zh-CN": "亮浅黄色" },
  272: { es: "Azul oscuro", en: "Dark blue", "zh-CN": "深蓝色" },
  288: { es: "Verde oscuro", en: "Dark green", "zh-CN": "深绿色" },
  308: { es: "Marrón oscuro", en: "Dark brown", "zh-CN": "深棕色" },
  320: { es: "Rojo oscuro", en: "Dark red", "zh-CN": "深红色" },
  321: { es: "Azul celeste oscuro", en: "Dark azure", "zh-CN": "深天蓝色" },
  322: { es: "Azul celeste medio", en: "Medium azure", "zh-CN": "中天蓝色" },
  323: { es: "Aguamarina claro", en: "Light aqua", "zh-CN": "浅水绿色" },
  326: { es: "Verde amarillento", en: "Yellowish green", "zh-CN": "黄绿色" },
  330: { es: "Verde oliva", en: "Olive green", "zh-CN": "橄榄绿" },
  353: { es: "Coral", en: "Coral", "zh-CN": "珊瑚色" },
  379: { es: "Azul arena", en: "Sand blue", "zh-CN": "沙蓝色" },
};

export const ldrawColorOptions = Object.keys(colorHex)
  .map(Number)
  .sort((a, b) => a - b);

export const previewFilter = (color: number) =>
  color === 0
    ? "brightness(.24) contrast(1.25)"
    : color === 1
      ? "sepia(1) saturate(7) hue-rotate(170deg) brightness(.72)"
      : color === 4
        ? "sepia(1) saturate(8) hue-rotate(315deg) brightness(.72)"
        : color === 14
          ? "sepia(1) saturate(7) hue-rotate(2deg) brightness(1.08)"
          : color === 19
            ? "sepia(.8) saturate(2) hue-rotate(350deg) brightness(1.05)"
            : color === 72
              ? "grayscale(1) brightness(.68)"
              : "grayscale(1)";

export const palettePreviewFilter = (color = 71) => {
  const shadow = " drop-shadow(0 2px 1px #05060766)";
  if (color === 0) return "grayscale(1) brightness(.35) contrast(1.35)" + shadow;
  if (color === 1)
    return (
      "sepia(1) saturate(6) hue-rotate(171deg) brightness(.62) contrast(1.2)" + shadow
    );
  if (color === 4)
    return (
      "sepia(1) saturate(7) hue-rotate(313deg) brightness(.67) contrast(1.2)" + shadow
    );
  if (color === 14)
    return (
      "sepia(1) saturate(6) hue-rotate(2deg) brightness(1.02) contrast(1.12)" + shadow
    );
  if (color === 15) return "grayscale(1) brightness(1.12) contrast(1.06)" + shadow;
  if (color === 19)
    return (
      "sepia(.9) saturate(1.9) hue-rotate(350deg) brightness(.96) contrast(1.12)" + shadow
    );
  if (color === 25)
    return (
      "sepia(1) saturate(7) hue-rotate(345deg) brightness(1.08) contrast(1.12)" + shadow
    );
  if (color === 73)
    return (
      "sepia(1) saturate(5) hue-rotate(175deg) brightness(.9) contrast(1.08)" + shadow
    );
  if (color === 70)
    return (
      "sepia(1) saturate(3.2) hue-rotate(334deg) brightness(.45) contrast(1.3)" + shadow
    );
  if (color === 72) return "grayscale(1) brightness(.56) contrast(1.28)" + shadow;
  if (color === 78)
    return (
      "sepia(1) saturate(2.2) hue-rotate(325deg) brightness(1.08) contrast(1.05)" + shadow
    );
  return "grayscale(1) brightness(.78) contrast(1.2)" + shadow;
};
