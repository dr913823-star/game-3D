/**
 * mapa2_melhorado.js — Segunda área: Vale Selvagem (fora da muralha)
 * Versão melhorada com texturas realistas, água animada e efeitos visuais
 *
 * Melhorias:
 * - Texturas procedurais com normal maps
 * - Água animada com shader
 * - Variação de terreno com múltiplos biomas
 * - Vegetação mais detalhada
 * - Iluminação aprimorada
 * - Efeitos de fog e partículas
 *
 * Depende de: THREE (global)
 * API:
 *   const world2 = new WorldMap2(scene, options);
 *   await world2.build(onProgress);
 *   world2.getTerrainHeight(x, z);
 *   world2.update(time);
 *   world2.dispose();
 */
(function (global) {
    'use strict';

    const DEFAULTS = {
        mapSize: 280,
        segments: 128,
        waterLevel: 0.35,
        treeCount: 200,
        rockCount: 0,
        bushCount: 180,
        herbCount: 280,
        flowerCount: 220,
        bound: 125,
        /** Muralha do Vale Selvagem */
        wallRadius: 110,
        wallHeight: 12,
        wallThickness: 3.6,
        wallSegments: 88,
        gateWidth: 14,
        gateAngle: Math.PI / 2, // leste — terreno seco (mesmo estilo da vila)
        /** Configurações visuais */
        enableFog: true,
        enableNoise: true,
        terrainScale: 1.2
    };

    const _dummy = new THREE.Object3D();

    // =====================================================================
    // SHADER PROCEDURAL DA ÁGUA
    // =====================================================================
    const waterVertexShader = `
        uniform float time;
        uniform float waveScale;
        uniform float waveSpeed;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vWave;
        
        void main() {
            vec3 pos = position;
            
            // Ondas senoidais
            float wave1 = sin(pos.x * 0.05 + time * waveSpeed) * 0.15;
            float wave2 = sin(pos.z * 0.04 - time * waveSpeed * 0.7) * 0.12;
            float wave3 = sin((pos.x + pos.z) * 0.03 + time * waveSpeed * 0.5) * 0.08;
            
            pos.y += wave1 + wave2 + wave3;
            
            vPosition = pos;
            vWave = wave1 + wave2 + wave3;
            vNormal = normalize(normalMatrix * normal);
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `;

    const waterFragmentShader = `
        uniform float time;
        uniform vec3 waterColor1;
        uniform vec3 waterColor2;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vWave;
        
        void main() {
            // Reflexo baseado na altura da onda
            vec3 foam = vec3(1.0) * smoothstep(0.1, 0.25, vWave);
            
            // Animação de cor
            vec3 color = mix(waterColor1, waterColor2, 0.5 + 0.3 * sin(time * 0.5));
            color += foam * 0.3;
            
            // Especular simples
            vec3 viewDir = normalize(-vPosition);
            float spec = pow(max(dot(vNormal, viewDir), 0.0), 32.0) * 0.5;
            
            gl_FragColor = vec4(color + vec3(spec), 0.75);
        }
    `;

    // =====================================================================
    // GERADOR DE RUÍDO PERLIN SIMPLIFICADO
    // =====================================================================
    class SimplexNoise {
        constructor() {
            this.p = [];
            for (let i = 0; i < 256; i++) {
                this.p[i] = Math.floor(Math.random() * 256);
            }
            this.p = this.p.concat(this.p);
        }

        fade(t) {
            return t * t * t * (t * (t * 6 - 15) + 10);
        }

        lerp(a, b, t) {
            return a + (b - a) * t;
        }

        grad(hash, x, y) {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 8 ? y : x;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }

        perlin(x, y) {
            const X = Math.floor(x) & 255;
            const Y = Math.floor(y) & 255;

            const xf = x - Math.floor(x);
            const yf = y - Math.floor(y);

            const u = this.fade(xf);
            const v = this.fade(yf);

            const n00 = this.grad(this.p[this.p[X] + Y], xf, yf);
            const n10 = this.grad(this.p[this.p[X + 1] + Y], xf - 1, yf);
            const n01 = this.grad(this.p[this.p[X] + Y + 1], xf, yf - 1);
            const n11 = this.grad(this.p[this.p[X + 1] + Y + 1], xf - 1, yf - 1);

            const nx0 = this.lerp(n00, n10, u);
            const nx1 = this.lerp(n01, n11, u);
            return this.lerp(nx0, nx1, v);
        }
    }

    class WorldMap2 {
        /**
         * @param {THREE.Scene} scene
         * @param {object} [options]
         */
        constructor(scene, options = {}) {
            if (!scene) throw new Error('[WorldMap2] scene é obrigatória');

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
            this._built = false;
            this._noiseGen = new SimplexNoise();
        }

        // =====================================================================
        // ALTURA DO TERRENO — melhorada com Perlin Noise
        // =====================================================================
        getTerrainHeight(x, z) {
            const dist = Math.hypot(x, z);

            // Clareira central plana
            if (dist < 12) return 1.4;

            // Ruído Perlin para terreno natural
            const noise1 = this._noiseGen.perlin(x * 0.015, z * 0.015) * 4.5;
            const noise2 = this._noiseGen.perlin(x * 0.03, z * 0.03) * 2.2;
            const noise3 = this._noiseGen.perlin(x * 0.06, z * 0.06) * 1.1;

            // Riacho diagonal
            const stream = Math.abs(x * 0.7 + z * 0.7 - 8);
            const streamF = stream < 10 ? Math.pow(stream / 10, 1.6) : 1;

            let h = noise1 + noise2 + noise3;
            h += Math.sin(x * 0.028) * 1.5 + Math.cos(z * 0.025) * 1.2;

            // Elevações nas bordas
            if (dist > 90) {
                h += (dist - 90) * 0.12;
            }

            return Math.max(-1.2, h * streamF * this.cfg.terrainScale + 1.2);
        }

        // =====================================================================
        // BUILD
        // =====================================================================
        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(5, 'Gerando Vale Selvagem...');
            await this._buildTerrain();

            await progress(20, 'Erguendo muralha do vale...');
            await this._buildPerimeterWalls();

            await progress(35, 'Erguendo ruínas antigas...');
            await this._buildRuins();

            await progress(50, 'Plantando floresta densa...');
            await this._buildTrees();

            await progress(70, 'Preparando vegetação...');
            // Rochas decorativas removidas do Vale

            await progress(78, 'Plantando arbustos, ervas e flores...');
            await this._buildVegetation();

            await progress(88, 'Colocando cristais e baús...');
            this._initCollectibles();

            await progress(92, 'Colocando carruagem destruída...');
            this._buildDestroyedCarriage();

            await progress(95, 'Adicionando atmosfera...');
            this._setupAtmosphere();

            this._built = true;
            await progress(100, 'Vale Selvagem pronto');
        }

        async _buildTerrain() {
            const { mapSize, segments, waterLevel } = this.cfg;
            const half = mapSize / 2;
            const geo = new THREE.PlaneGeometry(mapSize, mapSize, segments, segments);
            geo.rotateX(-Math.PI / 2);

            const pos = geo.attributes.position;
            const colors = [];
            const normals = [];

            // Cores mais realistas com variação
            const cGrass1 = new THREE.Color(0x3d6b32);
            const cGrass2 = new THREE.Color(0x2d5a27);
            const cDark = new THREE.Color(0x1a3d1a);
            const cDirt = new THREE.Color(0x5c4a32);
            const cSand = new THREE.Color(0x7a6b4a);
            const cRock = new THREE.Color(0x554433);
            const cSnow = new THREE.Color(0xdcdcdc);
            const tmp = new THREE.Color();

            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                const y = this.getTerrainHeight(x, z);
                pos.setY(i, y);

                // Determinação de cor baseada em altura e tipo de terreno
                const noise = this._noiseGen.perlin(x * 0.1, z * 0.1);

                if (y < waterLevel + 0.4) {
                    tmp.copy(cSand);
                } else if (y > 6.0) {
                    tmp.lerpColors(cRock, cSnow, Math.min(1, (y - 6.0) / 2.0));
                } else if (y > 4.0) {
                    tmp.lerpColors(cDirt, cRock, 0.6);
                } else if (y > 2.5) {
                    tmp.lerpColors(cGrass2, cDirt, 0.4 + noise * 0.2);
                } else {
                    tmp.lerpColors(cDark, cGrass1, 0.5 + noise * 0.3);
                }

                // Variação de cor com ruído
                const variation = 1 + noise * 0.15;
                tmp.r = Math.max(0, Math.min(1, tmp.r * variation));
                tmp.g = Math.max(0, Math.min(1, tmp.g * variation));
                tmp.b = Math.max(0, Math.min(1, tmp.b * variation));

                colors.push(tmp.r, tmp.g, tmp.b);
            }

            pos.needsUpdate = true;
            geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            geo.computeVertexNormals();

            // Material com melhor aparência
            const terrainMat = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.88,
                metalness: 0.0,
                flatShading: false,
                wireframe: false
            });

            this.terrainMesh = new THREE.Mesh(geo, terrainMat);
            this.terrainMesh.receiveShadow = true;
            this.terrainMesh.castShadow = true;
            this.terrainMesh.name = 'terrain_map2';
            this.scene.add(this.terrainMesh);

            // Água com shader procedural
            this._buildWater();
        }

        async _buildWater() {
            const { mapSize, waterLevel } = this.cfg;

            const waterGeo = new THREE.PlaneGeometry(mapSize * 1.2, mapSize * 1.2, 64, 64);
            waterGeo.rotateX(-Math.PI / 2);

            const uniforms = {
                time: { value: 0 },
                waveScale: { value: 0.08 },
                waveSpeed: { value: 0.8 },
                waterColor1: { value: new THREE.Color(0x0c4a6e) },
                waterColor2: { value: new THREE.Color(0x164e63) }
            };

            const waterMat = new THREE.ShaderMaterial({
                uniforms: uniforms,
                vertexShader: waterVertexShader,
                fragmentShader: waterFragmentShader,
                transparent: true,
                side: THREE.FrontSide
            });

            this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
            this.waterMesh.position.y = waterLevel;
            this.waterMesh.name = 'water_map2';
            this.waterMesh.receiveShadow = true;
            this.scene.add(this.waterMesh);

            this._waterUniforms = uniforms;
        }

        // --- Muralha perimetral com texturas melhoradas ---

        // --- Muralha perimetral (mesmo estilo da vila / mapa.js) ---

        // --- Muralha perimetral — topo alinhado em todas as seções ---
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
            wallGroup.name = 'perimeter_wall_map2';

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
            // Parapeito / ameias no mesmo nível em todo o anel
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

            // Portão — pilares e lintel no mesmo topo alinhado
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
                            color: 0xffaa33,
                            emissive: 0xff6600,
                            emissiveIntensity: 1.0
                        })
                    );
                    torch.position.set(tx, crestY - 1.2, tz);
                    wallGroup.add(torch);
                }

                // Identificador do portão → volta à Vila
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
            // Dentro e fora
            for (const inward of [true, false]) {
                const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), mat);
                const offset = inward ? -3.2 : 3.2;
                mesh.position.set(Math.sin(a) * (R + offset), y, Math.cos(a) * (R + offset));
                mesh.rotation.y = a + (inward ? Math.PI : 0);
                mesh.renderOrder = 5;
                parent.add(mesh);
            }
        }

        /**
         * Estátua de Tijolos do Ladrão Petrificado (substitui a antiga estátua de pedra).
         */
        _createStoneManStatue(scale = 1) {
            const s = scale;
            const group = new THREE.Group();
            group.name = 'brick_thief_statue';

            const createBrickTex = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 256; canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#d4695d';
                ctx.fillRect(0, 0, 256, 256);
                const brickWidth = 48, brickHeight = 24;
                for (let y = 0; y < 256; y += brickHeight) {
                    const offset = (Math.floor(y / brickHeight) % 2) * (brickWidth / 2);
                    for (let x = -brickWidth / 2; x < 256; x += brickWidth) {
                        ctx.strokeStyle = '#8b4d45';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x + offset, y, brickWidth, brickHeight);
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
                        ctx.fillRect(x + offset, y, brickWidth, brickHeight);
                    }
                }
                const imgData = ctx.getImageData(0, 0, 256, 256);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 35;
                    data[i] = Math.min(255, Math.max(0, data[i] + noise));
                    data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise * 0.7));
                    data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise * 0.5));
                }
                ctx.putImageData(imgData, 0, 0);
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(2.5, 2.5);
                return texture;
            };

            const brickTex = createBrickTex();
            const brickMat = new THREE.MeshStandardMaterial({
                map: brickTex, bumpMap: brickTex, bumpScale: 0.03 * s,
                roughness: 0.88, metalness: 0.0, color: 0xd4695d
            });
            const brickDarkMat = new THREE.MeshStandardMaterial({
                map: brickTex, bumpMap: brickTex, bumpScale: 0.025 * s,
                roughness: 0.9, metalness: 0.0, color: 0xa34f42
            });
            const pedraMat = new THREE.MeshStandardMaterial({
                color: 0x7a8a94, roughness: 0.9, metalness: 0.0,
                map: this._createStoneTexture(128)
            });
            const pedraDarkMat = new THREE.MeshStandardMaterial({
                color: 0x6a7a84, roughness: 0.92, metalness: 0.0
            });
            const eyeMat = new THREE.MeshStandardMaterial({ color: 0x8a9a9a, roughness: 0.85 });
            const pupilMat = new THREE.MeshBasicMaterial({ color: 0x4a5a5a });

            const base = new THREE.Mesh(new THREE.BoxGeometry(1.7 * s, 0.32 * s, 1.7 * s), pedraDarkMat);
            base.position.y = 0.16 * s; base.castShadow = true; base.receiveShadow = true;
            group.add(base);

            const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.58 * s, 0.68 * s, 0.4 * s, 12), pedraMat);
            plinth.position.y = 0.52 * s; plinth.castShadow = true;
            group.add(plinth);

            const yOff = 0.75 * s;
            const limbGeo = new THREE.CylinderGeometry(0.12 * s, 0.1 * s, 1.4 * s, 12);

            const chest = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 0.8 * s, 0.75 * s), brickMat);
            chest.position.y = 2.8 * s + yOff; chest.castShadow = true; chest.receiveShadow = true;
            group.add(chest);

            const waist = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.8 * s, 0.55 * s), brickMat);
            waist.position.y = 2.0 * s + yOff; waist.castShadow = true; waist.receiveShadow = true;
            group.add(waist);

            const shirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.63 * s, 0.72 * s, 0.92 * s, 10), brickMat);
            shirtMesh.position.set(0, 2.80 * s + yOff, 0); shirtMesh.castShadow = true;
            group.add(shirtMesh);

            const belt = new THREE.Mesh(new THREE.BoxGeometry(0.96 * s, 0.12 * s, 0.60 * s), pedraDarkMat);
            belt.position.set(0, 2.05 * s + yOff, 0); group.add(belt);

            const collar = new THREE.Mesh(new THREE.TorusGeometry(0.25 * s, 0.05 * s, 8, 16), brickDarkMat);
            collar.rotation.x = Math.PI / 2; collar.position.y = 3.2 * s + yOff; group.add(collar);

            const headGroup = new THREE.Group();
            headGroup.position.y = 3.65 * s + yOff; group.add(headGroup);

            const head = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 24, 20), pedraMat);
            head.castShadow = true; headGroup.add(head);

            const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.18 * s, 0.4 * s, 12), brickMat);
            neck.position.y = -0.3 * s; headGroup.add(neck);

            const eyebrowGeo = new THREE.BoxGeometry(0.24 * s, 0.045 * s, 0.035 * s);
            const leftEyebrow = new THREE.Mesh(eyebrowGeo, pedraDarkMat);
            leftEyebrow.position.set(0.18 * s, 0.23 * s, 0.475 * s); leftEyebrow.rotation.z = 0.32;
            headGroup.add(leftEyebrow);
            const rightEyebrow = leftEyebrow.clone();
            rightEyebrow.position.x = -0.18 * s; rightEyebrow.rotation.z = -0.32;
            headGroup.add(rightEyebrow);

            const eyeGeo = new THREE.SphereGeometry(0.095 * s, 12, 12);
            const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
            leftEye.position.set(0.18 * s, 0.08 * s, 0.43 * s); leftEye.scale.set(1.0, 0.55, 0.35);
            headGroup.add(leftEye);
            const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 8, 8), pupilMat);
            leftPupil.position.set(0.18 * s, 0.075 * s, 0.49 * s); headGroup.add(leftPupil);
            const rightEye = leftEye.clone(); rightEye.position.x = -0.18 * s; headGroup.add(rightEye);
            const rightPupil = leftPupil.clone(); rightPupil.position.x = -0.18 * s; headGroup.add(rightPupil);

            const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.53 * s, 24, 16), pedraMat);
            beanie.scale.set(1.02, 0.52, 1.02); beanie.position.y = 0.39 * s; beanie.castShadow = true;
            headGroup.add(beanie);

            const shoulderGeo = new THREE.SphereGeometry(0.16 * s, 16, 16);

            const leftArmGroup = new THREE.Group();
            leftArmGroup.position.set(0.72 * s, 3.05 * s + yOff, 0);
            leftArmGroup.rotation.z = 0.05; leftArmGroup.rotation.x = 0.02;
            group.add(leftArmGroup);

            const leftShoulderCap = new THREE.Mesh(shoulderGeo, brickMat);
            leftShoulderCap.scale.set(1.0, 0.9, 1.0); leftShoulderCap.castShadow = true;
            leftArmGroup.add(leftShoulderCap);

            const leftSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.15 * s, 0.4 * s, 12), brickMat);
            leftSleeve.position.y = -0.15 * s; leftArmGroup.add(leftSleeve);

            const leftArm = new THREE.Mesh(limbGeo, brickMat);
            leftArm.position.y = -0.8 * s; leftArm.castShadow = true; leftArmGroup.add(leftArm);

            const rightArmGroup = new THREE.Group();
            rightArmGroup.position.set(-0.72 * s, 3.05 * s + yOff, 0);
            rightArmGroup.rotation.z = -0.05; rightArmGroup.rotation.x = 0.02;
            group.add(rightArmGroup);

            rightArmGroup.add(leftShoulderCap.clone());
            rightArmGroup.add(leftSleeve.clone());
            rightArmGroup.add(leftArm.clone());

            const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 12, 12), brickMat);
            rightHand.scale.set(0.9, 1.1, 0.9); rightHand.position.y = -1.48 * s; rightHand.castShadow = true;
            rightArmGroup.add(rightHand);

            const leftLeg = new THREE.Mesh(limbGeo, brickMat);
            leftLeg.position.set(0.35 * s, 1.0 * s + yOff, 0); leftLeg.castShadow = true; group.add(leftLeg);
            const rightLeg = leftLeg.clone(); rightLeg.position.x = -0.35 * s; group.add(rightLeg);

            [0.35, -0.35].forEach((x) => {
                for (let y = 0.62; y <= 1.35; y += 0.22) {
                    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.125 * s, 0.018 * s, 6, 12), pedraDarkMat);
                    wrap.rotation.x = Math.PI / 2;
                    wrap.position.set(x * s, y * s + yOff, 0);
                    group.add(wrap);
                }
            });

            const makeBoot = (xSide) => {
                const footGroup = new THREE.Group();
                footGroup.position.set(xSide * s, 0.2 * s + yOff, 0);
                const bootShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.25 * s, 0.42 * s, 12), brickMat);
                bootShaft.position.set(0, 0.08 * s, 0); bootShaft.castShadow = true; footGroup.add(bootShaft);
                const leftFoot = new THREE.Mesh(new THREE.SphereGeometry(0.29 * s, 16, 12), brickMat);
                leftFoot.scale.set(0.82, 0.62, 1.32); leftFoot.position.set(0, -0.08 * s, 0.18 * s); leftFoot.castShadow = true; footGroup.add(leftFoot);
                const leftSole = new THREE.Mesh(new THREE.SphereGeometry(0.30 * s, 16, 8), brickDarkMat);
                leftSole.scale.set(0.84, 0.20, 1.34); leftSole.position.set(0, -0.25 * s, 0.18 * s); leftSole.castShadow = true; footGroup.add(leftSole);
                const bootBand = new THREE.Mesh(new THREE.TorusGeometry(0.235 * s, 0.025 * s, 8, 12), brickDarkMat);
                bootBand.scale.set(1, 0.72, 1); bootBand.rotation.x = Math.PI / 2; bootBand.position.set(0, 0.23 * s, 0); footGroup.add(bootBand);
                const bootToe = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 12, 8), brickMat);
                bootToe.scale.set(0.9, 0.65, 1.15); bootToe.position.set(0, -0.03 * s, 0.48 * s); bootToe.rotation.x = -0.12; bootToe.castShadow = true; footGroup.add(bootToe);
                return footGroup;
            };
            group.add(makeBoot(0.35));
            group.add(makeBoot(-0.35));
            return group;
        }

        async _buildRuins() {
            const statuesGroup = new THREE.Group();
            statuesGroup.name = 'brick_statues_map2';

            // Mesmas posições das antigas ruínas → agora estátuas de tijolos do ladrão petrificado
            const statuePositions = [
                { x: -45, z: 35, scale: 1.35, rot: 0.4 },
                { x: 50, z: 25, scale: 1.15, rot: -0.8 },
                { x: -25, z: -45, scale: 1.25, rot: 2.2 },
                { x: 40, z: -30, scale: 1.3, rot: -1.5 }
            ];

            for (const pos of statuePositions) {
                const y = this.getTerrainHeight(pos.x, pos.z);
                if (y < this.cfg.waterLevel + 0.5) continue;

                const statue = this._createStoneManStatue(pos.scale);
                statue.position.set(pos.x, y, pos.z);
                statue.rotation.y = pos.rot;
                statuesGroup.add(statue);

                this.colliders.push({
                    x: pos.x,
                    z: pos.z,
                    radius: 1.2 * pos.scale,
                    type: 'statue'
                });
            }

            this.scene.add(statuesGroup);
            this._groups.push(statuesGroup);
        }

        async _buildTrees() {
            const { treeCount } = this.cfg;
            const treesGroup = new THREE.Group();
            treesGroup.name = 'trees_map2';

            // Diferentes tipos de árvores
            const treeTypes = [
                { trunkColor: 0x4a3728, foliageColor: 0x2d5a27, trunkScale: 0.4, foliageScale: 3.2 },
                { trunkColor: 0x5c4a32, foliageColor: 0x3d6b32, trunkScale: 0.35, foliageScale: 2.8 },
                { trunkColor: 0x3f2a1a, foliageColor: 0x1a3d1a, trunkScale: 0.5, foliageScale: 3.8 }
            ];

            for (let i = 0; i < treeCount; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 18 + Math.random() * 85;
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                const y = this.getTerrainHeight(x, z);

                if (y < this.cfg.waterLevel + 0.8 || Math.hypot(x, z) < 15) continue;

                const treeType = treeTypes[Math.floor(Math.random() * treeTypes.length)];

                const tree = new THREE.Group();
                tree.position.set(x, y, z);

                // Tronco
                const trunk = new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        treeType.trunkScale * 0.5,
                        treeType.trunkScale,
                        3 + Math.random() * 2,
                        8
                    ),
                    new THREE.MeshStandardMaterial({
                        color: treeType.trunkColor,
                        roughness: 0.9,
                        metalness: 0.02
                    })
                );
                trunk.position.y = 2;
                trunk.castShadow = true;
                trunk.receiveShadow = true;
                tree.add(trunk);

                // Folhagem com cones
                for (let j = 0; j < 3; j++) {
                    const foliage = new THREE.Mesh(
                        new THREE.ConeGeometry(
                            treeType.foliageScale - j * 0.6,
                            2.5 - j * 0.4,
                            12
                        ),
                        new THREE.MeshStandardMaterial({
                            color: treeType.foliageColor,
                            roughness: 0.85,
                            metalness: 0.0
                        })
                    );
                    foliage.position.y = 3.5 + j * 1.2;
                    foliage.rotation.z = Math.random() * 0.2;
                    foliage.castShadow = true;
                    foliage.receiveShadow = true;
                    tree.add(foliage);
                }

                treesGroup.add(tree);
            }

            this.scene.add(treesGroup);
            this._groups.push(treesGroup);
        }

        async _buildRocks() {
            const { rockCount } = this.cfg;
            const geo = new THREE.IcosahedronGeometry(0.8, 2);

            const stoneMat = new THREE.MeshStandardMaterial({
                color: 0x5a5a5a,
                roughness: 0.95,
                metalness: 0.05,
                map: this._createStoneTexture(128)
            });

            const rocks = new THREE.InstancedMesh(geo, stoneMat, rockCount);
            rocks.castShadow = true;
            rocks.receiveShadow = true;
            rocks.name = 'rocks_map2';

            let placed = 0;
            for (let i = 0; i < rockCount * 2; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 15 + Math.random() * 90;
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                const y = this.getTerrainHeight(x, z);

                if (y < this.cfg.waterLevel + 0.5 || Math.hypot(x, z) < 12) continue;

                _dummy.position.set(x, y + 0.5, z);
                _dummy.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                _dummy.scale.set(
                    0.7 + Math.random() * 0.6,
                    0.7 + Math.random() * 0.6,
                    0.7 + Math.random() * 0.6
                );
                _dummy.updateMatrix();
                rocks.setMatrixAt(placed, _dummy.matrix);

                placed++;
                if (placed >= rockCount) break;
            }

            rocks.count = placed;
            rocks.instanceMatrix.needsUpdate = true;
            this.scene.add(rocks);
            this._instanced.push(rocks);
        }

        /**
         * Arbustos, ervas e flores — InstancedMesh para performance.
         * Só em solo seco, fora da clareira central e acima da água.
         */
        async _buildVegetation() {
            const { bushCount, herbCount, flowerCount, waterLevel } = this.cfg;
            const minR = 14;
            const maxR = 100;

            const canPlace = (x, z) => {
                const dist = Math.hypot(x, z);
                if (dist < minR || dist > maxR) return false;
                const y = this.getTerrainHeight(x, z);
                if (y < waterLevel + 0.55) return false;
                return y;
            };

            // ---------- Arbustos (clusters de esferas, tons variados) ----------
            const bushGeo = new THREE.SphereGeometry(0.55, 8, 6);
            const bushMats = [
                new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.92, metalness: 0 }),
                new THREE.MeshStandardMaterial({ color: 0x3d6b32, roughness: 0.9, metalness: 0 }),
                new THREE.MeshStandardMaterial({ color: 0x1a4d1a, roughness: 0.94, metalness: 0 }),
                new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 0.88, metalness: 0 }),
                new THREE.MeshStandardMaterial({ color: 0x365c2a, roughness: 0.91, metalness: 0 })
            ];
            // Reserva extra de instâncias (clusters de 3–4)
            const bushInstances = bushMats.map((mat, mi) => {
                const n = Math.ceil((bushCount * 3.2) / bushMats.length);
                const mesh = new THREE.InstancedMesh(bushGeo, mat, n);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.name = 'bushes_map2_' + mi;
                return { mesh, placed: 0, max: n };
            });

            let bushesPlaced = 0;
            for (let i = 0; i < bushCount * 4 && bushesPlaced < bushCount; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = minR + Math.random() * (maxR - minR);
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                const y = canPlace(x, z);
                if (y === false) continue;

                // Cada arbusto = 3–4 esferas sobrepostas (mais volume)
                const cluster = 3 + (Math.random() > 0.5 ? 1 : 0);
                let added = 0;
                for (let c = 0; c < cluster; c++) {
                    const bi = Math.floor(Math.random() * bushInstances.length);
                    const slot = bushInstances[bi];
                    if (slot.placed >= slot.max) continue;

                    const ox = (Math.random() - 0.5) * 0.65;
                    const oz = (Math.random() - 0.5) * 0.65;
                    const s = 0.5 + Math.random() * 0.7;
                    const hMul = 0.5 + Math.random() * 0.4;
                    _dummy.position.set(x + ox, y + 0.22 * s * hMul + 0.05, z + oz);
                    _dummy.rotation.set(
                        (Math.random() - 0.5) * 0.25,
                        Math.random() * Math.PI * 2,
                        (Math.random() - 0.5) * 0.25
                    );
                    _dummy.scale.set(
                        s * (0.85 + Math.random() * 0.35),
                        s * hMul,
                        s * (0.85 + Math.random() * 0.35)
                    );
                    _dummy.updateMatrix();
                    slot.mesh.setMatrixAt(slot.placed++, _dummy.matrix);
                    added++;
                }
                if (added > 0) bushesPlaced++;
                if (bushInstances.every(s => s.placed >= s.max)) break;
            }
            for (const slot of bushInstances) {
                slot.mesh.count = slot.placed;
                slot.mesh.instanceMatrix.needsUpdate = true;
                this.scene.add(slot.mesh);
                this._instanced.push(slot.mesh);
            }

            // ---------- Ervas (cones finos / tufos) ----------
            const herbGeo = new THREE.ConeGeometry(0.12, 0.7, 5);
            const herbMats = [
                new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.88, metalness: 0 }),
                new THREE.MeshStandardMaterial({ color: 0x6b8f4e, roughness: 0.86, metalness: 0 }),
                new THREE.MeshStandardMaterial({ color: 0x3a6b2a, roughness: 0.9, metalness: 0 }),
                new THREE.MeshStandardMaterial({ color: 0x8a9a4a, roughness: 0.85, metalness: 0 })
            ];
            const herbInstances = herbMats.map((mat, mi) => {
                const n = Math.ceil(herbCount / herbMats.length);
                const mesh = new THREE.InstancedMesh(herbGeo, mat, n);
                mesh.castShadow = false;
                mesh.receiveShadow = true;
                mesh.name = 'herbs_map2_' + mi;
                return { mesh, placed: 0, max: n };
            });

            for (let i = 0; i < herbCount * 3; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = minR + Math.random() * (maxR - minR);
                const x = Math.cos(a) * r + (Math.random() - 0.5) * 1.2;
                const z = Math.sin(a) * r + (Math.random() - 0.5) * 1.2;
                const y = canPlace(x, z);
                if (y === false) continue;

                const hi = Math.floor(Math.random() * herbInstances.length);
                const slot = herbInstances[hi];
                if (slot.placed >= slot.max) continue;

                const s = 0.7 + Math.random() * 1.1;
                const lean = (Math.random() - 0.5) * 0.35;
                _dummy.position.set(x, y + 0.32 * s, z);
                _dummy.rotation.set(lean, Math.random() * Math.PI * 2, lean * 0.6);
                _dummy.scale.set(s * (0.7 + Math.random() * 0.5), s, s * (0.7 + Math.random() * 0.5));
                _dummy.updateMatrix();
                slot.mesh.setMatrixAt(slot.placed++, _dummy.matrix);

                if (herbInstances.every(s => s.placed >= s.max)) break;
            }
            for (const slot of herbInstances) {
                slot.mesh.count = slot.placed;
                slot.mesh.instanceMatrix.needsUpdate = true;
                this.scene.add(slot.mesh);
                this._instanced.push(slot.mesh);
            }

            // ---------- Flores (caule fino + pétala colorida) ----------
            const stemGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.45, 4);
            const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d6b2a, roughness: 0.9, metalness: 0 });
            const stemMesh = new THREE.InstancedMesh(stemGeo, stemMat, flowerCount);
            stemMesh.castShadow = false;
            stemMesh.receiveShadow = true;
            stemMesh.name = 'flower_stems_map2';

            const petalGeo = new THREE.SphereGeometry(0.12, 6, 5);
            const petalColors = [
                0xf43f5e, // rosa/vermelho
                0xfbbf24, // amarelo
                0xa78bfa, // lilás
                0xf9a8d4, // rosa claro
                0xffffff, // branco
                0x38bdf8, // azul
                0xfb923c  // laranja
            ];
            const petalInstances = petalColors.map((col, mi) => {
                const n = Math.ceil(flowerCount / petalColors.length);
                const mat = new THREE.MeshStandardMaterial({
                    color: col,
                    roughness: 0.55,
                    metalness: 0.05,
                    emissive: col,
                    emissiveIntensity: 0.12
                });
                const mesh = new THREE.InstancedMesh(petalGeo, mat, n);
                mesh.castShadow = false;
                mesh.receiveShadow = true;
                mesh.name = 'flowers_map2_' + mi;
                return { mesh, placed: 0, max: n };
            });

            let stemsPlaced = 0;
            for (let i = 0; i < flowerCount * 4; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = minR + Math.random() * (maxR - minR);
                const x = Math.cos(a) * r + (Math.random() - 0.5) * 2;
                const z = Math.sin(a) * r + (Math.random() - 0.5) * 2;
                const y = canPlace(x, z);
                if (y === false) continue;

                const pi = Math.floor(Math.random() * petalInstances.length);
                const slot = petalInstances[pi];
                if (slot.placed >= slot.max || stemsPlaced >= flowerCount) continue;

                const s = 0.75 + Math.random() * 0.7;
                const lean = (Math.random() - 0.5) * 0.25;

                // Caule
                _dummy.position.set(x, y + 0.22 * s, z);
                _dummy.rotation.set(lean, 0, lean * 0.5);
                _dummy.scale.set(s, s, s);
                _dummy.updateMatrix();
                stemMesh.setMatrixAt(stemsPlaced, _dummy.matrix);

                // Pétala no topo
                _dummy.position.set(x + lean * 0.08, y + 0.48 * s, z + lean * 0.05);
                _dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                _dummy.scale.set(s * (0.85 + Math.random() * 0.4), s * 0.7, s * (0.85 + Math.random() * 0.4));
                _dummy.updateMatrix();
                slot.mesh.setMatrixAt(slot.placed++, _dummy.matrix);

                stemsPlaced++;
                if (stemsPlaced >= flowerCount) break;
            }

            stemMesh.count = stemsPlaced;
            stemMesh.instanceMatrix.needsUpdate = true;
            this.scene.add(stemMesh);
            this._instanced.push(stemMesh);

            for (const slot of petalInstances) {
                slot.mesh.count = slot.placed;
                slot.mesh.instanceMatrix.needsUpdate = true;
                this.scene.add(slot.mesh);
                this._instanced.push(slot.mesh);
            }
        }

        /** Monta um baú de tesouro detalhado (corpo, tampa, ferragens, fechadura) */
        _createTreasureChest(scale = 1) {
            const s = scale;
            const group = new THREE.Group();
            group.name = 'treasure_chest';

            const wood = new THREE.MeshStandardMaterial({
                color: 0x6b3f24, roughness: 0.82, metalness: 0.05
            });
            const woodDark = new THREE.MeshStandardMaterial({
                color: 0x4a2c18, roughness: 0.88, metalness: 0.05
            });
            const iron = new THREE.MeshStandardMaterial({
                color: 0x71717a, roughness: 0.45, metalness: 0.75
            });
            const gold = new THREE.MeshStandardMaterial({
                color: 0xfbbf24, roughness: 0.3, metalness: 0.85,
                emissive: 0xb45309, emissiveIntensity: 0.25
            });

            // Corpo
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 0.85 * s, 1.05 * s), wood);
            body.position.y = 0.5 * s;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // Fundo interno (escuro)
            const inner = new THREE.Mesh(
                new THREE.BoxGeometry(1.4 * s, 0.15 * s, 0.85 * s),
                woodDark
            );
            inner.position.y = 0.22 * s;
            group.add(inner);

            // Faixas de ferro horizontais
            for (const yy of [0.25, 0.55, 0.78]) {
                const band = new THREE.Mesh(
                    new THREE.BoxGeometry(1.68 * s, 0.08 * s, 1.12 * s),
                    iron
                );
                band.position.y = yy * s;
                band.castShadow = true;
                group.add(band);
            }
            // Faixas laterais
            for (const sx of [-0.78, 0.78]) {
                const side = new THREE.Mesh(
                    new THREE.BoxGeometry(0.08 * s, 0.85 * s, 1.12 * s),
                    iron
                );
                side.position.set(sx * s, 0.5 * s, 0);
                group.add(side);
            }

            // Pés
            const footGeo = new THREE.BoxGeometry(0.18 * s, 0.14 * s, 0.18 * s);
            for (const [fx, fz] of [[-0.65, -0.4], [0.65, -0.4], [-0.65, 0.4], [0.65, 0.4]]) {
                const foot = new THREE.Mesh(footGeo, iron);
                foot.position.set(fx * s, 0.07 * s, fz * s);
                foot.castShadow = true;
                group.add(foot);
            }

            // Tampa (pivô na borda traseira)
            const lidPivot = new THREE.Group();
            lidPivot.position.set(0, 0.92 * s, -0.52 * s);
            group.add(lidPivot);

            const lid = new THREE.Mesh(
                new THREE.BoxGeometry(1.62 * s, 0.22 * s, 1.08 * s),
                wood
            );
            lid.position.set(0, 0.05 * s, 0.52 * s);
            lid.castShadow = true;
            lidPivot.add(lid);

            // Curvatura da tampa (semi-cilindro visual)
            const lidTop = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55 * s, 0.55 * s, 1.55 * s, 10, 1, false, 0, Math.PI),
                wood
            );
            lidTop.rotation.z = Math.PI / 2;
            lidTop.position.set(0, 0.22 * s, 0.52 * s);
            lidTop.castShadow = true;
            lidPivot.add(lidTop);

            // Faixa da tampa
            const lidBand = new THREE.Mesh(
                new THREE.BoxGeometry(1.7 * s, 0.07 * s, 1.12 * s),
                iron
            );
            lidBand.position.set(0, 0.08 * s, 0.52 * s);
            lidPivot.add(lidBand);

            // Fechadura dourada
            const lockPlate = new THREE.Mesh(
                new THREE.BoxGeometry(0.28 * s, 0.32 * s, 0.08 * s),
                gold
            );
            lockPlate.position.set(0, 0.72 * s, 0.54 * s);
            lockPlate.castShadow = true;
            group.add(lockPlate);

            const lockRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.09 * s, 0.03 * s, 6, 12),
                gold
            );
            lockRing.position.set(0, 0.62 * s, 0.58 * s);
            group.add(lockRing);

            // Brilho mágico suave em cima
            const glow = new THREE.Mesh(
                new THREE.SphereGeometry(0.2 * s, 8, 6),
                new THREE.MeshStandardMaterial({
                    color: 0xfde68a,
                    emissive: 0xf59e0b,
                    emissiveIntensity: 0.6,
                    transparent: true,
                    opacity: 0.55
                })
            );
            glow.position.set(0, 1.25 * s, 0);
            group.add(glow);

            group.userData = {
                type: 'chest',
                opened: false,
                lidPivot,
                glow,
                goldMat: gold,
                baseY: 0
            };
            return group;
        }


        /**
         * Erva medicinal detalhada: caule, folhas lanceoladas, flores
         * e brilho mágico suave (missão da Curandeira).
         * @param {number} scale
         * @returns {THREE.Group}
         */
        _createMedicinalHerb(scale = 1) {
            const s = scale;
            const group = new THREE.Group();
            group.name = 'medicinal_herb';

            const stemMat = new THREE.MeshStandardMaterial({
                color: 0x3f7a2e,
                roughness: 0.85,
                metalness: 0.02
            });
            const leafMat = new THREE.MeshStandardMaterial({
                color: 0x22c55e,
                emissive: 0x14532d,
                emissiveIntensity: 0.18,
                roughness: 0.72,
                metalness: 0.0,
                side: THREE.DoubleSide
            });
            const leafDarkMat = new THREE.MeshStandardMaterial({
                color: 0x166534,
                emissive: 0x052e16,
                emissiveIntensity: 0.12,
                roughness: 0.8,
                side: THREE.DoubleSide
            });
            const flowerMat = new THREE.MeshStandardMaterial({
                color: 0xa3e635,
                emissive: 0x65a30d,
                emissiveIntensity: 0.45,
                roughness: 0.4,
                metalness: 0.05
            });
            const berryMat = new THREE.MeshStandardMaterial({
                color: 0xf472b6,
                emissive: 0xdb2777,
                emissiveIntensity: 0.25,
                roughness: 0.4
            });

            // Caule principal
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.035 * s, 0.055 * s, 0.95 * s, 6),
                stemMat
            );
            stem.position.y = 0.48 * s;
            stem.rotation.z = 0.06;
            stem.castShadow = true;
            group.add(stem);

            // Ramificação
            const stem2 = new THREE.Mesh(
                new THREE.CylinderGeometry(0.022 * s, 0.032 * s, 0.42 * s, 5),
                stemMat
            );
            stem2.position.set(0.12 * s, 0.72 * s, 0.02 * s);
            stem2.rotation.z = -0.55;
            stem2.rotation.x = 0.15;
            stem2.castShadow = true;
            group.add(stem2);

            // Folha lanceolada
            const makeLeaf = (w, h, mat) => {
                const shape = new THREE.Shape();
                shape.moveTo(0, 0);
                shape.quadraticCurveTo(w * 0.55, h * 0.25, w * 0.48, h * 0.55);
                shape.quadraticCurveTo(w * 0.22, h * 0.92, 0, h);
                shape.quadraticCurveTo(-w * 0.22, h * 0.92, -w * 0.48, h * 0.55);
                shape.quadraticCurveTo(-w * 0.55, h * 0.25, 0, 0);
                const geo = new THREE.ShapeGeometry(shape);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                return mesh;
            };

            const leafPositions = [
                // x, y, z, rotY, rotX, rotZ, scale, dark
                [0.18, 0.28, 0.05, 0.9, -0.55, 0.25, 0.85, false],
                [-0.16, 0.35, -0.08, -1.1, -0.5, -0.3, 0.9, true],
                [0.14, 0.52, 0.1, 1.4, -0.65, 0.15, 0.75, false],
                [-0.2, 0.58, 0.02, -0.7, -0.7, -0.2, 0.8, false],
                [0.08, 0.75, -0.12, 2.1, -0.45, 0.35, 0.7, true],
                [-0.1, 0.82, 0.08, -2.3, -0.55, -0.25, 0.65, false],
                [0.22, 0.68, -0.05, 0.4, -0.8, 0.4, 0.6, true],
                [0.05, 0.95, 0.0, 0.0, -0.35, 0.1, 0.55, false]
            ];

            leafPositions.forEach(([x, y, z, ry, rx, rz, sc, dark]) => {
                const leaf = makeLeaf(0.22 * s * sc, 0.38 * s * sc, dark ? leafDarkMat : leafMat);
                leaf.position.set(x * s, y * s, z * s);
                leaf.rotation.set(rx, ry, rz);
                group.add(leaf);
            });

            // Flores / botões no topo
            const flowerPositions = [
                [0.02, 1.05, 0.0, 1.0],
                [0.28, 0.88, 0.04, 0.75],
                [-0.12, 0.98, -0.06, 0.7],
                [0.15, 0.78, 0.12, 0.55]
            ];
            flowerPositions.forEach(([x, y, z, sc]) => {
                const center = new THREE.Mesh(
                    new THREE.SphereGeometry(0.045 * s * sc, 6, 5),
                    flowerMat
                );
                center.position.set(x * s, y * s, z * s);
                group.add(center);
                for (let p = 0; p < 5; p++) {
                    const ang = (p / 5) * Math.PI * 2;
                    const petal = new THREE.Mesh(
                        new THREE.SphereGeometry(0.038 * s * sc, 5, 4),
                        flowerMat
                    );
                    petal.position.set(
                        x * s + Math.cos(ang) * 0.055 * s * sc,
                        y * s + 0.01 * s,
                        z * s + Math.sin(ang) * 0.055 * s * sc
                    );
                    petal.scale.set(1, 0.55, 1);
                    group.add(petal);
                }
            });

            // Bagas rosa (detalhe medicinal)
            const berryPositions = [
                [0.1, 0.62, -0.1],
                [-0.18, 0.48, 0.06],
                [0.2, 0.4, 0.08]
            ];
            berryPositions.forEach(([x, y, z]) => {
                const berry = new THREE.Mesh(
                    new THREE.SphereGeometry(0.032 * s, 6, 5),
                    berryMat
                );
                berry.position.set(x * s, y * s, z * s);
                berry.castShadow = true;
                group.add(berry);
            });

            // Base de terra
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 0.08 * s, 7),
                new THREE.MeshStandardMaterial({
                    color: 0x5c4033,
                    roughness: 0.95
                })
            );
            base.position.y = 0.03 * s;
            group.add(base);

            group.userData = {
                type: 'herb',
                baseY: 0
            };
            return group;
        }

        /**
         * Cristal místico com núcleo + 2–3 fragmentos laterais (detalhe moderado).
         * @param {number} scale
         * @returns {THREE.Group}
         */
        _createCrystal(scale = 1) {
            const s = scale;
            const group = new THREE.Group();
            group.name = 'mystic_crystal';

            const mat = new THREE.MeshStandardMaterial({
                color: 0x22d3ee,
                emissive: 0x0891b2,
                emissiveIntensity: 0.5,
                roughness: 0.18,
                metalness: 0.15,
                transparent: true,
                opacity: 0.92
            });
            const matDark = new THREE.MeshStandardMaterial({
                color: 0x0e7490,
                emissive: 0x155e75,
                emissiveIntensity: 0.35,
                roughness: 0.25,
                metalness: 0.2
            });

            // Núcleo principal
            const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.55 * s, 0), mat);
            core.position.y = 0.55 * s;
            core.rotation.y = 0.4;
            core.castShadow = true;
            group.add(core);

            // Fragmento alto fino
            const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.28 * s, 0), mat);
            tip.position.set(0.12 * s, 1.05 * s, -0.08 * s);
            tip.scale.set(0.55, 1.15, 0.55);
            tip.rotation.set(0.2, 0.8, 0.15);
            tip.castShadow = true;
            group.add(tip);

            // Fragmentos laterais menores
            const sideA = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * s, 0), matDark);
            sideA.position.set(-0.32 * s, 0.42 * s, 0.1 * s);
            sideA.scale.set(0.7, 0.9, 0.7);
            sideA.rotation.set(-0.3, 1.2, 0.4);
            group.add(sideA);

            const sideB = new THREE.Mesh(new THREE.OctahedronGeometry(0.18 * s, 0), matDark);
            sideB.position.set(0.28 * s, 0.35 * s, 0.18 * s);
            sideB.scale.set(0.65, 0.8, 0.65);
            sideB.rotation.set(0.25, -0.6, -0.2);
            group.add(sideB);

            // Base rochosa discreta
            const base = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.22 * s, 0),
                new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, metalness: 0.1 })
            );
            base.position.y = 0.08 * s;
            base.scale.set(1.2, 0.55, 1.2);
            group.add(base);

            return group;
        }

        /**
         * Minério: pedra principal + veios e fragmentos (detalhe moderado).
         * @param {number} scale
         * @returns {THREE.Group}
         */
        _createOre(scale = 1) {
            const s = scale;
            const group = new THREE.Group();
            group.name = 'ore_rock';

            const rockMat = new THREE.MeshStandardMaterial({
                color: 0x78716c,
                roughness: 0.88,
                metalness: 0.15
            });
            const oreMat = new THREE.MeshStandardMaterial({
                color: 0xd97706,
                emissive: 0x92400e,
                emissiveIntensity: 0.28,
                roughness: 0.45,
                metalness: 0.55
            });
            const veinMat = new THREE.MeshStandardMaterial({
                color: 0xfbbf24,
                emissive: 0xb45309,
                emissiveIntensity: 0.2,
                roughness: 0.4,
                metalness: 0.6
            });

            // Pedra principal irregular
            const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 * s, 0), rockMat);
            main.position.y = 0.35 * s;
            main.scale.set(1.15, 0.9, 1.05);
            main.rotation.set(0.3, 0.5, -0.15);
            main.castShadow = true;
            group.add(main);

            // Bloco de minério embutido
            const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 * s, 0), oreMat);
            chunk.position.set(0.12 * s, 0.42 * s, 0.18 * s);
            chunk.scale.set(0.9, 0.75, 1.1);
            chunk.rotation.set(-0.4, 1.1, 0.2);
            chunk.castShadow = true;
            group.add(chunk);

            // Veio fino
            const vein = new THREE.Mesh(
                new THREE.BoxGeometry(0.08 * s, 0.35 * s, 0.06 * s),
                veinMat
            );
            vein.position.set(-0.15 * s, 0.4 * s, 0.05 * s);
            vein.rotation.set(0.5, 0.3, 0.7);
            group.add(vein);

            // Fragmento menor ao lado
            const bit = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 * s, 0), oreMat);
            bit.position.set(-0.28 * s, 0.18 * s, -0.12 * s);
            bit.rotation.set(0.6, -0.4, 0.3);
            group.add(bit);

            // Pedra de apoio
            const support = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 * s, 0), rockMat);
            support.position.set(0.2 * s, 0.12 * s, -0.2 * s);
            support.scale.set(1, 0.6, 0.9);
            group.add(support);

            return group;
        }

        _initCollectibles() {
            // Mesmos modelos da Vila: cristal, minério (pedra+veios) e erva medicinal
            const minDry = this.cfg.waterLevel + 0.8;
            const isDry = (x, z) => this.getTerrainHeight(x, z) >= minDry;

            // Cristais místicos (modelo detalhado da vila)
            const crystalCoords = [
                [32, -38], [50, -20], [-40, 48], [60, 30], [-60, -35],
                [22, -55], [-28, -48], [75, -25], [-70, 25], [48, 60],
                [-55, 55], [15, 40]
            ];
            crystalCoords.forEach((pt, i) => {
                let [x, z] = pt;
                if (!isDry(x, z)) {
                    for (let t = 0; t < 24 && !isDry(x, z); t++) {
                        x += (Math.random() - 0.5) * 8;
                        z += (Math.random() - 0.5) * 8;
                    }
                }
                if (!isDry(x, z)) return;
                const crystal = this._createCrystal(1.0 + Math.random() * 0.15);
                const gy = this.getTerrainHeight(x, z);
                crystal.position.set(x, gy, z);
                crystal.rotation.y = Math.random() * Math.PI * 2;
                crystal.userData = {
                    id: 'crystal_' + i,
                    type: 'crystal',
                    name: 'Cristal Místico',
                    baseY: gy
                };
                crystal.name = 'crystal_' + i;
                this.scene.add(crystal);
                this.collectibles.push(crystal);
                this._groups.push(crystal);
            });

            // Minérios / pedras com veios (modelo detalhado da vila)
            const oreCoords = [
                [40, -30], [-35, 20], [55, 45], [-50, -20], [20, 55],
                [-20, -60], [70, 10], [-65, 40], [10, -45], [-45, 60]
            ];
            oreCoords.forEach((pt, i) => {
                let [x, z] = pt;
                if (!isDry(x, z)) {
                    for (let t = 0; t < 24 && !isDry(x, z); t++) {
                        x += (Math.random() - 0.5) * 8;
                        z += (Math.random() - 0.5) * 8;
                    }
                }
                if (!isDry(x, z)) return;
                const ore = this._createOre(1.0 + Math.random() * 0.2);
                const gy = this.getTerrainHeight(x, z);
                ore.position.set(x, gy, z);
                ore.rotation.y = Math.random() * Math.PI * 2;
                ore.userData = {
                    id: 'ore_' + i,
                    type: 'ore',
                    name: 'Minério',
                    baseY: gy
                };
                ore.name = 'ore_' + i;
                this.scene.add(ore);
                this.collectibles.push(ore);
                this._groups.push(ore);
            });

            // Ervas medicinais (modelo detalhado da vila)
            const herbCoords = [
                [28, -42], [-30, 35], [45, 20], [-55, -40], [65, -15],
                [-15, 65], [35, 50], [-70, 5], [5, -70], [55, -50],
                [-40, -55], [18, 28]
            ];
            herbCoords.forEach((pt, i) => {
                let [x, z] = pt;
                if (!isDry(x, z)) {
                    for (let t = 0; t < 24 && !isDry(x, z); t++) {
                        x += (Math.random() - 0.5) * 8;
                        z += (Math.random() - 0.5) * 8;
                    }
                }
                if (!isDry(x, z)) return;
                const herb = this._createMedicinalHerb(1.05 + Math.random() * 0.2);
                const gy = this.getTerrainHeight(x, z);
                herb.position.set(x, gy, z);
                herb.rotation.y = Math.random() * Math.PI * 2;
                herb.userData = {
                    id: 'herb_' + i,
                    type: 'herb',
                    name: 'Erva Medicinal',
                    baseY: gy
                };
                herb.name = 'herb_' + i;
                this.scene.add(herb);
                this.collectibles.push(herb);
                this._groups.push(herb);
            });

            // Baús de tesouro detalhados
            const chestPositions = [
                { x: 35, z: -40, id: 'vale_chest_1' },
                { x: -42, z: 28, id: 'vale_chest_2' }
            ];
            for (const pos of chestPositions) {
                const cy = this.getTerrainHeight(pos.x, pos.z);
                const chest = this._createTreasureChest(1.0);
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


        /**
         * Carruagem destruída + partes espalhadas (missão do mercador)
         * Posição: centro do vale (perto do spawn do jogador)
         */
        _buildDestroyedCarriage() {
            // Após a missão concluída, o mapa já nasce com a carruagem restaurada.
            if (this.carriageQuestDone) {
                this._buildRepairedCarriage();
                return;
            }

            // Centro do mapa2 — spawn do jogador fica em (0, 6)
            const cx = 10;
            const cz = -8;
            const cy = this.getTerrainHeight(cx, cz);

            // ===== CARRUAGEM QUEBRADA =====
            const cart = new THREE.Group();
            cart.name = 'destroyed_carriage';
            cart.position.set(cx, cy, cz);
            cart.rotation.y = 0.85;

            const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3d2e, roughness: 0.9 });
            const darkWood = new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.92 });
            const ironMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, metalness: 0.7, roughness: 0.45 });
            const brokenMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.95 });

            // Chassis (base inclinada / quebrada)
            const chassis = new THREE.Mesh(
                new THREE.BoxGeometry(3.6, 0.28, 1.9),
                woodMat
            );
            chassis.position.set(0, 0.55, 0);
            chassis.rotation.z = 0.18;
            chassis.rotation.x = -0.08;
            chassis.castShadow = true;
            cart.add(chassis);

            // Lateral esquerda intacta
            const sideL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.12), darkWood);
            sideL.position.set(0.1, 1.05, -0.85);
            sideL.castShadow = true;
            cart.add(sideL);

            // Lateral direita quebrada (pedaços)
            const sideR1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.12), brokenMat);
            sideR1.position.set(-0.9, 0.95, 0.88);
            sideR1.rotation.z = 0.35;
            sideR1.castShadow = true;
            cart.add(sideR1);
            const sideR2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.1), brokenMat);
            sideR2.position.set(1.1, 0.7, 0.95);
            sideR2.rotation.x = 0.4;
            sideR2.rotation.y = -0.2;
            cart.add(sideR2);

            // Frente (assento do cocheiro) danificada
            const front = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 1.7), woodMat);
            front.position.set(-1.7, 1.15, 0);
            front.rotation.z = -0.25;
            front.castShadow = true;
            cart.add(front);

            // Roda traseira esquerda (ainda no eixo, inclinada)
            // Roda mais adequada: aro de madeira, pneu/ferro externo, cubo central e 8 raios.
            const makeWheel = (x, y, z, rotX, rotZ, scale = 1) => {
                const w = new THREE.Group();
                w.position.set(x, y, z);
                w.rotation.x = rotX || 0;
                w.rotation.z = rotZ || 0;
                w.scale.setScalar(scale);

                const outer = new THREE.Mesh(
                    new THREE.TorusGeometry(0.78, 0.13, 12, 24),
                    ironMat
                );
                outer.castShadow = true;
                w.add(outer);

                const woodenRim = new THREE.Mesh(
                    new THREE.TorusGeometry(0.62, 0.075, 10, 20),
                    woodMat
                );
                woodenRim.castShadow = true;
                w.add(woodenRim);

                const hub = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.15, 0.15, 0.24, 12),
                    darkWood
                );
                hub.rotation.x = Math.PI / 2;
                hub.castShadow = true;
                w.add(hub);

                for (let i = 0; i < 8; i++) {
                    const spoke = new THREE.Mesh(
                        new THREE.BoxGeometry(0.58, 0.07, 0.07),
                        woodMat
                    );
                    const a = (i / 8) * Math.PI * 2;
                    spoke.rotation.z = a;
                    spoke.position.x = Math.cos(a) * 0.31;
                    spoke.position.y = Math.sin(a) * 0.31;
                    spoke.castShadow = true;
                    w.add(spoke);
                }
                return w;
            };
            cart.add(makeWheel(-1.2, 0.75, -1.05, 0.15, 0.1));
            // Roda dianteira direita caída no chão
            const fallenWheel = makeWheel(1.8, 0.35, 1.4, 1.2, 0.4);
            cart.add(fallenWheel);

            // Eixo quebrado no chão
            const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), ironMat);
            axle.rotation.z = Math.PI / 2;
            axle.rotation.y = 0.3;
            axle.position.set(0.6, 0.25, 0.9);
            cart.add(axle);

            // Caixas / carga destruída
            const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.6), darkWood);
            crate1.position.set(0.4, 0.95, -0.2);
            crate1.rotation.y = 0.4;
            crate1.rotation.z = 0.2;
            cart.add(crate1);
            const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.45), brokenMat);
            crate2.position.set(1.2, 0.45, 0.3);
            crate2.rotation.x = 0.6;
            cart.add(crate2);

            // Fumaça / marcas de ataque (esferas escuras + emissive)
            const scorched = new THREE.Mesh(
                new THREE.SphereGeometry(0.35, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x331100, emissiveIntensity: 0.3, roughness: 1 })
            );
            scorched.position.set(-0.5, 0.9, 0.4);
            scorched.scale.set(1.4, 0.6, 1.1);
            cart.add(scorched);

            this.scene.add(cart);
            this._groups.push(cart);
            this.colliders.push({ x: cx, z: cz, radius: 2.8, type: 'carriage' });

            // ===== PARTES FALTANTES (coletáveis) =====
            // Perto do centro, fáceis de achar ao redor da carruagem
            const partDefs = [
                { x: 22, z: 6, type: 'carriage_wheel', label: 'Roda da Carruagem' },
                { x: -8, z: -18, type: 'carriage_axle', label: 'Eixo de Ferro' },
                { x: 16, z: -22, type: 'carriage_chest', label: 'Baú de Carga' }
            ];

            const partMats = {
                carriage_wheel: ironMat,
                carriage_axle: ironMat,
                carriage_chest: darkWood
            };

            for (const pd of partDefs) {
                const py = this.getTerrainHeight(pd.x, pd.z);
                let mesh;
                if (pd.type === 'carriage_wheel') {
                    mesh = makeWheel(0, 0, 0, 0.55, 0.25, 0.82);
                } else if (pd.type === 'carriage_axle') {
                    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8), ironMat);
                    mesh.rotation.z = Math.PI / 2;
                    mesh.rotation.y = Math.random() * 1.5;
                } else {
                    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.55), darkWood);
                    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.58), woodMat);
                    lid.position.y = 0.3;
                    mesh.add(lid);
                }
                mesh.position.set(pd.x, py + 0.55, pd.z);
                if (pd.type !== 'carriage_wheel') mesh.scale.setScalar(1.12);
                mesh.castShadow = true;
                mesh.userData = {
                    type: 'carriage_part',
                    partType: pd.type,
                    label: pd.label,
                    value: 1,
                    baseY: py + 0.55
                };
                // Brilho forte para destacar
                mesh.traverse(obj => {
                    if (obj.isMesh && obj.material) {
                        obj.material = obj.material.clone();
                        obj.material.emissive = new THREE.Color(0xf59e0b);
                        obj.material.emissiveIntensity = 0.28;
                    }
                });
                // Marcador da peça: seta flutuante apontando diretamente para ela.
                // O marcador pertence à própria peça, então desaparece automaticamente
                // quando a peça é coletada/removida.
                const marker = new THREE.Group();
                marker.name = `carriage_marker_${pd.type}`;
                marker.userData = { type: 'carriage_marker', owner: pd.type };

                const shaft = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.055, 0.055, 0.75, 8),
                    new THREE.MeshBasicMaterial({
                        color: 0xfbbf24,
                        transparent: true,
                        opacity: 0.95,
                        depthWrite: false
                    })
                );
                shaft.position.y = 0.65;
                marker.add(shaft);

                // Cone apontando para baixo.
                const arrowHead = new THREE.Mesh(
                    new THREE.ConeGeometry(0.20, 0.42, 8),
                    new THREE.MeshBasicMaterial({
                        color: 0xfbbf24,
                        transparent: true,
                        opacity: 0.98,
                        depthWrite: false
                    })
                );
                arrowHead.rotation.z = Math.PI;
                arrowHead.position.y = 0.18;
                marker.add(arrowHead);

                marker.position.set(0, 1.65, 0);
                mesh.add(marker);
                mesh.userData.marker = marker;

                this.scene.add(mesh);
                this.collectibles.push(mesh);
            }

            // Luz de destaque na carruagem
            const cartLight = new THREE.PointLight(0xf59e0b, 1.2, 18);
            cartLight.position.set(cx, cy + 2.5, cz);
            this.scene.add(cartLight);
            this._groups.push(cartLight);

            // Referência para o NPC (posição da carruagem)
            this.carriagePos = { x: cx, z: cz, y: cy };
        }

        setCarriageRepaired() {
            this.carriageQuestDone = true;
            const old = this.scene.getObjectByName('destroyed_carriage');
            if (old) {
                this.scene.remove(old);
                const idx = this._groups.indexOf(old);
                if (idx >= 0) this._groups.splice(idx, 1);
            }
            this.colliders = this.colliders.filter(c => c.type !== 'carriage');
            const oldLight = this._groups.find(o => o && o.isLight && o.type === 'PointLight' && o.position && Math.abs(o.position.x - 10) < 0.1 && Math.abs(o.position.z + 8) < 0.1);
            if (oldLight) {
                this.scene.remove(oldLight);
                const idx = this._groups.indexOf(oldLight);
                if (idx >= 0) this._groups.splice(idx, 1);
            }
            if (!this.scene.getObjectByName('repaired_carriage')) this._buildRepairedCarriage();
        }

        _buildRepairedCarriage() {
            const cx = 10, cz = -8;
            const cy = this.getTerrainHeight(cx, cz);
            const cart = new THREE.Group();
            cart.name = 'repaired_carriage';
            cart.position.set(cx, cy, cz);
            cart.rotation.y = 0.85;

            const wood = new THREE.MeshStandardMaterial({ color: 0x7b4f2f, roughness: 0.78 });
            const darkWood = new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.84 });
            const iron = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.78, roughness: 0.32 });
            const gold = new THREE.MeshStandardMaterial({ color: 0xb8862d, metalness: 0.65, roughness: 0.3 });

            const base = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.32, 2.0), wood);
            base.position.y = 0.62; base.castShadow = true; cart.add(base);
            const floor = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.16, 1.65), darkWood);
            floor.position.y = 0.82; floor.castShadow = true; cart.add(floor);

            for (const z of [-0.86, 0.86]) {
                const side = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.95, 0.14), wood);
                side.position.set(0, 1.18, z); side.castShadow = true; cart.add(side);
            }
            const front = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 1.8), wood);
            front.position.set(-1.72, 1.2, 0); front.castShadow = true; cart.add(front);
            const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 1.8), wood);
            canopy.position.set(0.25, 2.0, 0); canopy.rotation.z = -0.03; canopy.castShadow = true; cart.add(canopy);

            // Banco do cocheiro
            const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 1.45), darkWood);
            seat.position.set(-1.35, 1.65, 0); seat.castShadow = true; cart.add(seat);

            // Eixo e 4 rodas iguais, alinhadas e proporcionais.
            // As rodas ficam nas laterais da carruagem: o plano da roda é X/Y
            // e o eixo atravessa a roda no sentido Z.
            const makeWheel = (x, y, z) => {
                const w = new THREE.Group();
                w.position.set(x, y, z);

                const outer = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.13, 12, 24), iron);
                // TorusGeometry já está no plano X/Y; não girar em Y.
                outer.castShadow = true;
                w.add(outer);

                const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 10, 20), wood);
                rim.castShadow = true;
                w.add(rim);

                const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.25, 12), gold);
                // Cylinder tem eixo Y; para atravessar a roda, alinhar no eixo Z.
                hub.rotation.x = Math.PI / 2;
                hub.castShadow = true;
                w.add(hub);

                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.065, 0.065), wood);
                    // Raios no mesmo plano X/Y da roda.
                    sp.rotation.z = a;
                    sp.position.x = Math.cos(a) * 0.31;
                    sp.position.y = Math.sin(a) * 0.31;
                    sp.castShadow = true;
                    w.add(sp);
                }
                return w;
            };
            cart.add(makeWheel(-1.05, 0.78, -1.05));
            cart.add(makeWheel(-1.05, 0.78, 1.05));
            cart.add(makeWheel(1.05, 0.78, -1.05));
            cart.add(makeWheel(1.05, 0.78, 1.05));

            const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.25, 12), iron);
            axle.rotation.x = Math.PI / 2; axle.position.set(0, 0.76, 0); axle.castShadow = true; cart.add(axle);

            // Caixa de carga e detalhes metálicos.
            const crate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 0.9), darkWood);
            crate.position.set(0.65, 1.18, 0); crate.castShadow = true; cart.add(crate);
            for (const z of [-0.47, 0.47]) {
                const band = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.06), iron);
                band.position.set(0.65, 1.18, z); cart.add(band);
            }

            this.scene.add(cart);
            this._groups.push(cart);
            this.colliders.push({ x: cx, z: cz, radius: 2.8, type: 'carriage_repaired' });
            this.carriagePos = { x: cx, z: cz, y: cy };
        }

        _setupAtmosphere() {
            if (this.cfg.enableFog) {
                this.scene.fog = new THREE.Fog(0x1a1a2e, 120, 300);
            }

            // Luz ambiente suave
            if (this.scene.children.some(c => c instanceof THREE.AmbientLight)) return;

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            this.scene.add(ambientLight);
        }

        // =====================================================================
        // GERAÇÃO DE TEXTURAS PROCEDURAIS
        // =====================================================================
        _createStoneTexture(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base de cor
            ctx.fillStyle = '#666666';
            ctx.fillRect(0, 0, size, size);

            // Ruído de pedra
            const imageData = ctx.getImageData(0, 0, size, size);
            const data = imageData.data;

            for (let i = 0; i < data.length; i += 4) {
                const noise = Math.random() * 60 - 30;
                data[i] += noise;
                data[i + 1] += noise;
                data[i + 2] += noise;
            }

            ctx.putImageData(imageData, 0, 0);

            const texture = new THREE.CanvasTexture(canvas);
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            return texture;
        }

        _createWoodTexture(size) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Padrão de anéis de madeira
            for (let i = 0; i < size; i++) {
                const intensity = Math.abs(Math.sin(i * 0.02)) * 50;
                ctx.fillStyle = `rgb(${90 + intensity}, ${58 + intensity * 0.7}, ${26 + intensity * 0.5})`;
                ctx.fillRect(0, i, size, 1);
            }

            const texture = new THREE.CanvasTexture(canvas);
            texture.magFilter = THREE.LinearFilter;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            return texture;
        }

        update(time) {
            this._portalTime = time;

            // Água animada
            if (this._waterUniforms) {
                this._waterUniforms.time.value = time;
            }

            // Baús — brilho e flutuação
            for (let i = 0; i < this.chests.length; i++) {
                const ch = this.chests[i];
                if (!ch || !ch.userData || ch.userData.opened) continue;
                const ud = ch.userData;
                const base = ud.baseY != null ? ud.baseY : ch.position.y;
                ch.position.y = base + Math.sin(time * 1.6 + i) * 0.04;
                if (ud.glow && ud.glow.material) {
                    ud.glow.material.emissiveIntensity = 0.45 + Math.sin(time * 3 + i) * 0.35;
                    ud.glow.rotation.y = time * 1.2;
                }
                if (ud.lidPivot) {
                    ud.lidPivot.rotation.x = -0.08 + Math.sin(time * 1.4 + i) * 0.04;
                }
            }

            // Cristais e partes da carruagem girando / flutuando
            for (const c of this.collectibles) {
                if (!c.userData) continue;
                if (c.userData.type === 'crystal') {
                    c.rotation.y = time * 0.8;
                    const base = c.userData.baseY != null
                        ? c.userData.baseY
                        : this.getTerrainHeight(c.position.x, c.position.z);
                    c.position.y = base + Math.sin(time * 2.0 + c.position.x * 0.1) * 0.12;
                } else if (c.userData.type === 'carriage_part') {
                    c.rotation.y = time * 0.9;
                    const base = c.userData.baseY != null
                        ? c.userData.baseY
                        : this.getTerrainHeight(c.position.x, c.position.z) + 0.55;
                    c.position.y = base + Math.sin(time * 2.5 + c.position.x) * 0.2;
                }
            }
        }

        /** Coleta item próximo */
        tryCollect(playerPos, radius = 2.2) {
            for (let i = this.collectibles.length - 1; i >= 0; i--) {
                const mesh = this.collectibles[i];
                const dx = mesh.position.x - playerPos.x;
                const dz = mesh.position.z - playerPos.z;
                if (dx * dx + dz * dz < radius * radius) {
                    this.scene.remove(mesh);
                    this.collectibles.splice(i, 1);
                    return mesh.userData || { type: 'crystal', value: 1 };
                }
            }
            return null;
        }

        getBounds() {
            const b = this.cfg.bound;
            return { min: -b, max: b };
        }

        /** Portal removido — retorno pela saída do portão da muralha */
        isOnReturnPortal(x, z) {
            return false;
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
                g.traverse(disposeMesh);
            }
            this._groups.length = 0;
            for (const c of this.collectibles) {
                this.scene.remove(c);
                disposeMesh(c);
            }
            this.collectibles.length = 0;
            this.chests.length = 0;
            this.colliders.length = 0;
            this._built = false;
        }
    }

    global.WorldMap2 = WorldMap2;

})(typeof window !== 'undefined' ? window : globalThis);
