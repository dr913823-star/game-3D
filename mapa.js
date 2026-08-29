/**
 * mapa.js — Mundo procedural profissional
 * Terreno, água, vila, vegetação instanciada, barcos decorativos, colecionáveis e colisões
 *
 * Depende de: THREE (global)
 * API pública:
 *   const world = new WorldMap(scene, options);
 *   await world.build(onProgress);
 *   world.getTerrainHeight(x, z);
 *   world.update(time);
 *   world.dispose();
 */

(function (global) {
    'use strict';

    const DEFAULTS = {
        mapSize: 320,
        segments: 72,
        waterLevel: 0.5,
        treeCount: 110,
        rockCount: 55,
        boatCount: 6,
        villageRadius: 30,
        /**
         * Muro perimetral nas bordas do mapa (substitui as montanhas).
         * NÃO cerca só a vila — envolve quase todo o mundo jogável.
         */
        wallRadius: 130,
        wallHeight: 12,
        wallThickness: 3.6,
        wallSegments: 88,
        gateWidth: 16,   // abertura do portão (metros ao longo do arco)
        gateAngle: Math.PI / 2,  // +X (leste) — Vale Selvagem (mapa2)
        // Segundo portão → Castelo Abandonado (mapa3)
        // Antes: Math.PI (norte) ficava dentro da água do rio procedural.
        // 2.2 rad ≈ nordeste — terreno seco (altura ~3m acima da água).
        gate2Width: 18,
        gate2Angle: 2.2,
        bound: 145
    };

    // Dummy reutilizável para InstancedMesh (evita GC)
    const _dummy = new THREE.Object3D();

    class WorldMap {
        /**
         * @param {THREE.Scene} scene
         * @param {object} [options]
         */
        constructor(scene, options = {}) {
            if (!scene) throw new Error('[WorldMap] scene é obrigatória');

            this.scene = scene;
            this.cfg = Object.assign({}, DEFAULTS, options);

            this.colliders = [];
            this.collectibles = [];
            this.chests = [];
            this.boats = [];      // barcos decorativos (sem colisão / interação)

            this.terrainMesh = null;
            this.waterMesh = null;
            this._instanced = []; // meshes instanciados para dispose
            this._groups = [];    // grupos (casas, baús) para dispose

            this._built = false;
        }

        // =====================================================================
        // ALTURA DO TERRENO (procedural, determinístico)
        // =====================================================================
        getTerrainHeight(x, z) {
            const dist = Math.hypot(x, z);
            // Área plana da vila (dentro do muro)
            if (dist < this.cfg.villageRadius) return 1.15;

            // Rio sinuoso
            const riverX = x - Math.sin(z * 0.03) * 18;
            const distRiver = Math.abs(riverX - 38);
            const riverF = distRiver < 14 ? Math.pow(distRiver / 14, 2) : 1;

            // Colinas suaves (sem montanhas altas nas bordas)
            let h = Math.sin(x * 0.022) * 2.4 + Math.cos(z * 0.022) * 2.4;
            h += Math.sin(x * 0.055 + z * 0.055) * 1.2;

            return Math.max(-1.8, h * riverF + 1);
        }

        /**
         * Resolve colisão circular contra colliders do mundo (cerca, casas, etc.).
         * @returns {{x:number,z:number}} posição corrigida
         */
        resolveRadius(x, z, bodyR = 0.6) {
            const colliders = this.colliders;
            if (!colliders || !colliders.length) return { x, z };
            for (let i = 0, len = colliders.length; i < len; i++) {
                const c = colliders[i];
                if (c.type === 'teleport') continue;
                if (c.halfW != null && c.halfD != null) {
                    const nearestX = Math.max(c.x - c.halfW, Math.min(x, c.x + c.halfW));
                    const nearestZ = Math.max(c.z - c.halfD, Math.min(z, c.z + c.halfD));
                    let dx = x - nearestX;
                    let dz = z - nearestZ;
                    let dist = Math.hypot(dx, dz);
                    if (dist < bodyR) {
                        if (dist < 0.001) {
                            const penX = c.halfW + bodyR - Math.abs(x - c.x);
                            const penZ = c.halfD + bodyR - Math.abs(z - c.z);
                            if (penX < penZ) x = c.x + Math.sign(x - c.x || 1) * (c.halfW + bodyR);
                            else z = c.z + Math.sign(z - c.z || 1) * (c.halfD + bodyR);
                        } else {
                            const o = bodyR - dist;
                            x += (dx / dist) * o;
                            z += (dz / dist) * o;
                        }
                    }
                    continue;
                }
                if (c.radius == null) continue;
                const dx = x - c.x;
                const dz = z - c.z;
                const dist = Math.hypot(dx, dz);
                const minD = bodyR + c.radius;
                if (dist < minD && dist > 0.0001) {
                    const o = minD - dist;
                    x += (dx / dist) * o;
                    z += (dz / dist) * o;
                } else if (dist <= 0.0001) {
                    x += minD;
                }
            }
            return { x, z };
        }

        // =====================================================================
        // BUILD PIPELINE ASSÍNCRONO
        // =====================================================================
        /**
         * Constrói o mundo em etapas (ideal para loading bar).
         * @param {function(number, string): Promise|void} [onProgress] - (percent, message)
         */
        async build(onProgress) {
            if (this._built) {
                console.warn('[WorldMap] já construído');
                return;
            }

            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(10, 'Gerando malha de terreno...');
            await this._buildTerrain();

            await progress(28, 'Construindo vila...');
            if (typeof VillageBuilder !== 'undefined') {
                this._village = new VillageBuilder(this.scene, this);
                await this._village.build(progress);
            } else {
                await this._buildVillage();
            }

            await progress(38, 'Erguendo muralha das bordas...');
            await this._buildPerimeterWalls();

            await progress(52, 'Plantando vegetação...');
            if (typeof TreeSystem !== 'undefined') {
                this._trees = new TreeSystem(this.scene, this);
                await this._trees.build(progress);
            } else {
                await this._buildTrees();
            }

            await progress(65, 'Gerando rochas...');
            await this._buildRocks();

            await progress(70, 'Colocando barcos na água...');
            if (typeof BoatSystem !== 'undefined') {
                this._boats = new BoatSystem(this.scene, this);
                await this._boats.build(progress);
            } else {
                await this._buildBoats();
            }

            await progress(72, 'Erguendo postes de luz...');
            if (typeof LampPostSystem !== 'undefined') {
                this._lamps = new LampPostSystem(this.scene, this);
                await this._lamps.build(progress);
            }

            await progress(75, 'Colocando cristais e baús...');
            this._initCollectibles();

            this._built = true;
            await progress(80, 'Mapa pronto');
        }

        // --- Terreno + água ---
        async _buildTerrain() {
            const { mapSize, segments, waterLevel } = this.cfg;

            const geo = new THREE.PlaneGeometry(mapSize, mapSize, segments, segments);
            geo.rotateX(-Math.PI / 2);

            const pos = geo.attributes.position;
            const colors = new Float32Array(pos.count * 3);

            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                const y = this.getTerrainHeight(x, z);
                pos.setY(i, y);

                const ci = i * 3;
                const distXZ = Math.hypot(x, z);
                if (distXZ < this.cfg.villageRadius) {
                    // Solo de vila (terra batida / pedra) — base sob o piso de paralelepípedos
                    const n = Math.sin(x * 0.5 + z * 0.4) * 0.04;
                    colors[ci] = 0.42 + n;
                    colors[ci + 1] = 0.36 + n * 0.8;
                    colors[ci + 2] = 0.28 + n * 0.5;
                } else if (y < 0.85) {
                    // Areia / leito do rio
                    colors[ci] = 0.82; colors[ci + 1] = 0.73; colors[ci + 2] = 0.52;
                } else if (y < 7.5) {
                    // Grama com variação
                    const n = Math.sin(x * 0.4) * 0.035;
                    colors[ci] = 0.2 + n; colors[ci + 1] = 0.48 + n; colors[ci + 2] = 0.17;
                } else if (y < 15) {
                    // Rocha
                    colors[ci] = 0.44; colors[ci + 1] = 0.37; colors[ci + 2] = 0.29;
                } else {
                    // Neve
                    colors[ci] = 0.9; colors[ci + 1] = 0.92; colors[ci + 2] = 0.95;
                }
            }

            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geo.computeVertexNormals();

            this.terrainMesh = new THREE.Mesh(
                geo,
                new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.88,
                    metalness: 0.04,
                    flatShading: true
                })
            );
            this.terrainMesh.receiveShadow = true;
            this.terrainMesh.name = 'terrain';
            this.scene.add(this.terrainMesh);

            // Água
            const wGeo = new THREE.PlaneGeometry(mapSize, mapSize);
            wGeo.rotateX(-Math.PI / 2);
            this.waterMesh = new THREE.Mesh(
                wGeo,
                new THREE.MeshStandardMaterial({
                    color: 0x1e88e5,
                    transparent: true,
                    opacity: 0.72,
                    roughness: 0.12,
                    metalness: 0.75
                })
            );
            this.waterMesh.position.y = waterLevel;
            this.waterMesh.name = 'water';
            this.scene.add(this.waterMesh);
        }

        // --- Vila ---
        async _buildVillage() {
            const houses = [
                { x: -14, z: -9, rot: 0.2 },
                { x: 16, z: -13, rot: -0.35 },
                { x: -11, z: 16, rot: 1.15 }
            ];

            for (const h of houses) {
                this._createHouse(h.x, h.z, h.rot);
            }

            // Poço central
            const well = new THREE.Mesh(
                new THREE.CylinderGeometry(1.8, 1.8, 1.1, 8),
                new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.8 })
            );
            well.position.set(0, this.getTerrainHeight(0, 0) + 0.55, 0);
            well.castShadow = true;
            well.name = 'well';
            this.scene.add(well);
            this.colliders.push({ x: 0, z: 0, radius: 2, type: 'well' });
        }

        _createHouse(x, z, rotation) {
            const group = new THREE.Group();
            group.position.set(x, this.getTerrainHeight(x, z), z);
            group.rotation.y = rotation;
            group.name = 'house';

            const base = new THREE.Mesh(
                new THREE.BoxGeometry(6.5, 4.2, 6.5),
                new THREE.MeshStandardMaterial({ color: 0x6e4e37, roughness: 0.9 })
            );
            base.position.y = 2.1;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(5.2, 3.2, 4),
                new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.65 })
            );
            roof.position.y = 5.9;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            group.add(roof);

            this.scene.add(group);
            this._groups.push(group);
            this.colliders.push({ x, z, radius: 4.2, type: 'house' });
        }


        /**
         * Placa legível no portão (destino).
         * @param {THREE.Group} parent
         * @param {{text,color,angle,radius,y,inward}} opts
         */
        _addGateSign(parent, opts) {
            const text = String(opts.text || '');
            const color = opts.color || '#fbbf24';
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            // Fundo
            ctx.fillStyle = 'rgba(12,10,8,0.92)';
            ctx.fillRect(0, 0, 512, 128);
            // Borda
            ctx.strokeStyle = color;
            ctx.lineWidth = 6;
            ctx.strokeRect(8, 8, 496, 112);
            // Título pequeno
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DESTINO', 256, 36);
            // Nome do local
            ctx.font = 'bold 42px sans-serif';
            ctx.fillStyle = color;
            ctx.fillText(text, 256, 82);

            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearFilter;
            const mat = new THREE.MeshBasicMaterial({
                map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), mat);

            const inward = opts.inward !== false;
            const offset = inward ? -3.2 : 3.2;
            const R = opts.radius || 130;
            const a = opts.angle || 0;
            mesh.position.set(
                Math.sin(a) * (R + offset),
                opts.y != null ? opts.y : 10,
                Math.cos(a) * (R + offset)
            );
            // Face para quem se aproxima do portão
            mesh.rotation.y = a + (inward ? Math.PI : 0);
            mesh.renderOrder = 5;
            parent.add(mesh);
            return mesh;
        }

        // --- Muralha perimetral — topo alinhado em todas as seções ---
        async _buildPerimeterWalls() {
            const {
                wallRadius: R,
                wallHeight: H,
                wallThickness: T,
                wallSegments,
                gateWidth,
                gateAngle,
                gate2Width,
                gate2Angle
            } = this.cfg;

            const segments = Math.max(wallSegments || 64, 80);
            const gw = Math.max(0, gateWidth || 0);
            const gateHalfAngle = gw > 0.5 ? (gw * 0.5) / R : 0;
            const gw2 = Math.max(0, gate2Width || 0);
            const gate2HalfAngle = gw2 > 0.5 ? (gw2 * 0.5) / R : 0;

            this.cfg.gateHalfAngle = gateHalfAngle;
            this.cfg.gate2HalfAngle = gate2HalfAngle;
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
            // Madeira mais escura / pedra para o portão do castelo
            const castleWoodMat = new THREE.MeshStandardMaterial({
                color: 0x3f3f46,
                roughness: 0.85,
                metalness: 0.08
            });
            const castleTrimMat = new THREE.MeshStandardMaterial({
                color: 0x52525b,
                roughness: 0.88,
                metalness: 0.12
            });

            const wallGroup = new THREE.Group();
            wallGroup.name = 'perimeter_wall';

            const arcLen = (2 * Math.PI * R) / segments;
            const segLen = arcLen * 1.28;

            const normAngle = (a) => {
                while (a > Math.PI) a -= Math.PI * 2;
                while (a < -Math.PI) a += Math.PI * 2;
                return a;
            };
            const inAnyGate = (amid) => {
                let da1 = normAngle(amid - gateAngle);
                if (Math.abs(da1) < gateHalfAngle) return 1;
                if (gate2HalfAngle > 0.001) {
                    let da2 = normAngle(amid - gate2Angle);
                    if (Math.abs(da2) < gate2HalfAngle) return 2;
                }
                return 0;
            };

            // Amostrar terreno no anel → topo único alinhado
            let maxGround = -Infinity;
            const samples = [];
            for (let i = 0; i < segments; i++) {
                const amid = ((i + 0.5) / segments) * Math.PI * 2;
                const gateId = inAnyGate(amid);
                const x = Math.sin(amid) * R;
                const z = Math.cos(amid) * R;
                const gY = this.getTerrainHeight(x, z);
                samples.push({ i, amid, x, z, gY, inGate: gateId !== 0, gateId });
                if (!gateId && gY > maxGround) maxGround = gY;
            }
            if (!isFinite(maxGround)) maxGround = 2;

            const crestY = maxGround + H;
            const capY = crestY + 0.22;
            const merlonY = crestY + 0.95;

            for (const s of samples) {
                if (s.inGate) continue;

                const { x, z, gY: groundY, amid: rotY, i } = s;
                const embed = 0.8;
                const localH = Math.max(H * 0.55, crestY - groundY + embed);
                const blockCenterY = groundY - embed + localH * 0.5;

                const block = new THREE.Mesh(new THREE.BoxGeometry(segLen, localH, T), wallMat);
                block.position.set(x, blockCenterY, z);
                block.rotation.y = rotY;
                block.castShadow = true;
                block.receiveShadow = true;
                wallGroup.add(block);

                const base = new THREE.Mesh(
                    new THREE.BoxGeometry(segLen * 1.02, 1.3, T + 1.5),
                    trimMat
                );
                base.position.set(x, groundY + 0.55, z);
                base.rotation.y = rotY;
                base.castShadow = true;
                base.receiveShadow = true;
                wallGroup.add(base);

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
                if (!inAnyGate(a2)) {
                    this.colliders.push({
                        x: Math.sin(a2) * R,
                        z: Math.cos(a2) * R,
                        radius: Math.max(T * 0.9, arcLen * 0.65),
                        type: 'wall'
                    });
                }
            }

            // Constrói portão (pilares, portas, lintel, tochas)
            const buildGate = (gAngle, gHalf, gWidth, opts = {}) => {
                if (gHalf < 0.001) return;
                const trim = opts.trimMat || trimMat;
                const wood = opts.woodMat || woodMat;
                const torchColor = opts.torchColor || 0xffaa33;
                const torchEmissive = opts.torchEmissive || 0xff6600;
                const labelText = opts.labelText || null;

                for (const side of [-1, 1]) {
                    const a = gAngle + side * gHalf;
                    const gx = Math.sin(a) * R;
                    const gz = Math.cos(a) * R;
                    const gy = this.getTerrainHeight(gx, gz);

                    const pillarTop = crestY + 3.2;
                    const pillarH = pillarTop - gy + 0.4;
                    const pillar = new THREE.Mesh(
                        new THREE.BoxGeometry(T * 1.9, pillarH, T * 1.9),
                        trim
                    );
                    pillar.position.set(gx, gy - 0.2 + pillarH * 0.5, gz);
                    pillar.castShadow = true;
                    wallGroup.add(pillar);

                    const doorH = Math.min(H * 0.85, crestY - gy - 1.2);
                    const door = new THREE.Mesh(
                        new THREE.BoxGeometry(0.35, Math.max(3, doorH), gWidth * 0.32),
                        wood
                    );
                    const openOut = 1.4;
                    const along = side * (gWidth * 0.18);
                    door.position.set(
                        Math.sin(gAngle) * (R - openOut) + Math.cos(gAngle) * along,
                        gy + Math.max(3, doorH) * 0.5,
                        Math.cos(gAngle) * (R - openOut) - Math.sin(gAngle) * along
                    );
                    door.rotation.y = gAngle + side * 1.15;
                    door.castShadow = true;
                    wallGroup.add(door);

                    this.colliders.push({
                        x: gx, z: gz, radius: T * 1.25, type: 'wall_pillar'
                    });
                }

                const ax = Math.sin(gAngle) * R;
                const az = Math.cos(gAngle) * R;
                const lintel = new THREE.Mesh(
                    new THREE.BoxGeometry(gWidth + 4, 1.1, T * 1.55),
                    trim
                );
                lintel.position.set(ax, crestY + 1.0, az);
                lintel.rotation.y = gAngle;
                lintel.castShadow = true;
                wallGroup.add(lintel);

                for (const side of [-1, 1]) {
                    const a = gAngle + side * gHalf;
                    const tx = Math.sin(a) * R;
                    const tz = Math.cos(a) * R;
                    const torch = new THREE.Mesh(
                        new THREE.SphereGeometry(0.3, 8, 6),
                        new THREE.MeshStandardMaterial({
                            color: torchColor,
                            emissive: torchEmissive,
                            emissiveIntensity: 1.0
                        })
                    );
                    torch.position.set(tx, crestY - 1.2, tz);
                    wallGroup.add(torch);
                }

                // Placas de destino (dentro e fora do portão)
                if (labelText) {
                    this._addGateSign(wallGroup, {
                        text: labelText,
                        color: opts.labelColor || '#fbbf24',
                        angle: gAngle,
                        radius: R,
                        y: crestY + 2.6,
                        inward: true
                    });
                    this._addGateSign(wallGroup, {
                        text: labelText,
                        color: opts.labelColor || '#fbbf24',
                        angle: gAngle,
                        radius: R,
                        y: crestY + 2.6,
                        inward: false
                    });
                }
            };

            // Portão leste → Vale Selvagem
            buildGate(gateAngle, gateHalfAngle, gw, {
                labelText: 'VALE SELVAGEM',
                labelColor: '#fbbf24'
            });

            // Portão nordeste → Castelo Abandonado
            buildGate(gate2Angle, gate2HalfAngle, gw2, {
                trimMat: castleTrimMat,
                woodMat: castleWoodMat,
                torchColor: 0xa78bfa,
                torchEmissive: 0x7c3aed,
                labelText: 'CASTELO ABANDONADO',
                labelColor: '#c4b5fd'
            });

            this.scene.add(wallGroup);
            this._groups.push(wallGroup);
        }

        // --- Árvores instanciadas ---
        async _buildTrees() {
            const count = this.cfg.treeCount;
            const waterLevel = this.cfg.waterLevel;

            const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 2.8, 5);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
            const leavesGeo = new THREE.ConeGeometry(2.3, 5.5, 5);
            const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.85 });

            const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
            const leavesInst = new THREE.InstancedMesh(leavesGeo, leavesMat, count);
            trunkInst.castShadow = true;
            leavesInst.castShadow = true;
            trunkInst.name = 'trees_trunk';
            leavesInst.name = 'trees_leaves';

            let n = 0;
            const attempts = count * 3;

            const villageClear = this.cfg.villageRadius + 2;
            const wallInner = this.cfg.wallRadius - 6;
            const wallOuter = this.cfg.wallRadius + 8;
            for (let i = 0; i < attempts && n < count; i++) {
                const rx = (Math.random() - 0.5) * 260;
                const rz = (Math.random() - 0.5) * 260;
                const dist = Math.hypot(rx, rz);
                // Livre na vila e na faixa do muro perimetral
                if (dist < villageClear) continue;
                if (dist > wallInner && dist < wallOuter) continue;

                const ry = this.getTerrainHeight(rx, rz);
                if (ry < waterLevel + 0.25) continue;

                const s = 0.65 + Math.random() * 0.55;

                _dummy.position.set(rx, ry + 1.4 * s, rz);
                _dummy.scale.set(s, s, s);
                _dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
                _dummy.updateMatrix();
                trunkInst.setMatrixAt(n, _dummy.matrix);

                _dummy.position.y = ry + 4.2 * s;
                _dummy.updateMatrix();
                leavesInst.setMatrixAt(n, _dummy.matrix);

                this.colliders.push({ x: rx, z: rz, radius: 0.9, type: 'tree' });
                n++;
            }

            trunkInst.count = n;
            leavesInst.count = n;
            this.scene.add(trunkInst, leavesInst);
            this._instanced.push(trunkInst, leavesInst);
        }

        // --- Rochas instanciadas ---
        async _buildRocks() {
            const count = this.cfg.rockCount;
            const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
            const rockMat = new THREE.MeshStandardMaterial({ color: 0x616161, roughness: 0.92 });
            const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, count);
            rockInst.castShadow = true;
            rockInst.name = 'rocks';

            let n = 0;
            const attempts = count * 2.5;

            for (let i = 0; i < attempts && n < count; i++) {
                const rx = (Math.random() - 0.5) * 270;
                const rz = (Math.random() - 0.5) * 270;
                const dist = Math.hypot(rx, rz);
                if (dist < this.cfg.villageRadius + 2) continue;
                if (dist > this.cfg.wallRadius - 6 && dist < this.cfg.wallRadius + 8) continue;

                const ry = this.getTerrainHeight(rx, rz);
                const s = 0.7 + Math.random() * 1.4;

                _dummy.position.set(rx, ry + s * 0.35, rz);
                _dummy.scale.set(s, s * 0.7, s);
                _dummy.rotation.set(Math.random(), Math.random(), Math.random());
                _dummy.updateMatrix();
                rockInst.setMatrixAt(n, _dummy.matrix);

                this.colliders.push({ x: rx, z: rz, radius: s * 0.75, type: 'rock' });
                n++;
            }

            rockInst.count = n;
            this.scene.add(rockInst);
            this._instanced.push(rockInst);
        }

        // --- Barcos decorativos na água (sem funcionalidade / colisão) ---
        async _buildBoats() {
            const waterLevel = this.cfg.waterLevel;

            // Posições em áreas baixas do terreno (lagos / água visível),
            // onde getTerrainHeight fica bem abaixo do waterLevel.
            const boatSpots = [
                { x: -87.6, z: -81.6, rot: 0.4 },
                { x: -46.7, z:  98.8, rot: -0.7 },
                { x: -53.4, z: -88.4, rot: 1.1 },
                { x: -12.6, z: 102.3, rot: -0.3 },
                { x: -21.7, z: -109.2, rot: 0.85 },
                { x: -82.2, z:  59.8, rot: -1.2 },
                { x: -65.8, z: -62.4, rot: 0.2 },
                { x: -80.0, z:  88.8, rot: -0.55 }
            ];

            const maxBoats = Math.min(this.cfg.boatCount || 6, boatSpots.length);

            for (let i = 0; i < maxBoats; i++) {
                const spot = boatSpots[i];
                const h = this.getTerrainHeight(spot.x, spot.z);

                // Só coloca se realmente estiver em água (terreno abaixo do nível)
                if (h > waterLevel + 0.15) continue;

                const boat = this._createBoatMesh();
                const s = 1.75 + Math.random() * 0.55;
                boat.scale.set(s, s, s);

                // Flutua na superfície da água
                const baseY = waterLevel + 0.35;
                boat.position.set(spot.x, baseY, spot.z);
                boat.rotation.y = spot.rot + (Math.random() - 0.5) * 0.25;
                boat.name = 'boat_' + i;
                boat.userData = {
                    baseY: baseY,
                    phase: Math.random() * Math.PI * 2
                };

                this.scene.add(boat);
                this.boats.push(boat);
                this._groups.push(boat);
            }
        }

        /**
         * Cria um barco low-poly simples (casco + mastro + vela opcional).
         * @returns {THREE.Group}
         */
        _createBoatMesh() {
            const group = new THREE.Group();

            const woodMat = new THREE.MeshStandardMaterial({
                color: 0x5d4037,
                roughness: 0.9,
                metalness: 0.05
            });
            const darkWoodMat = new THREE.MeshStandardMaterial({
                color: 0x3e2723,
                roughness: 0.85
            });
            const sailMat = new THREE.MeshStandardMaterial({
                color: 0xeceff1,
                roughness: 0.7,
                side: THREE.DoubleSide
            });

            // Casco principal (alongado)
            const hull = new THREE.Mesh(
                new THREE.BoxGeometry(3.4, 0.55, 1.35),
                woodMat
            );
            hull.position.y = 0.15;
            hull.castShadow = true;
            group.add(hull);

            // Proa e popa (pontas inclinadas)
            const bow = new THREE.Mesh(
                new THREE.BoxGeometry(0.9, 0.45, 1.1),
                woodMat
            );
            bow.position.set(1.9, 0.12, 0);
            bow.rotation.z = -0.35;
            bow.castShadow = true;
            group.add(bow);

            const stern = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.4, 1.15),
                woodMat
            );
            stern.position.set(-1.85, 0.1, 0);
            stern.rotation.z = 0.25;
            stern.castShadow = true;
            group.add(stern);

            // Laterais um pouco mais altas
            const sideL = new THREE.Mesh(
                new THREE.BoxGeometry(3.0, 0.35, 0.12),
                darkWoodMat
            );
            sideL.position.set(0, 0.38, 0.62);
            group.add(sideL);

            const sideR = sideL.clone();
            sideR.position.z = -0.62;
            group.add(sideR);

            // Mastro
            const mast = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 3.2, 5),
                darkWoodMat
            );
            mast.position.set(-0.3, 1.7, 0);
            mast.castShadow = true;
            group.add(mast);

            // Vela (triângulo simples)
            const sailGeo = new THREE.BufferGeometry();
            const sailVerts = new Float32Array([
                0, 0, 0,
                0, 2.4, 0,
                1.6, 0.9, 0
            ]);
            sailGeo.setAttribute('position', new THREE.BufferAttribute(sailVerts, 3));
            sailGeo.computeVertexNormals();
            const sail = new THREE.Mesh(sailGeo, sailMat);
            sail.position.set(-0.25, 0.6, 0.05);
            sail.rotation.y = 0.15;
            group.add(sail);

            // Banco interno decorativo
            const bench = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.18, 1.0),
                darkWoodMat
            );
            bench.position.set(0.6, 0.35, 0);
            group.add(bench);

            return group;
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

        // --- Cristais e baús ---
        _initCollectibles() {
            const crystalGeo = new THREE.OctahedronGeometry(0.75, 0);
            const crystalMat = new THREE.MeshStandardMaterial({
                color: 0x00f0ff,
                emissive: 0x00aaff,
                emissiveIntensity: 0.55,
                roughness: 0.2
            });

            const coords = [
                [42, 22], [-52, 38], [65, -55], [-38, -65], [28, 70]
            ];

            coords.forEach((pt, i) => {
                const mesh = new THREE.Mesh(crystalGeo, crystalMat);
                mesh.position.set(pt[0], this.getTerrainHeight(pt[0], pt[1]) + 1.1, pt[1]);
                mesh.userData = {
                    id: 'crystal_' + i,
                    type: 'crystal',
                    name: 'Cristal Místico'
                };
                mesh.name = 'crystal_' + i;
                this.scene.add(mesh);
                this.collectibles.push(mesh);
            });

            // Baús de tesouro detalhados
            const chestSpots = [
                { x: 14, z: -78, id: 'ancient_chest' },
                { x: -48, z: 55, id: 'forest_chest' }
            ];
            for (const spot of chestSpots) {
                const chest = this._createTreasureChest(1.05);
                const gy = this.getTerrainHeight(spot.x, spot.z);
                chest.position.set(spot.x, gy, spot.z);
                chest.rotation.y = Math.random() * Math.PI * 2;
                chest.name = spot.id;
                chest.userData.id = spot.id;
                chest.userData.type = 'chest';
                chest.userData.opened = false;
                chest.userData.baseY = gy;
                this.scene.add(chest);
                this.chests.push(chest);
                this._groups.push(chest);
                this.colliders.push({ x: spot.x, z: spot.z, radius: 1.4, type: 'chest' });
            }
        }

        // =====================================================================
        // RUNTIME
        // =====================================================================
        /**
         * Atualiza elementos animados do mapa (água, etc.)
         * @param {number} timeSec - tempo em segundos (ex: performance.now()*0.001)
         */
        update(timeSec) {
            if (this.waterMesh) {
                this.waterMesh.position.y =
                    this.cfg.waterLevel + Math.sin(timeSec * 0.8) * 0.08;
            }

            // Barcos (BoatSystem ou fallback interno)
            if (this._boats && typeof this._boats.update === 'function') {
                this._boats.update(timeSec);
            } else {
                for (let i = 0; i < this.boats.length; i++) {
                    const b = this.boats[i];
                    if (!b || !b.userData) continue;
                    const phase = b.userData.phase || 0;
                    const baseY = b.userData.baseY || (this.cfg.waterLevel + 0.18);
                    b.position.y = baseY + Math.sin(timeSec * 0.8 + phase) * 0.07;
                    b.rotation.z = Math.sin(timeSec * 0.55 + phase) * 0.04;
                    b.rotation.x = Math.sin(timeSec * 0.4 + phase * 1.3) * 0.025;
                }
            }

            // Baús — brilho e flutuação suave
            for (let i = 0; i < this.chests.length; i++) {
                const c = this.chests[i];
                if (!c || !c.userData) continue;
                const ud = c.userData;
                if (ud.opened) continue;
                const base = ud.baseY != null ? ud.baseY : c.position.y;
                c.position.y = base + Math.sin(timeSec * 1.6 + i) * 0.04;
                if (ud.glow && ud.glow.material) {
                    ud.glow.material.emissiveIntensity = 0.45 + Math.sin(timeSec * 3 + i) * 0.35;
                    ud.glow.rotation.y = timeSec * 1.2;
                }
                if (ud.lidPivot && !ud.opened) {
                    ud.lidPivot.rotation.x = -0.08 + Math.sin(timeSec * 1.4 + i) * 0.04;
                }
            }

            // Postes de luz (flicker noturno)
            if (this._lamps && typeof this._lamps.update === 'function') {
                this._lamps.update(timeSec);
            }

            // Cristais girando levemente
            for (let i = 0; i < this.collectibles.length; i++) {
                const c = this.collectibles[i];
                if (c && c.rotation) {
                    c.rotation.y += 0.015;
                    c.position.y =
                        this.getTerrainHeight(c.position.x, c.position.z) +
                        1.1 +
                        Math.sin(timeSec * 2 + i) * 0.08;
                }
            }
        }

        /**
         * Remove um colecionável da cena e da lista.
         * @param {THREE.Object3D} mesh
         * @returns {boolean}
         */
        removeCollectible(mesh) {
            const idx = this.collectibles.indexOf(mesh);
            if (idx === -1) return false;
            this.scene.remove(mesh);
            this.collectibles.splice(idx, 1);
            return true;
        }

        /**
         * Limites do mapa.
         * @returns {{min: number, max: number}}
         */
        getBounds() {
            const b = this.cfg.bound;
            return { min: -b, max: b };
        }

        // =====================================================================
        // DISPOSE
        // =====================================================================
        dispose() {
            const disposeMesh = (obj) => {
                if (!obj) return;
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
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
            this.boats.length = 0;
            this.colliders.length = 0;

            if (this._boats && typeof this._boats.dispose === 'function') {
                this._boats.dispose();
                this._boats = null;
            }
            if (this._lamps && typeof this._lamps.dispose === 'function') {
                this._lamps.dispose();
                this._lamps = null;
            }
            if (this._village && typeof this._village.dispose === 'function') {
                this._village.dispose();
                this._village = null;
            }
            if (this._trees && typeof this._trees.dispose === 'function') {
                this._trees.dispose();
                this._trees = null;
            }

            this._built = false;
        }
    }

    // Export global
    global.WorldMap = WorldMap;

})(typeof window !== 'undefined' ? window : globalThis);
