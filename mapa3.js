/**
 * mapa3.js — Castelo Abandonado (área 3)
 * Ruínas sombrias, pátio, torres e hordas de esqueletos.
 *
 * Depende de: THREE (global)
 * API:
 *   const world3 = new WorldMap3(scene, options);
 *   await world3.build(onProgress);
 *   world3.getTerrainHeight(x, z);
 *   world3.update(time);
 *   world3.dispose();
 *   world3.getCastleSpawns(); // posições de esqueletos
 *   Saída: portão sul da muralha (sem portal)
 */
(function (global) {
    'use strict';

    const DEFAULTS = {
        mapSize: 220,
        segments: 96,
        waterLevel: -2.5,
        bound: 95,
        /** Muralha (mesmo estilo do mapa2 / Vale Selvagem) */
        wallRadius: 88,
        wallHeight: 12,
        wallThickness: 3.6,
        wallSegments: 88,
        // Portão de saída (sul) — volta à vila / mapa anterior
        gateWidth: 14,
        gateAngle: Math.PI, // sul (-Z)
        treeCount: 40,
        rockCount: 70
    };

    const _dummy = new THREE.Object3D();

    class WorldMap3 {
        /**
         * @param {THREE.Scene} scene
         * @param {object} [options]
         */
        constructor(scene, options = {}) {
            if (!scene) throw new Error('[WorldMap3] scene é obrigatória');

            this.scene = scene;
            this.cfg = Object.assign({}, DEFAULTS, options);

            this.colliders = [];
            this.collectibles = [];
            this.chests = [];
            this.boats = [];

            this.terrainMesh = null;
            this.waterMesh = null;
            this._instanced = [];
            this._groups = [];
            this._embers = [];
            this._fogParticles = [];
            this._built = false;
        }

        // =====================================================================
        // ALTURA — planalto rochoso com pátio do castelo no centro
        // =====================================================================
        getTerrainHeight(x, z) {
            const dist = Math.hypot(x, z);

            // Pátio interno do castelo (quase plano)
            if (dist < 22) return 2.4;

            // Plataforma do castelo
            if (dist < 38) {
                const t = (dist - 22) / 16;
                return 2.4 - t * 0.6 + Math.sin(x * 0.4) * 0.08;
            }

            // Encosta rochosa
            let h = 1.6;
            h += Math.sin(x * 0.04) * 1.4 + Math.cos(z * 0.035) * 1.1;
            h += Math.sin(x * 0.09 + z * 0.07) * 0.7;

            // Depressão de neblina / fossos
            const moat = Math.abs(dist - 48);
            if (moat < 8) {
                h -= (1 - moat / 8) * 2.2;
            }

            // Elevação nas bordas
            if (dist > 70) {
                h += (dist - 70) * 0.15;
            }

            return Math.max(-1.5, h);
        }

        // =====================================================================
        // BUILD
        // =====================================================================
        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(5, 'Erguendo o Castelo Abandonado...');
            await this._buildTerrain();

            await progress(18, 'Muralhas exteriores...');
            await this._buildPerimeterWalls();

            await progress(35, 'Keep e torres ruídas...');
            await this._buildCastle();

            await progress(55, 'Pátio, ossos e túmulos...');
            await this._buildCourtyardDetails();

            await progress(70, 'Árvores mortas e rochas...');
            await this._buildDeadTrees();
            await this._buildRocks();

            await progress(85, 'Baús de tesouro...');
            this._initCollectibles();

            await progress(95, 'Atmosfera sombria...');
            this._setupAtmosphere();

            this._built = true;
            await progress(100, 'Castelo Abandonado pronto');
        }

        async _buildTerrain() {
            const { mapSize, segments } = this.cfg;
            const geo = new THREE.PlaneGeometry(mapSize, mapSize, segments, segments);
            geo.rotateX(-Math.PI / 2);

            const pos = geo.attributes.position;
            const colors = [];

            const cStone = new THREE.Color(0x4b5563);
            const cDark = new THREE.Color(0x1f2937);
            const cMoss = new THREE.Color(0x3f4f3a);
            const cAsh = new THREE.Color(0x6b7280);

            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                const y = this.getTerrainHeight(x, z);
                pos.setY(i, y);

                const dist = Math.hypot(x, z);
                let c;
                if (dist < 22) {
                    c = cStone.clone().lerp(cAsh, 0.4 + Math.random() * 0.2);
                } else if (y < 0.5) {
                    c = cDark.clone();
                } else if (Math.random() < 0.15) {
                    c = cMoss.clone();
                } else {
                    c = cStone.clone().lerp(cDark, Math.random() * 0.45);
                }
                colors.push(c.r, c.g, c.b);
            }

            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geo.computeVertexNormals();

            const mat = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.92,
                metalness: 0.05,
                flatShading: false
            });

            this.terrainMesh = new THREE.Mesh(geo, mat);
            this.terrainMesh.receiveShadow = true;
            this.terrainMesh.name = 'terrain_map3';
            this.scene.add(this.terrainMesh);

            // Água estagnada nos fossos (quase preta)
            const waterGeo = new THREE.CircleGeometry(52, 48);
            waterGeo.rotateX(-Math.PI / 2);
            const waterMat = new THREE.MeshStandardMaterial({
                color: 0x0c1220,
                transparent: true,
                opacity: 0.72,
                roughness: 0.35,
                metalness: 0.2,
                emissive: 0x0a1628,
                emissiveIntensity: 0.15
            });
            this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
            this.waterMesh.position.y = 0.15;
            this.waterMesh.name = 'moat_water';
            this.scene.add(this.waterMesh);
        }

        /**
         * Muralha perimetral — mesmo estilo do mapa2 (Vale Selvagem):
         * segmentos alinhados ao topo, base, parapeito, ameias, torres
         * a cada 8 segmentos, portão com pilares, portas de madeira e tochas.
         */
        async _buildPerimeterWalls() {
            const {
                wallRadius: R,
                wallHeight: H,
                wallThickness: T,
                wallSegments,
                gateWidth,
                gateAngle
            } = this.cfg;

            const segments = Math.max(wallSegments || 64, 80);
            const gw = Math.max(0, gateWidth || 0);
            const gateHalfAngle = gw > 0.5 ? (gw * 0.5) / R : 0;

            this.cfg.gateHalfAngle = gateHalfAngle;
            this.cfg.wallInnerR = R - T * 0.55;
            this.cfg.wallOuterR = R + T * 0.55;

            const wallMat = new THREE.MeshStandardMaterial({
                color: 0x6b7280,
                roughness: 0.92,
                metalness: 0.08
            });
            const trimMat = new THREE.MeshStandardMaterial({
                color: 0x4b5563,
                roughness: 0.85,
                metalness: 0.15
            });
            const woodMat = new THREE.MeshStandardMaterial({
                color: 0x5c3d2e,
                roughness: 0.8,
                metalness: 0.05
            });

            const wallGroup = new THREE.Group();
            wallGroup.name = 'perimeter_wall_map3';

            const arcLen = (2 * Math.PI * R) / segments;
            const segLen = arcLen * 1.28;

            // 1) Amostrar terreno no anel → topo único alinhado
            let maxGround = -Infinity;
            let minGround = Infinity;
            const samples = [];
            for (let i = 0; i < segments; i++) {
                const amid = ((i + 0.5) / segments) * Math.PI * 2;
                let da = amid - gateAngle;
                while (da > Math.PI) da -= Math.PI * 2;
                while (da < -Math.PI) da += Math.PI * 2;
                const inGate = Math.abs(da) < gateHalfAngle;
                const x = Math.sin(amid) * R;
                const z = Math.cos(amid) * R;
                const gY = this.getTerrainHeight(x, z);
                samples.push({ i, amid, x, z, gY, inGate, da });
                if (!inGate) {
                    if (gY > maxGround) maxGround = gY;
                    if (gY < minGround) minGround = gY;
                }
            }
            if (!isFinite(maxGround)) maxGround = 2;
            // Topo fixo: ponto mais alto do terreno + altura da muralha
            const crestY = maxGround + H;
            const capY = crestY + 0.22;
            const merlonY = crestY + 0.95;

            for (const s of samples) {
                if (s.inGate) continue;

                const { x, z, gY: groundY, amid: rotY, i } = s;
                // Altura local: do chão até o topo alinhado (enterra um pouco no solo)
                const embed = 0.8;
                const localH = Math.max(H * 0.55, crestY - groundY + embed);
                const blockCenterY = groundY - embed + localH * 0.5;

                const block = new THREE.Mesh(new THREE.BoxGeometry(segLen, localH, T), wallMat);
                block.position.set(x, blockCenterY, z);
                block.rotation.y = rotY;
                block.castShadow = true;
                block.receiveShadow = true;
                wallGroup.add(block);

                // Base no chão
                const base = new THREE.Mesh(
                    new THREE.BoxGeometry(segLen * 1.02, 1.3, T + 1.5),
                    trimMat
                );
                base.position.set(x, groundY + 0.55, z);
                base.rotation.y = rotY;
                base.castShadow = true;
                base.receiveShadow = true;
                wallGroup.add(base);

                // Parapeito no topo alinhado
                const cap = new THREE.Mesh(
                    new THREE.BoxGeometry(segLen * 1.02, 0.5, T + 0.8),
                    trimMat
                );
                cap.position.set(x, capY, z);
                cap.rotation.y = rotY;
                cap.castShadow = true;
                wallGroup.add(cap);

                if (i % 2 === 0) {
                    const merlon = new THREE.Mesh(
                        new THREE.BoxGeometry(segLen * 0.42, 1.25, T * 0.95),
                        wallMat
                    );
                    merlon.position.set(x, merlonY, z);
                    merlon.rotation.y = rotY;
                    merlon.castShadow = true;
                    wallGroup.add(merlon);
                }

                if (i % 8 === 0) {
                    const towerTop = crestY + 5.5;
                    const towerH = towerTop - groundY + 0.5;
                    const tower = new THREE.Mesh(
                        new THREE.CylinderGeometry(T * 1.2, T * 1.35, towerH, 8),
                        wallMat
                    );
                    tower.position.set(x, groundY - 0.3 + towerH * 0.5, z);
                    tower.castShadow = true;
                    wallGroup.add(tower);

                    const roof = new THREE.Mesh(
                        new THREE.ConeGeometry(T * 1.65, 2.4, 8),
                        new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.75 })
                    );
                    roof.position.set(x, towerTop + 1.1, z);
                    roof.castShadow = true;
                    wallGroup.add(roof);
                }

                this.colliders.push({
                    x, z,
                    radius: Math.max(T * 0.9, arcLen * 0.65),
                    type: 'wall'
                });
                const a2 = (i / segments) * Math.PI * 2;
                let da2 = a2 - gateAngle;
                while (da2 > Math.PI) da2 -= Math.PI * 2;
                while (da2 < -Math.PI) da2 += Math.PI * 2;
                if (Math.abs(da2) >= gateHalfAngle) {
                    this.colliders.push({
                        x: Math.sin(a2) * R,
                        z: Math.cos(a2) * R,
                        radius: Math.max(T * 0.9, arcLen * 0.65),
                        type: 'wall'
                    });
                }
            }

            // Portão — pilares, portas de madeira, lintel e tochas (mesmo estilo mapa2)
            if (gateHalfAngle > 0.001) {
                for (const side of [-1, 1]) {
                    const a = gateAngle + side * gateHalfAngle;
                    const gx = Math.sin(a) * R;
                    const gz = Math.cos(a) * R;
                    const gy = this.getTerrainHeight(gx, gz);

                    const pillarTop = crestY + 3.2;
                    const pillarH = pillarTop - gy + 0.4;
                    const pillar = new THREE.Mesh(
                        new THREE.BoxGeometry(T * 1.9, pillarH, T * 1.9),
                        trimMat
                    );
                    pillar.position.set(gx, gy - 0.2 + pillarH * 0.5, gz);
                    pillar.castShadow = true;
                    wallGroup.add(pillar);

                    const doorH = Math.min(H * 0.85, crestY - gy - 1.2);
                    const door = new THREE.Mesh(
                        new THREE.BoxGeometry(0.35, Math.max(3, doorH), gw * 0.32),
                        woodMat
                    );
                    const openOut = 1.4;
                    const along = side * (gw * 0.18);
                    door.position.set(
                        Math.sin(gateAngle) * (R - openOut) + Math.cos(gateAngle) * along,
                        gy + Math.max(3, doorH) * 0.5,
                        Math.cos(gateAngle) * (R - openOut) - Math.sin(gateAngle) * along
                    );
                    door.rotation.y = gateAngle + side * 1.15;
                    door.castShadow = true;
                    wallGroup.add(door);

                    this.colliders.push({
                        x: gx, z: gz, radius: T * 1.25, type: 'wall_pillar'
                    });
                }

                const ax = Math.sin(gateAngle) * R;
                const az = Math.cos(gateAngle) * R;
                const lintel = new THREE.Mesh(
                    new THREE.BoxGeometry(gw + 4, 1.1, T * 1.55),
                    trimMat
                );
                lintel.position.set(ax, crestY + 1.0, az);
                lintel.rotation.y = gateAngle;
                lintel.castShadow = true;
                wallGroup.add(lintel);

                for (const side of [-1, 1]) {
                    const a = gateAngle + side * gateHalfAngle;
                    const tx = Math.sin(a) * R;
                    const tz = Math.cos(a) * R;
                    const torch = new THREE.Mesh(
                        new THREE.SphereGeometry(0.3, 8, 6),
                        new THREE.MeshStandardMaterial({
                            color: 0xa78bfa,
                            emissive: 0x7c3aed,
                            emissiveIntensity: 1.0
                        })
                    );
                    torch.position.set(tx, crestY - 1.2, tz);
                    wallGroup.add(torch);
                }

                // Identificador → volta à Vila
                this._addGateSign(wallGroup, {
                    text: 'VILA',
                    subtitle: 'SAÍDA',
                    color: '#86efac',
                    angle: gateAngle,
                    radius: R,
                    y: crestY + 2.6
                });
            }

            this.scene.add(wallGroup);
            this._groups.push(wallGroup);
        }

        _addGateSign(parent, opts) {
            const text = String(opts.text || '');
            const subtitle = String(opts.subtitle || 'DESTINO');
            const color = opts.color || '#fbbf24';
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(12,10,8,0.92)';
            ctx.fillRect(0, 0, 512, 128);
            ctx.strokeStyle = color;
            ctx.lineWidth = 6;
            ctx.strokeRect(8, 8, 496, 112);
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(subtitle, 256, 36);
            ctx.font = 'bold 48px sans-serif';
            ctx.fillStyle = color;
            ctx.fillText(text, 256, 82);
            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            const mat = new THREE.MeshBasicMaterial({
                map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide
            });
            const a = opts.angle || 0;
            const R = opts.radius || 100;
            const y = opts.y != null ? opts.y : 10;
            for (const inward of [true, false]) {
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), mat);
                const offset = inward ? -3.2 : 3.2;
                mesh.position.set(Math.sin(a) * (R + offset), y, Math.cos(a) * (R + offset));
                mesh.rotation.y = a + (inward ? Math.PI : 0);
                mesh.renderOrder = 5;
                parent.add(mesh);
            }
        }

        async _buildCastle() {
            const group = new THREE.Group();
            group.name = 'castle_keep';

            const stone = new THREE.MeshStandardMaterial({
                color: 0x6b7280, roughness: 0.93, metalness: 0.06
            });
            const stoneDark = new THREE.MeshStandardMaterial({
                color: 0x374151, roughness: 0.9, metalness: 0.08
            });
            const woodRot = new THREE.MeshStandardMaterial({
                color: 0x44403c, roughness: 0.95
            });
            const banner = new THREE.MeshStandardMaterial({
                color: 0x7f1d1d, roughness: 0.85, emissive: 0x450a0a, emissiveIntensity: 0.15
            });

            const baseY = this.getTerrainHeight(0, 0);

            // —— Keep principal ——
            const keep = new THREE.Mesh(
                new THREE.BoxGeometry(18, 16, 16),
                stone
            );
            keep.position.set(0, baseY + 8, -6);
            keep.castShadow = true;
            keep.receiveShadow = true;
            group.add(keep);
            this.colliders.push({ x: 0, z: -6, halfW: 9.2, halfD: 8.2, type: 'keep' });

            // Torre central do keep
            const keepTower = new THREE.Mesh(
                new THREE.CylinderGeometry(4.5, 5.2, 12, 12),
                stoneDark
            );
            keepTower.position.set(0, baseY + 16 + 6, -6);
            keepTower.castShadow = true;
            group.add(keepTower);

            const keepRoof = new THREE.Mesh(
                new THREE.ConeGeometry(6.5, 5, 8),
                new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.88 })
            );
            keepRoof.position.set(0, baseY + 16 + 14, -6);
            keepRoof.castShadow = true;
            group.add(keepRoof);

            // —— Torres de canto do pátio ——
            const cornerTowers = [
                { x: -16, z: 14 },
                { x: 16, z: 14 },
                { x: -16, z: -18 },
                { x: 16, z: -18 }
            ];
            for (const t of cornerTowers) {
                const ty = this.getTerrainHeight(t.x, t.z);
                const body = new THREE.Mesh(
                    new THREE.CylinderGeometry(3.0, 3.5, 14, 10),
                    stoneDark
                );
                body.position.set(t.x, ty + 7, t.z);
                body.castShadow = true;
                group.add(body);

                // Alguns telhados quebrados
                if (Math.random() > 0.4) {
                    const roof = new THREE.Mesh(
                        new THREE.ConeGeometry(4.2, 3.8, 8),
                        new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 })
                    );
                    roof.position.set(t.x, ty + 16, t.z);
                    roof.rotation.z = (Math.random() - 0.5) * 0.4;
                    roof.castShadow = true;
                    group.add(roof);
                }

                this.colliders.push({ x: t.x, z: t.z, radius: 3.6, type: 'tower' });
            }

            // Muros internos do pátio (parcialmente destruídos)
            const innerWalls = [
                { x: 0, z: 14, w: 28, d: 2.2, h: 6 },
                { x: -16, z: -2, w: 2.2, d: 28, h: 5.5 },
                { x: 16, z: -2, w: 2.2, d: 28, h: 5.5 }
            ];
            for (const w of innerWalls) {
                const wy = this.getTerrainHeight(w.x, w.z);
                // Segmentos quebrados
                const parts = 3 + (Math.random() * 2 | 0);
                for (let i = 0; i < parts; i++) {
                    const frac = 0.5 + Math.random() * 0.5;
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(
                            w.w > w.d ? w.w / parts * 0.9 : w.w,
                            w.h * frac,
                            w.d > w.w ? w.d / parts * 0.9 : w.d
                        ),
                        stone
                    );
                    const ox = w.w > w.d ? (i - parts / 2) * (w.w / parts) : 0;
                    const oz = w.d > w.w ? (i - parts / 2) * (w.d / parts) : 0;
                    mesh.position.set(w.x + ox, wy + w.h * frac * 0.5, w.z + oz);
                    mesh.rotation.z = (Math.random() - 0.5) * 0.15;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                }
                this.colliders.push({
                    x: w.x, z: w.z,
                    halfW: w.w * 0.5 + 0.3,
                    halfD: w.d * 0.5 + 0.3,
                    type: 'inner_wall'
                });
            }

            // Portão interno (arco)
            const archY = this.getTerrainHeight(0, 12);
            const archL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 2.5), stoneDark);
            archL.position.set(-4, archY + 3.5, 12);
            group.add(archL);
            const archR = new THREE.Mesh(new THREE.BoxGeometry(2.5, 7, 2.5), stoneDark);
            archR.position.set(4, archY + 3.5, 12);
            group.add(archR);
            const archTop = new THREE.Mesh(new THREE.BoxGeometry(11, 2, 2.8), stone);
            archTop.position.set(0, archY + 7.5, 12);
            group.add(archTop);

            // Bandeiras rasgadas
            for (const bx of [-5, 5]) {
                const pole = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.08, 0.1, 9, 6),
                    woodRot
                );
                pole.position.set(bx, baseY + 12, -14);
                group.add(pole);
                const flag = new THREE.Mesh(
                    new THREE.PlaneGeometry(2.2, 1.4),
                    banner
                );
                flag.position.set(bx + 1.1, baseY + 15.5, -14);
                flag.rotation.y = Math.PI / 2;
                group.add(flag);
            }

            // Degraus de entrada do keep
            for (let i = 0; i < 4; i++) {
                const step = new THREE.Mesh(
                    new THREE.BoxGeometry(8 - i * 0.4, 0.4, 1.2),
                    stone
                );
                step.position.set(0, baseY + 0.2 + i * 0.4, 3 - i * 0.9);
                step.receiveShadow = true;
                group.add(step);
            }

            // —— Porta do keep (entrada para castelo.js / interior) ——
            // Face frontal do keep: centro em z ≈ 2 (keep em z=-6, half depth 8)
            const doorZ = 2.15;
            const doorY = baseY + 2.4;
            const woodDoor = new THREE.MeshStandardMaterial({
                color: 0x3d2914, roughness: 0.88, metalness: 0.05
            });
            const ironDoor = new THREE.MeshStandardMaterial({
                color: 0x71717a, roughness: 0.45, metalness: 0.7
            });

            // Arco / moldura
            const frame = new THREE.Mesh(
                new THREE.BoxGeometry(5.2, 5.8, 0.5),
                stoneDark
            );
            frame.position.set(0, doorY + 0.5, doorZ);
            frame.castShadow = true;
            group.add(frame);

            // Vão visual (mais escuro)
            const recess = new THREE.Mesh(
                new THREE.BoxGeometry(3.8, 4.6, 0.35),
                new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 1 })
            );
            recess.position.set(0, doorY + 0.2, doorZ + 0.15);
            group.add(recess);

            // Portas de madeira (duas folhas)
            for (const side of [-1, 1]) {
                const leaf = new THREE.Mesh(
                    new THREE.BoxGeometry(1.7, 4.2, 0.22),
                    woodDoor
                );
                leaf.position.set(side * 0.95, doorY + 0.1, doorZ + 0.35);
                leaf.castShadow = true;
                group.add(leaf);
                // Faixas de ferro
                for (const yy of [-1.2, 0, 1.2]) {
                    const band = new THREE.Mesh(
                        new THREE.BoxGeometry(1.75, 0.12, 0.26),
                        ironDoor
                    );
                    band.position.set(side * 0.95, doorY + 0.1 + yy, doorZ + 0.4);
                    group.add(band);
                }
            }

            // Maçanetas
            for (const side of [-1, 1]) {
                const knob = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 8, 6),
                    ironDoor
                );
                knob.position.set(side * 0.35, doorY + 0.1, doorZ + 0.55);
                group.add(knob);
            }

            // Tochas ao lado da porta
            for (const side of [-1, 1]) {
                const torch = new THREE.Mesh(
                    new THREE.SphereGeometry(0.22, 8, 6),
                    new THREE.MeshStandardMaterial({
                        color: 0xffaa33,
                        emissive: 0xff6600,
                        emissiveIntensity: 1.0
                    })
                );
                torch.position.set(side * 3.2, doorY + 1.5, doorZ + 0.2);
                group.add(torch);
                this._embers.push(torch);
            }

            // Ponto de interação da porta (salvo no world)
            this._castleDoorPoint = {
                x: 0,
                z: doorZ + 1.6,
                radius: 3.2,
                label: 'Entrar no Keep',
                type: 'castle_door'
            };

            this.scene.add(group);
            this._groups.push(group);
        }

        /** Porta do keep → interior (castelo.js) */
        getCastleDoorPoint() {
            if (this._castleDoorPoint) return this._castleDoorPoint;
            const baseY = this.getTerrainHeight(0, 0);
            return {
                x: 0,
                z: 3.7,
                radius: 3.2,
                label: 'Entrar no Keep',
                type: 'castle_door'
            };
        }

        async _buildCourtyardDetails() {
            const group = new THREE.Group();
            group.name = 'courtyard_details';

            const boneMat = new THREE.MeshStandardMaterial({
                color: 0xe7e5e4, roughness: 0.7, metalness: 0.05
            });
            const stoneMat = new THREE.MeshStandardMaterial({
                color: 0x57534e, roughness: 0.92
            });
            const dirtMat = new THREE.MeshStandardMaterial({
                color: 0x292524, roughness: 0.95
            });

            // Túmulo / lápides
            const gravePositions = [
                { x: -10, z: 6 }, { x: -7, z: 8 }, { x: -12, z: 9 },
                { x: 9, z: 5 }, { x: 11, z: 8 }, { x: 7, z: 10 },
                { x: -8, z: -12 }, { x: 8, z: -14 }, { x: 0, z: 16 }
            ];
            for (const g of gravePositions) {
                const y = this.getTerrainHeight(g.x, g.z);
                const slab = new THREE.Mesh(
                    new THREE.BoxGeometry(0.9, 1.4, 0.2),
                    stoneMat
                );
                slab.position.set(g.x, y + 0.7, g.z);
                slab.rotation.y = (Math.random() - 0.5) * 0.5;
                slab.castShadow = true;
                group.add(slab);

                // Monte de terra
                const mound = new THREE.Mesh(
                    new THREE.SphereGeometry(0.7, 8, 6),
                    dirtMat
                );
                mound.scale.y = 0.35;
                mound.position.set(g.x, y + 0.15, g.z + 0.5);
                group.add(mound);
            }

            // Ossos espalhados
            for (let i = 0; i < 35; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 3 + Math.random() * 20;
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                const y = this.getTerrainHeight(x, z);

                // Fêmur / osso longo
                const bone = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.06, 0.08, 0.7 + Math.random() * 0.4, 5),
                    boneMat
                );
                bone.position.set(x, y + 0.08, z);
                bone.rotation.set(
                    Math.random() * 0.8,
                    Math.random() * Math.PI,
                    Math.random() * 0.6
                );
                group.add(bone);

                // Crânio ocasional
                if (Math.random() < 0.25) {
                    const skull = new THREE.Mesh(
                        new THREE.SphereGeometry(0.18, 8, 6),
                        boneMat
                    );
                    skull.scale.set(1, 0.85, 1.15);
                    skull.position.set(x + 0.3, y + 0.15, z + 0.2);
                    group.add(skull);
                }
            }

            // Fogueira apagada no centro do pátio
            const pitY = this.getTerrainHeight(2, 2);
            const pit = new THREE.Mesh(
                new THREE.CylinderGeometry(1.4, 1.6, 0.4, 10),
                dirtMat
            );
            pit.position.set(2, pitY + 0.15, 2);
            group.add(pit);

            for (let i = 0; i < 6; i++) {
                const log = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.12, 0.15, 1.3, 6),
                    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 })
                );
                log.position.set(
                    2 + Math.cos(i / 6 * Math.PI * 2) * 0.5,
                    pitY + 0.35,
                    2 + Math.sin(i / 6 * Math.PI * 2) * 0.5
                );
                log.rotation.z = Math.PI / 2;
                log.rotation.y = i / 6 * Math.PI;
                group.add(log);
            }

            // Brasas fracas
            const ember = new THREE.Mesh(
                new THREE.SphereGeometry(0.25, 8, 6),
                new THREE.MeshStandardMaterial({
                    color: 0xff4500,
                    emissive: 0xff2200,
                    emissiveIntensity: 0.6
                })
            );
            ember.position.set(2, pitY + 0.4, 2);
            group.add(ember);
            this._embers.push(ember);

            // Pilares caídos
            for (const p of [
                { x: -14, z: 0, rot: 0.9 },
                { x: 13, z: -8, rot: -0.7 },
                { x: 5, z: 15, rot: 1.2 }
            ]) {
                const y = this.getTerrainHeight(p.x, p.z);
                const col = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.7, 0.85, 5, 8),
                    stoneMat
                );
                col.position.set(p.x, y + 0.8, p.z);
                col.rotation.z = p.rot;
                col.castShadow = true;
                group.add(col);
            }

            this.scene.add(group);
            this._groups.push(group);
        }

        async _buildDeadTrees() {
            const group = new THREE.Group();
            group.name = 'dead_trees';

            const trunkMat = new THREE.MeshStandardMaterial({
                color: 0x292524, roughness: 0.95
            });
            const branchMat = new THREE.MeshStandardMaterial({
                color: 0x1c1917, roughness: 0.92
            });

            for (let i = 0; i < this.cfg.treeCount; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 40 + Math.random() * 40;
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                const y = this.getTerrainHeight(x, z);
                if (y < 0.3) continue;

                const tree = new THREE.Group();
                tree.position.set(x, y, z);

                const h = 4 + Math.random() * 5;
                const trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.15, 0.35, h, 6),
                    trunkMat
                );
                trunk.position.y = h * 0.5;
                trunk.castShadow = true;
                tree.add(trunk);

                // Galhos secos
                const branches = 3 + (Math.random() * 3 | 0);
                for (let b = 0; b < branches; b++) {
                    const br = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.04, 0.08, 1.5 + Math.random(), 4),
                        branchMat
                    );
                    br.position.set(
                        (Math.random() - 0.5) * 0.8,
                        h * (0.5 + Math.random() * 0.4),
                        (Math.random() - 0.5) * 0.8
                    );
                    br.rotation.z = (Math.random() - 0.5) * 1.4;
                    br.rotation.x = (Math.random() - 0.5) * 1.2;
                    tree.add(br);
                }

                group.add(tree);
                this.colliders.push({ x, z, radius: 0.6, type: 'tree' });
            }

            this.scene.add(group);
            this._groups.push(group);
        }

        async _buildRocks() {
            const group = new THREE.Group();
            group.name = 'rocks_map3';
            const mat = new THREE.MeshStandardMaterial({
                color: 0x52525b, roughness: 0.94, metalness: 0.05
            });

            for (let i = 0; i < this.cfg.rockCount; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 25 + Math.random() * 55;
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                const y = this.getTerrainHeight(x, z);

                const s = 0.5 + Math.random() * 1.8;
                const rock = new THREE.Mesh(
                    new THREE.DodecahedronGeometry(s, 0),
                    mat
                );
                rock.position.set(x, y + s * 0.4, z);
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                rock.castShadow = true;
                rock.receiveShadow = true;
                group.add(rock);

                if (s > 1.2) {
                    this.colliders.push({ x, z, radius: s * 0.7, type: 'rock' });
                }
            }

            this.scene.add(group);
            this._groups.push(group);
        }

        _createTreasureChest(scale) {
            const g = new THREE.Group();
            const wood = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.88 });
            const metal = new THREE.MeshStandardMaterial({
                color: 0xb45309, metalness: 0.7, roughness: 0.35
            });
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 0.7 * scale, 0.9 * scale), wood);
            body.position.y = 0.35 * scale;
            body.castShadow = true;
            g.add(body);
            const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45 * scale, 0.2 * scale, 0.95 * scale), wood);
            lid.position.y = 0.8 * scale;
            g.add(lid);
            const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.25 * scale, 0.12 * scale), metal);
            lock.position.set(0, 0.55 * scale, 0.48 * scale);
            g.add(lock);
            g.name = 'treasure_chest';
            return g;
        }

        _initCollectibles() {
            // Cristais sombrios
            const crystalMat = new THREE.MeshStandardMaterial({
                color: 0x6366f1,
                emissive: 0x4338ca,
                emissiveIntensity: 0.55,
                roughness: 0.25,
                metalness: 0.3,
                transparent: true,
                opacity: 0.9
            });

            const crystalPos = [
                { x: -20, z: -10 }, { x: 18, z: -16 },
                { x: -8, z: 18 }, { x: 22, z: 8 },
                { x: 0, z: -22 }, { x: -25, z: 12 }
            ];
            for (const p of crystalPos) {
                const y = this.getTerrainHeight(p.x, p.z);
                const mesh = new THREE.Mesh(
                    new THREE.OctahedronGeometry(0.45, 0),
                    crystalMat.clone()
                );
                mesh.position.set(p.x, y + 0.6, p.z);
                mesh.userData.type = 'collectible';
                mesh.userData.kind = 'crystal';
                mesh.userData.value = 15;
                this.scene.add(mesh);
                this.collectibles.push(mesh);
                this._instanced.push(mesh);
            }

            // Baús do castelo
            const chestPositions = [
                { x: 0, z: -10, id: 'castle_chest_keep' },
                { x: -14, z: 10, id: 'castle_chest_yard' },
                { x: 15, z: -15, id: 'castle_chest_tower' }
            ];
            for (const pos of chestPositions) {
                const cy = this.getTerrainHeight(pos.x, pos.z);
                const chest = this._createTreasureChest(1.05);
                chest.position.set(pos.x, cy, pos.z);
                chest.rotation.y = Math.random() * Math.PI * 2;
                chest.name = pos.id;
                chest.userData.id = pos.id;
                chest.userData.type = 'chest';
                chest.userData.opened = false;
                chest.userData.baseY = cy;
                this.scene.add(chest);
                this.chests.push(chest);
                this._groups.push(chest);
                this.colliders.push({ x: pos.x, z: pos.z, radius: 1.4, type: 'chest' });
            }
        }

        _setupAtmosphere() {
            // Neblina densa e escura
            this.scene.fog = new THREE.FogExp2(0x0f172a, 0.014);
            this.scene.background = new THREE.Color(0x0b1220);

            // Partículas de névoa flutuante
            const fogMat = new THREE.MeshBasicMaterial({
                color: 0x64748b,
                transparent: true,
                opacity: 0.12,
                depthWrite: false
            });
            for (let i = 0; i < 18; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 10 + Math.random() * 50;
                const mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(2 + Math.random() * 3, 8, 6),
                    fogMat.clone()
                );
                mesh.position.set(
                    Math.cos(a) * r,
                    2 + Math.random() * 4,
                    Math.sin(a) * r
                );
                this.scene.add(mesh);
                this._fogParticles.push({
                    mesh,
                    phase: Math.random() * Math.PI * 2,
                    baseY: mesh.position.y,
                    speed: 0.15 + Math.random() * 0.2
                });
                this._groups.push(mesh);
            }
        }

        /** Spawns densos de esqueletos para o Castelo Abandonado */
        getCastleSpawns() {
            return [
                // Pátio central
                { x: 5, z: 4, type: 'skeleton' },
                { x: -6, z: 5, type: 'skeleton' },
                { x: 3, z: -3, type: 'skeleton' },
                { x: -4, z: -5, type: 'skeleton' },
                { x: 8, z: 8, type: 'skeleton' },
                { x: -9, z: 7, type: 'skeleton' },
                // Perto do keep
                { x: 4, z: -8, type: 'skeleton' },
                { x: -5, z: -9, type: 'skeleton' },
                { x: 0, z: -14, type: 'skeleton' },
                // Torres / cantos
                { x: -14, z: 12, type: 'skeleton' },
                { x: 14, z: 12, type: 'skeleton' },
                { x: -13, z: -15, type: 'skeleton' },
                { x: 13, z: -16, type: 'skeleton' },
                // Entrada / portão
                { x: -3, z: 18, type: 'skeleton' },
                { x: 4, z: 17, type: 'skeleton' },
                { x: 0, z: 20, type: 'skeleton' },
                // Alguns mais fortes nas bordas do pátio
                { x: 10, z: 0, type: 'skeleton' },
                { x: -11, z: -2, type: 'skeleton' },
                // Um shadow boss-like no keep
                { x: 0, z: -6, type: 'shadow' }
            ];
        }

        update(time) {
            // Brasas pulsando
            for (let i = 0; i < this._embers.length; i++) {
                const m = this._embers[i];
                if (m.material && m.material.emissiveIntensity != null) {
                    m.material.emissiveIntensity = 0.4 + Math.sin(time * 4 + i) * 0.3;
                }
            }
            // Névoa
            for (const f of this._fogParticles) {
                f.mesh.position.y = f.baseY + Math.sin(time * f.speed + f.phase) * 0.8;
                f.mesh.position.x += Math.sin(time * 0.1 + f.phase) * 0.01;
            }
            // Baús flutuando levemente
            for (let i = 0; i < this.chests.length; i++) {
                const ch = this.chests[i];
                if (ch.userData && ch.userData.baseY != null && !ch.userData.opened) {
                    ch.position.y = ch.userData.baseY + Math.sin(time * 2 + i) * 0.06;
                }
            }
            // Cristais
            for (const c of this.collectibles) {
                if (!c || !c.position) continue;
                c.rotation.y += 0.015;
                c.position.y += Math.sin(time * 2 + c.position.x) * 0.002;
            }
        }

        /** Limites do mapa */
        clampPosition(pos) {
            const b = this.cfg.bound;
            pos.x = Math.max(-b, Math.min(b, pos.x));
            pos.z = Math.max(-b, Math.min(b, pos.z));
            return pos;
        }

        dispose() {
            const disposeMesh = (obj) => {
                if (!obj) return;
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            };

            if (this.terrainMesh) {
                this.scene.remove(this.terrainMesh);
                disposeMesh(this.terrainMesh);
                this.terrainMesh = null;
            }
            if (this.waterMesh) {
                this.scene.remove(this.waterMesh);
                disposeMesh(this.waterMesh);
                this.waterMesh = null;
            }
            for (const inst of this._instanced) {
                this.scene.remove(inst);
                disposeMesh(inst);
            }
            this._instanced.length = 0;
            for (const g of this._groups) {
                this.scene.remove(g);
                if (g.traverse) g.traverse(disposeMesh);
                else disposeMesh(g);
            }
            this._groups.length = 0;
            for (const c of this.collectibles) {
                this.scene.remove(c);
                disposeMesh(c);
            }
            this.collectibles.length = 0;
            this.chests.length = 0;
            this.colliders.length = 0;
            this._embers = [];
            this._fogParticles = [];
            this._built = false;
        }
    }

    global.WorldMap3 = WorldMap3;

})(typeof window !== 'undefined' ? window : globalThis);
