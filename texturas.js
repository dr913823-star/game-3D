/**
 * texturas.js — Gerador procedural de texturas para inimigos
 * Cria texturas canvas (sem assets externos) + materiais prontos para THREE.
 *
 * Depende de: THREE (global)
 * API pública:
 *   EnemyTex.texture(kind, baseHex, opts)  → THREE.CanvasTexture
 *   EnemyTex.material(kind, baseHex, opts) → THREE.MeshStandardMaterial (map + bump)
 *   EnemyTex.groundShadow(radius)          → THREE.Mesh (sombra falsa no chão)
 */

(function (global) {
    'use strict';

    // -------------------------------------------------------------------------
    // Utilidades de cor
    // -------------------------------------------------------------------------
    const _hexCache = {};

    function hexToHsl(hex) {
        const h = typeof hex === 'number' ? hex : parseInt(String(hex).replace('#', ''), 16);
        if (h in _hexCache) return _hexCache[h];

        let r = ((h >> 16) & 255) / 255;
        let g = ((h >> 8) & 255) / 255;
        let b = (h & 255) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let l = (max + min) / 2;
        let s = 0;
        let hh = 0;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: hh = (g - b) / d + (g < b ? 6 : 0); break;
                case g: hh = (b - r) / d + 2; break;
                default: hh = (r - g) / d + 4;
            }
            hh *= 60;
        }

        const out = { h: hh, s, l };
        _hexCache[h] = out;
        return out;
    }

    function _clamp(v, a, b) {
        return Math.max(a, Math.min(b, v));
    }

    function hsl(h, s, l, a) {
        const S = _clamp(s, 0, 1) * 100;
        const L = _clamp(l, 0, 1) * 100;
        const hh = (h % 360 + 360) % 360;
        return a != null
            ? `hsla(${hh.toFixed(1)},${S.toFixed(1)}%,${L.toFixed(1)}%,${a})`
            : `hsl(${hh.toFixed(1)},${S.toFixed(1)}%,${L.toFixed(1)}%)`;
    }

    /** Cor deslocada em matiz/saturação/luminosidade a partir de uma cor base */
    function hslColor(baseHex, dh, ds, dl) {
        const c = hexToHsl(baseHex);
        return hsl(c.h + dh, c.s + ds, c.l + dl);
    }

    const rnd = (a, b) => a + Math.random() * (b - a);

    function makeCanvas(w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w || 256;
        canvas.height = h || 256;
        return canvas;
    }

    // -------------------------------------------------------------------------
    // Desenhos por tipo
    // -------------------------------------------------------------------------
    function drawScales(ctx, W, H, baseHex, opts) {
        const cols = opts.cols || 11;
        const rows = opts.rows || 9;
        const stepX = W / cols;
        const stepY = H / rows;
        for (let row = 0; row <= rows; row++) {
            const off = (row % 2) * stepX * 0.5;
            const cyOff = (row % 2) ? stepY * 0.5 : 0;
            for (let col = 0; col <= cols; col++) {
                const cx = col * stepX + off;
                const cy = row * stepY + cyOff;
                const rad = stepX * 0.62;
                const v = rnd(-0.13, 0.13);

                ctx.fillStyle = hslColor(baseHex, rnd(-5, 5), v * 0.4, v);
                ctx.beginPath();
                ctx.arc(cx, cy, rad, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = hslColor(baseHex, 0, 0.14, 0.1);
                ctx.beginPath();
                ctx.arc(cx, cy, rad, Math.PI * 1.05, Math.PI * 1.95);
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.22)';
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.arc(cx, cy, rad, Math.PI * 0.85, Math.PI * 1.15);
                ctx.stroke();

                ctx.fillStyle = 'rgba(0,0,0,0.13)';
                ctx.beginPath();
                ctx.arc(cx, cy + rad * 0.28, rad * 0.22, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawHide(ctx, W, H, baseHex, opts) {
        drawScales(ctx, W, H, baseHex, opts);
        // Cicatrizes escuras
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
            ctx.strokeStyle = `rgba(10,5,0,${rnd(0.2, 0.4)})`;
            ctx.lineWidth = rnd(1, 2.2);
            let x = rnd(W * 0.1, W * 0.9);
            let y = rnd(H * 0.1, H * 0.9);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += rnd(-10, 10);
                y += rnd(-16, 16);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    function drawBones(ctx, W, H, baseHex) {
        // Manchas de sujeira
        for (let i = 0; i < 650; i++) {
            ctx.fillStyle = `rgba(${rnd(70, 110)},${rnd(55, 90)},${rnd(35, 65)},${rnd(0.05, 0.2)})`;
            ctx.fillRect(rnd(0, W), rnd(0, H), rnd(1, 2.5), rnd(1, 2.5));
        }
        // Veios do osso
        for (let i = 0; i < 26; i++) {
            ctx.strokeStyle = `rgba(140,120,90,${rnd(0.06, 0.16)})`;
            ctx.lineWidth = rnd(0.6, 1.4);
            ctx.beginPath();
            ctx.moveTo(rnd(0, W), rnd(0, H));
            ctx.lineTo(rnd(0, W), rnd(0, H));
            ctx.stroke();
        }
        // Rachaduras escuras
        ctx.lineCap = 'round';
        for (let i = 0; i < 13; i++) {
            ctx.strokeStyle = `rgba(45,32,20,${rnd(0.2, 0.42)})`;
            ctx.lineWidth = rnd(0.8, 1.7);
            let x = rnd(0, W);
            let y = rnd(0, H);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += rnd(-15, 15);
                y += rnd(-15, 15);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        // Poros
        for (let i = 0; i < 220; i++) {
            ctx.fillStyle = `rgba(60,45,30,${rnd(0.08, 0.2)})`;
            ctx.beginPath();
            ctx.arc(rnd(0, W), rnd(0, H), rnd(0.6, 1.4), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawSmoke(ctx, W, H, baseHex) {
        for (let i = 0; i < 85; i++) {
            const x = rnd(0, W);
            const y = rnd(0, H);
            const r = rnd(14, 52);
            ctx.fillStyle = hslColor(baseHex, rnd(-10, 10), rnd(0.05, 0.4), rnd(0.12, 0.28));
            ctx.globalAlpha = rnd(0.04, 0.11);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Brasas
        for (let i = 0; i < 15; i++) {
            const x = rnd(0, W);
            const y = rnd(0, H);
            const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
            g.addColorStop(0, 'rgba(255,90,40,0.75)');
            g.addColorStop(1, 'rgba(255,90,40,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,205,130,0.9)';
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawFur(ctx, W, H, baseHex) {
        const shades = [-0.18, -0.06, 0.06, 0.16];
        ctx.lineCap = 'round';
        for (let i = 0; i < 2600; i++) {
            const x = rnd(0, W);
            const y = rnd(0, H);
            const v = shades[(Math.random() * shades.length) | 0];
            ctx.strokeStyle = hslColor(baseHex, rnd(-3, 3), v, v);
            ctx.lineWidth = rnd(0.5, 1.5);
            const ang = (Math.random() * Math.PI) - Math.PI / 2;
            const len = rnd(2, 6);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
            ctx.stroke();
        }
    }

    function drawHair(ctx, W, H, baseHex) {
        ctx.lineCap = 'round';
        for (let i = 0; i < 3200; i++) {
            const x = rnd(0, W);
            const y = rnd(0, H);
            const v = rnd(-0.14, 0.12);
            ctx.strokeStyle = hslColor(baseHex, rnd(-3, 3), v, v);
            ctx.lineWidth = rnd(0.5, 1.4);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + rnd(-2, 2), y + rnd(3, 9));
            ctx.stroke();
        }
    }

    function drawChitin(ctx, W, H, baseHex) {
        const rows = 9;
        const cols = 7;
        const rw = H / rows;
        const cw = W / cols;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cx = col * cw + cw / 2;
                const cy = row * rw + rw / 2;
                const rx = cw * 0.44;
                const ry = rw * 0.44;
                const v = rnd(-0.1, 0.1);

                ctx.fillStyle = hslColor(baseHex, rnd(-4, 4), v, v);
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = hslColor(baseHex, 0, 0.18, 0.14);
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx * 0.8, ry * 0.7, 0, Math.PI * 1.1, Math.PI * 1.9);
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    function drawRobe(ctx, W, H, baseHex, opts) {
        // Trama do tecido
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 5) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y < H; y += 5) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        // Dobras verticais
        for (let i = 0; i < 12; i++) {
            const x = rnd(0, W);
            ctx.strokeStyle = `rgba(0,0,0,${rnd(0.08, 0.2)})`;
            ctx.lineWidth = rnd(2, 6);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.quadraticCurveTo(x + rnd(-6, 6), H * 0.5, x + rnd(-8, 8), H);
            ctx.stroke();
        }
        // Runas tênues
        ctx.font = `${opts.fontSize || 13}px serif`;
        const runes = 'ᛟᚦᛉᛁᛗᚱᚢᚨᚱᛊᛋᚨ';
        for (let i = 0; i < 18; i++) {
            ctx.globalAlpha = rnd(0.12, 0.4);
            ctx.fillStyle = hslColor(baseHex, 0, 0.28, 0.22);
            ctx.fillText(runes[(Math.random() * runes.length) | 0], rnd(8, W - 16), rnd(16, H - 8));
        }
        ctx.globalAlpha = 1;
    }

    function drawCloth(ctx, W, H, baseHex) {
        ctx.strokeStyle = 'rgba(0,0,0,0.14)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 6) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = 0; y < H; y += 6) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }
        for (let i = 0; i < 900; i++) {
            ctx.fillStyle = `rgba(0,0,0,${rnd(0.03, 0.12)})`;
            ctx.fillRect(rnd(0, W), rnd(0, H), rnd(1, 2.4), rnd(1, 2.4));
        }
    }

    function drawLeather(ctx, W, H, baseHex) {
        // Grão
        for (let i = 0; i < 1500; i++) {
            const v = rnd(-0.09, 0.09);
            ctx.fillStyle = hslColor(baseHex, rnd(-3, 3), v, v);
            ctx.fillRect(rnd(0, W), rnd(0, H), rnd(1, 2.2), rnd(1, 2.2));
        }
        // Manchas
        for (let i = 0; i < 16; i++) {
            const x = rnd(0, W);
            const y = rnd(0, H);
            ctx.fillStyle = hslColor(baseHex, rnd(-5, 5), rnd(-0.06, 0.06), rnd(-0.06, 0.06));
            ctx.globalAlpha = rnd(0.08, 0.18);
            ctx.beginPath();
            ctx.ellipse(x, y, rnd(18, 48), rnd(14, 40), rnd(0, Math.PI), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Arranhões
        ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = `rgba(255,235,210,${rnd(0.08, 0.22)})`;
            ctx.lineWidth = rnd(0.6, 1.4);
            ctx.beginPath();
            ctx.moveTo(rnd(0, W), rnd(0, H));
            ctx.lineTo(rnd(0, W), rnd(0, H));
            ctx.stroke();
        }
    }

    function drawArmor(ctx, W, H, baseHex) {
        const ps = 42;
        for (let row = 0; row < H / ps + 1; row++) {
            for (let col = 0; col < W / ps + 1; col++) {
                const x = col * ps;
                const y = row * ps;
                const g = ctx.createLinearGradient(x, y, x + ps, y + ps);
                g.addColorStop(0, hslColor(baseHex, 0, 0.1, 0.1));
                g.addColorStop(0.5, hslColor(baseHex, 0, -0.06, -0.05));
                g.addColorStop(1, hslColor(baseHex, 0, 0.06, 0.03));
                ctx.fillStyle = g;
                ctx.fillRect(x + 2, y + 2, ps - 4, ps - 4);
                ctx.strokeStyle = 'rgba(0,0,0,0.42)';
                ctx.lineWidth = 1.4;
                ctx.strokeRect(x + 2.5, y + 2.5, ps - 5, ps - 5);
                ctx.fillStyle = hslColor(baseHex, 0, 0.22, 0.16);
                ctx.beginPath();
                ctx.arc(x + ps / 2, y + ps / 2, 2.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        // Arranhões
        ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
            ctx.strokeStyle = `rgba(255,255,255,${rnd(0.06, 0.16)})`;
            ctx.lineWidth = rnd(0.8, 1.6);
            ctx.beginPath();
            ctx.moveTo(rnd(0, W), rnd(0, H));
            ctx.lineTo(rnd(0, W), rnd(0, H));
            ctx.stroke();
        }
    }

    function drawStone(ctx, W, H, baseHex) {
        const bw = 40;
        const bh = 26;
        for (let row = 0; row < H / bh + 1; row++) {
            const off = (row % 2) * 20;
            for (let col = -1; col < W / bw + 1; col++) {
                const x = col * bw + off;
                const y = row * bh;
                const v = rnd(-0.1, 0.1);
                ctx.fillStyle = hslColor(baseHex, 0, v, v);
                ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
                ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                ctx.lineWidth = 1.2;
                ctx.strokeRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
            }
        }
        // Ruído
        for (let i = 0; i < 800; i++) {
            ctx.fillStyle = `rgba(0,0,0,${rnd(0.03, 0.14)})`;
            ctx.fillRect(rnd(0, W), rnd(0, H), rnd(1, 2.6), rnd(1, 2.6));
        }
        // Rachaduras
        ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
            ctx.strokeStyle = `rgba(0,0,0,${rnd(0.18, 0.38)})`;
            ctx.lineWidth = rnd(0.8, 1.5);
            let x = rnd(0, W);
            let y = rnd(0, H);
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let j = 0; j < 5; j++) {
                x += rnd(-14, 14);
                y += rnd(-14, 14);
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    function drawMoss(ctx, W, H, baseHex) {
        drawStone(ctx, W, H, baseHex);
        // Tufos de musgo
        for (let i = 0; i < 26; i++) {
            const x = rnd(0, W);
            const y = rnd(0, H);
            const r = rnd(5, 16);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, hslColor(0x84cc16, 0, 0.2, 0.2));
            g.addColorStop(0.6, hslColor(0x4d7c0f, 0, 0.1, 0.05));
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawVeins(ctx, W, H, baseHex) {
        ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            let x = rnd(W * 0.05, W * 0.95);
            let y = rnd(H * 0.05, H * 0.95);
            const pts = [[x, y]];
            const steps = 6 + ((Math.random() * 4) | 0);
            for (let j = 0; j < steps; j++) {
                x += rnd(-20, 20);
                y += rnd(-20, 20);
                pts.push([x, y]);
            }
            // Brilho + linha
            for (let pass = 0; pass < 3; pass++) {
                ctx.strokeStyle = hslColor(baseHex, 0, 0.35, 0.4 + pass * 0.08);
                ctx.globalAlpha = [0.14, 0.3, 0.55][pass];
                ctx.lineWidth = [6, 3, 1.4][pass];
                ctx.beginPath();
                ctx.moveTo(pts[0][0], pts[0][1]);
                for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
        // Nós brilhantes
        for (let i = 0; i < 12; i++) {
            const x = rnd(0, W);
            const y = rnd(0, H);
            const g = ctx.createRadialGradient(x, y, 0, x, y, 4);
            g.addColorStop(0, hslColor(baseHex, 0, 0.55, 0.6));
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawSkin(ctx, W, H, baseHex) {
        // Poros sutis
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = `rgba(80,50,30,${rnd(0.03, 0.12)})`;
            ctx.beginPath();
            ctx.arc(rnd(0, W), rnd(0, H), rnd(0.5, 1.2), 0, Math.PI * 2);
            ctx.fill();
        }
        // Leves manchas
        for (let i = 0; i < 10; i++) {
            ctx.fillStyle = hslColor(baseHex, rnd(-4, 4), rnd(-0.04, 0.04), rnd(-0.04, 0.04));
            ctx.globalAlpha = rnd(0.06, 0.14);
            ctx.beginPath();
            ctx.ellipse(rnd(0, W), rnd(0, H), rnd(20, 50), rnd(16, 42), rnd(0, Math.PI), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // -------------------------------------------------------------------------
    // Dispatch principal
    // -------------------------------------------------------------------------
    function texture(kind, baseHex, opts) {
        opts = opts || {};
        const W = opts.width || 256;
        const H = opts.height || 256;
        const canvas = makeCanvas(W, H);
        const ctx = canvas.getContext('2d');
        const base = hexToHsl(baseHex);

        ctx.fillStyle = hsl(base.h, base.s, base.l);
        ctx.fillRect(0, 0, W, H);

        switch (kind) {
            case 'scales': drawScales(ctx, W, H, baseHex, opts); break;
            case 'hide': drawHide(ctx, W, H, baseHex, opts); break;
            case 'bones': drawBones(ctx, W, H, baseHex); break;
            case 'smoke': drawSmoke(ctx, W, H, baseHex); break;
            case 'fur': drawFur(ctx, W, H, baseHex); break;
            case 'hair': drawHair(ctx, W, H, baseHex); break;
            case 'chitin': drawChitin(ctx, W, H, baseHex); break;
            case 'robe': drawRobe(ctx, W, H, baseHex, opts); break;
            case 'cloth': drawCloth(ctx, W, H, baseHex); break;
            case 'leather': drawLeather(ctx, W, H, baseHex); break;
            case 'armor': drawArmor(ctx, W, H, baseHex); break;
            case 'stone': drawStone(ctx, W, H, baseHex); break;
            case 'moss': drawMoss(ctx, W, H, baseHex); break;
            case 'veins': drawVeins(ctx, W, H, baseHex); break;
            case 'skin': drawSkin(ctx, W, H, baseHex); break;
            default: break;
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(opts.repeatX || 2, opts.repeatY || 2);
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        return tex;
    }

    function material(kind, baseHex, o) {
        o = o || {};
        const map = texture(kind, baseHex, o);
        const mat = new THREE.MeshStandardMaterial({
            map,
            color: 0xffffff,
            roughness: o.roughness != null ? o.roughness : 0.85,
            metalness: o.metalness != null ? o.metalness : 0.05
        });
        if (o.bump) {
            mat.bumpMap = map;
            mat.bumpScale = o.bump;
        }
        return mat;
    }

    /** Sombra falsa radial no chão (grounding visual, barata) */
    function groundShadow(radius) {
        const canvas = makeCanvas(128, 128);
        const ctx = canvas.getContext('2d');
        const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
        g.addColorStop(0, 'rgba(0,0,0,0.5)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.26)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);

        const tex = new THREE.CanvasTexture(canvas);
        tex.needsUpdate = true;

        const mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(radius * 2, radius * 2),
            new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 2;
        return mesh;
    }

    global.EnemyTex = {
        texture,
        material,
        groundShadow,
        hexToHsl,
        hslColor,
        hsl
    };

})(typeof window !== 'undefined' ? window : globalThis);
