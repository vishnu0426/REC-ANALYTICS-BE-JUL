function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function rgbToHex({ r, g, b }) {
    return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1)}`;
}

function mix(color1, color2, weight) {
    const p = weight / 100;
    return {
        r: color1.r * p + color2.r * (1 - p),
        g: color1.g * p + color2.g * (1 - p),
        b: color1.b * p + color2.b * (1 - p),
    };
}

export const generateColorScale = (baseHex) => {
    const baseRgb = hexToRgb(baseHex);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    return {
        50: rgbToHex(mix(white, baseRgb, 90)),
        100: rgbToHex(mix(white, baseRgb, 80)),
        200: rgbToHex(mix(white, baseRgb, 60)),
        300: rgbToHex(mix(white, baseRgb, 40)),
        400: rgbToHex(mix(white, baseRgb, 20)),
        500: baseHex,
        600: rgbToHex(mix(black, baseRgb, 20)),
        700: rgbToHex(mix(black, baseRgb, 40)),
        800: rgbToHex(mix(black, baseRgb, 60)),
        900: rgbToHex(mix(black, baseRgb, 80)),
        950: rgbToHex(mix(black, baseRgb, 90)),
    };
};
