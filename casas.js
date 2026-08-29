/**
 * casas.js — Casas da vila com visual melhorado
 * Estrutura: base, telhado, porta, janelas, chaminé
 *
 * Depende de: THREE (global)
 * API:
 *   const village = new VillageBuilder(scene, world, options);
 *   await village.build(onProgress);
 *   village.dispose();
 */

(function (global) {
    'use strict';

    // Casas residenciais DENTRO da cerca da vila (cerca r=27.5)
    // Raio ~22, escala 0.88 → borda ~26.5 (não atravessa a cerca)
    // Formato: [x, z, rotationY] — porta virada para o centro
    const DEFAULT_HOUSES = [
        [ 18.0, -12.6, -0.96],  // sudeste interno
        [  7.5, -20.7, -0.35],  // sul-leste
        [ -7.5, -20.7,  0.35],  // sul-oeste
        [-18.0, -12.6,  0.96]   // sudoeste interno
    ];

    class VillageBuilder {
        /**
         * @param {THREE.Scene} scene
         * @param {object} world - WorldMap
         * @param {object} [options]
         * @param {Array}  [options.houses]
         */
        constructor(scene, world, options = {}) {
            if (!scene) throw new Error('[VillageBuilder] scene obrigatória');
            if (!world) throw new Error('[VillageBuilder] world obrigatório');

            this.scene = scene;
            this.world = world;
            this.houses = options.houses || DEFAULT_HOUSES.slice();
            this._groups = [];
            this.colliders = [];
        }

        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(28, 'Preparando praça da vila...');

            this._createVillageFloor();

            // Casas residenciais simples + lojas dos NPCs (separadas)
            for (const [hx, hz, hrot] of this.houses) {
                this._createHouse(hx, hz, hrot);
            }

            this._createWell(0, 0);
            this._createPlazaBenches();
            this._createVillageFence();

            if (Array.isArray(this.world.colliders)) {
                this.world.colliders.push(...this.colliders);
            }

            await progress(34, 'Praça da vila pronta');
        }

        /** Chão de pedra/paralelepípedos da vila */
        _createVillageFloor() {
            const radius = 26;
            const y = this.world.getTerrainHeight(0, 0) + 0.04;

            // Textura procedural de paralelepípedos
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Base terra batida / pedra clara
            ctx.fillStyle = '#8a7a62';
            ctx.fillRect(0, 0, size, size);

            const tile = 16;
            for (let gy = 0; gy < size; gy += tile) {
                for (let gx = 0; gx < size; gx += tile) {
                    const ox = (Math.floor(gy / tile) % 2) * (tile / 2);
                    const px = gx + ox;
                    const shade = 0.78 + Math.random() * 0.22;
                    const r = Math.floor(110 * shade);
                    const g = Math.floor(98 * shade);
                    const b = Math.floor(78 * shade);
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(px + 1, gy + 1, tile - 2, tile - 3);

                    // Junta de argamassa
                    ctx.fillStyle = 'rgba(55,48,40,0.45)';
                    ctx.fillRect(px, gy, tile, 1);
                    ctx.fillRect(px, gy, 1, tile);
                }
            }

            // Manchas e desgaste
            for (let i = 0; i < 80; i++) {
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                ctx.fillStyle = `rgba(40,35,28,${0.08 + Math.random() * 0.12})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 2 + Math.random() * 6, 0, Math.PI * 2);
                ctx.fill();
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(10, 10);
            tex.anisotropy = 4;

            const geo = new THREE.CircleGeometry(radius, 48);
            geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshStandardMaterial({
                map: tex,
                roughness: 0.92,
                metalness: 0.05,
                flatShading: false
            });
            const floor = new THREE.Mesh(geo, mat);
            floor.position.set(0, y, 0);
            floor.receiveShadow = true;
            floor.name = 'village_floor';
            this.scene.add(floor);
            this._groups.push(floor);

            // Borda de pedra ao redor da vila
            const ringGeo = new THREE.RingGeometry(radius - 0.35, radius + 0.15, 48);
            ringGeo.rotateX(-Math.PI / 2);
            const ring = new THREE.Mesh(
                ringGeo,
                new THREE.MeshStandardMaterial({
                    color: 0x5c5346,
                    roughness: 0.9,
                    metalness: 0.08
                })
            );
            ring.position.set(0, y + 0.02, 0);
            ring.receiveShadow = true;
            this.scene.add(ring);
            this._groups.push(ring);
        }

        _mats() {
            return {
                wood: new THREE.MeshStandardMaterial({ color: 0x6e4e37, roughness: 0.9, metalness: 0.05 }),
                woodDark: new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.88, metalness: 0.05 }),
                plaster: new THREE.MeshStandardMaterial({ color: 0xc4b5a0, roughness: 0.95, metalness: 0.02 }),
                roof: new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.7, metalness: 0.08 }),
                roofDark: new THREE.MeshStandardMaterial({ color: 0x5c1010, roughness: 0.75, metalness: 0.08 }),
                stone: new THREE.MeshStandardMaterial({ color: 0x757575, roughness: 0.85, metalness: 0.1 }),
                glass: new THREE.MeshStandardMaterial({
                    color: 0x7dd3fc, roughness: 0.15, metalness: 0.4,
                    transparent: true, opacity: 0.55
                }),
                door: new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.85, metalness: 0.05 })
            };
        }

        _createHouse(x, z, rotation) {
            const m = this._mats();
            const group = new THREE.Group();
            const groundY = this.world.getTerrainHeight(x, z);
            group.position.set(x, groundY, z);
            group.rotation.y = rotation;
            group.name = 'house';

            // Base / paredes
            const base = new THREE.Mesh(
                new THREE.BoxGeometry(7.2, 4.4, 7.2),
                m.plaster
            );
            base.position.y = 2.2;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            // Fundações de pedra
            const foundation = new THREE.Mesh(
                new THREE.BoxGeometry(7.6, 0.55, 7.6),
                m.stone
            );
            foundation.position.y = 0.28;
            foundation.castShadow = true;
            foundation.receiveShadow = true;
            group.add(foundation);

            // Telhado (pirâmide / cone 4 lados)
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(5.8, 3.6, 4),
                m.roof
            );
            roof.position.y = 6.2;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            group.add(roof);

            // Porta
            const door = new THREE.Mesh(
                new THREE.BoxGeometry(1.3, 2.4, 0.15),
                m.door
            );
            door.position.set(0, 1.35, 3.65);
            door.castShadow = true;
            group.add(door);

            // Maçaneta
            const knob = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 6, 5),
                new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 })
            );
            knob.position.set(0.4, 1.3, 3.75);
            group.add(knob);

            // Janelas (frente e laterais)
            const winGeo = new THREE.BoxGeometry(1.1, 1.0, 0.12);
            const places = [
                { x: -2.0, y: 2.6, z: 3.62 },
                { x: 2.0, y: 2.6, z: 3.62 },
                { x: 3.62, y: 2.6, z: 0, ry: Math.PI / 2 },
                { x: -3.62, y: 2.6, z: 0, ry: Math.PI / 2 }
            ];
            for (const p of places) {
                const frame = new THREE.Mesh(
                    new THREE.BoxGeometry(1.25, 1.15, 0.1),
                    m.woodDark
                );
                frame.position.set(p.x, p.y, p.z);
                if (p.ry) frame.rotation.y = p.ry;
                group.add(frame);

                const glass = new THREE.Mesh(winGeo, m.glass);
                glass.position.set(p.x, p.y, p.z + (p.ry ? 0 : 0.02));
                if (p.ry) {
                    glass.rotation.y = p.ry;
                    glass.position.set(p.x + 0.02 * Math.sign(p.x || 1), p.y, p.z);
                }
                group.add(glass);
            }

            // Chaminé
            const chimney = new THREE.Mesh(
                new THREE.BoxGeometry(1.0, 2.2, 1.0),
                m.stone
            );
            chimney.position.set(2.0, 6.2, -1.2);
            chimney.castShadow = true;
            group.add(chimney);

            const chimneyTop = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.3, 1.2),
                m.stone
            );
            chimneyTop.position.set(2.0, 7.4, -1.2);
            group.add(chimneyTop);

            // Viga decorativa na fachada
            const beam = new THREE.Mesh(
                new THREE.BoxGeometry(7.0, 0.25, 0.2),
                m.wood
            );
            beam.position.set(0, 3.5, 3.6);
            group.add(beam);

            // Escala para caber dentro da cerca da vila
            const sc = 0.88;
            group.scale.setScalar(sc);

            this.scene.add(group);
            this._groups.push(group);
            // Colisor proporcional à escala (7.2*0.88 → ~r=4.4)
            // Caixa alinhada (casa ~6.3×6.3) + círculo de backup
            this.colliders.push({
                x, z,
                halfW: 3.3, halfD: 3.3,
                radius: 4.5,
                type: 'house'
            });
        }

        /** Textura procedural de tijolos para o poço */
        _createBrickTexture(size = 256) {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Argamassa (fundo)
            ctx.fillStyle = '#6b6358';
            ctx.fillRect(0, 0, size, size);

            const brickW = 32;
            const brickH = 14;
            const mortar = 3;

            for (let row = 0; row < size / brickH; row++) {
                const offset = (row % 2) * (brickW / 2);
                for (let col = -1; col < size / brickW + 1; col++) {
                    const bx = col * brickW + offset;
                    const by = row * brickH;

                    // Variação de cor dos tijolos (vermelho/terracota)
                    const shade = 0.75 + Math.random() * 0.3;
                    const r = Math.floor((140 + Math.random() * 40) * shade);
                    const g = Math.floor((70 + Math.random() * 25) * shade);
                    const b = Math.floor((45 + Math.random() * 20) * shade);
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.fillRect(
                        bx + mortar / 2,
                        by + mortar / 2,
                        brickW - mortar,
                        brickH - mortar
                    );

                    // Destaque sutil na borda superior do tijolo
                    ctx.fillStyle = `rgba(255,220,180,${0.08 + Math.random() * 0.06})`;
                    ctx.fillRect(bx + mortar / 2, by + mortar / 2, brickW - mortar, 2);

                    // Sombra na base do tijolo
                    ctx.fillStyle = `rgba(30,15,10,${0.12 + Math.random() * 0.1})`;
                    ctx.fillRect(bx + mortar / 2, by + brickH - mortar - 2, brickW - mortar, 2);
                }
            }

            // Manchas e desgaste
            for (let i = 0; i < 60; i++) {
                const sx = Math.random() * size;
                const sy = Math.random() * size;
                ctx.fillStyle = `rgba(40,25,15,${0.06 + Math.random() * 0.12})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 1.5 + Math.random() * 5, 0, Math.PI * 2);
                ctx.fill();
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(3, 1.5);
            tex.anisotropy = 4;
            return tex;
        }

        _createWell(x, z) {
            const m = this._mats();
            const group = new THREE.Group();
            const groundY = this.world.getTerrainHeight(x, z);
            group.position.set(x, groundY, z);
            group.name = 'well';

            // Material de tijolos
            const brickTex = this._createBrickTexture(256);
            const brickMat = new THREE.MeshStandardMaterial({
                map: brickTex,
                roughness: 0.88,
                metalness: 0.05
            });

            // Parede principal do poço (cilindro oco)
            const wall = new THREE.Mesh(
                new THREE.CylinderGeometry(1.85, 2.05, 1.45, 24, 1, true),
                brickMat
            );
            wall.position.y = 0.72;
            wall.castShadow = true;
            wall.receiveShadow = true;
            group.add(wall);

            // Face interna (tijolos mais escuros)
            const innerMat = new THREE.MeshStandardMaterial({
                color: 0x5a4035,
                roughness: 0.92,
                metalness: 0.03,
                side: THREE.BackSide
            });
            const innerWall = new THREE.Mesh(
                new THREE.CylinderGeometry(1.7, 1.75, 1.35, 20, 1, true),
                innerMat
            );
            innerWall.position.y = 0.68;
            group.add(innerWall);

            // Topo arredondado de pedra (coroa do poço)
            const rim = new THREE.Mesh(
                new THREE.TorusGeometry(1.9, 0.18, 10, 28),
                new THREE.MeshStandardMaterial({
                    color: 0x8a7a6a,
                    roughness: 0.82,
                    metalness: 0.08
                })
            );
            rim.rotation.x = Math.PI / 2;
            rim.position.y = 1.42;
            rim.castShadow = true;
            rim.receiveShadow = true;
            group.add(rim);

            // Base de pedra ligeiramente saliente
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(2.15, 2.25, 0.28, 20),
                new THREE.MeshStandardMaterial({
                    color: 0x6b6055,
                    roughness: 0.9,
                    metalness: 0.06
                })
            );
            base.position.y = 0.12;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            // Água do poço (mais baixa e com reflexo)
            const water = new THREE.Mesh(
                new THREE.CircleGeometry(1.55, 24),
                new THREE.MeshStandardMaterial({
                    color: 0x1565c0,
                    roughness: 0.15,
                    metalness: 0.55,
                    transparent: true,
                    opacity: 0.82
                })
            );
            water.rotation.x = -Math.PI / 2;
            water.position.y = 0.35;
            group.add(water);

            // Postes de madeira robustos
            const postMat = m.woodDark;
            for (const sx of [-1.25, 1.25]) {
                const post = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.12, 0.14, 2.8, 8),
                    postMat
                );
                post.position.set(sx, 2.0, 0);
                post.castShadow = true;
                group.add(post);
            }

            // Viga transversal
            const beam = new THREE.Mesh(
                new THREE.BoxGeometry(2.7, 0.18, 0.18),
                postMat
            );
            beam.position.set(0, 3.35, 0);
            beam.castShadow = true;
            group.add(beam);

            // Corda (cilindro fino)
            const rope = new THREE.Mesh(
                new THREE.CylinderGeometry(0.025, 0.025, 1.6, 6),
                new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.95 })
            );
            rope.position.set(0, 2.5, 0);
            group.add(rope);

            // Balde de madeira
            const bucket = new THREE.Group();
            const bucketBody = new THREE.Mesh(
                new THREE.CylinderGeometry(0.22, 0.18, 0.38, 10, 1, true),
                m.wood
            );
            bucketBody.castShadow = true;
            bucket.add(bucketBody);

            const bucketBottom = new THREE.Mesh(
                new THREE.CircleGeometry(0.18, 10),
                m.woodDark
            );
            bucketBottom.rotation.x = Math.PI / 2;
            bucketBottom.position.y = -0.19;
            bucket.add(bucketBottom);

            // Alça do balde
            const handle = new THREE.Mesh(
                new THREE.TorusGeometry(0.2, 0.025, 6, 12, Math.PI),
                new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 })
            );
            handle.rotation.x = Math.PI / 2;
            handle.position.y = 0.2;
            bucket.add(handle);

            bucket.position.set(0, 1.55, 0);
            group.add(bucket);

            // Telhado de madeira (pirâmide baixa)
            const roofGroup = new THREE.Group();
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(2.4, 1.1, 4),
                m.roofDark
            );
            roof.position.y = 0.55;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            roofGroup.add(roof);

            // Forro interno do telhado
            const underRoof = new THREE.Mesh(
                new THREE.ConeGeometry(2.25, 1.0, 4),
                m.wood
            );
            underRoof.position.y = 0.48;
            underRoof.rotation.y = Math.PI / 4;
            underRoof.scale.set(1, 0.92, 1);
            roofGroup.add(underRoof);

            roofGroup.position.y = 3.55;
            group.add(roofGroup);

            this.scene.add(group);
            this._groups.push(group);
            this.colliders.push({ x, z, radius: 2.2, type: 'well' });
        }

        /** Bancos de praça ao redor do poço */
        _createPlazaBenches() {
            const m = this._mats();
            const wood = m.wood;
            const woodDark = m.woodDark;
            // Posições em volta da praça (em volta do poço em 0,0)
            const spots = [
                { x: 4.5, z: 3.2, rot: -0.5 },
                { x: -4.2, z: 3.5, rot: 0.55 },
                { x: 0.5, z: -5.2, rot: Math.PI },
                { x: 5.5, z: -2.0, rot: -1.2 },
                { x: -5.3, z: -1.5, rot: 1.35 }
            ];
            for (const s of spots) {
                const group = new THREE.Group();
                const gy = this.world.getTerrainHeight(s.x, s.z);
                group.position.set(s.x, gy, s.z);
                group.rotation.y = s.rot;
                group.name = 'plaza_bench';

                // Assento
                const seat = new THREE.Mesh(
                    new THREE.BoxGeometry(2.4, 0.14, 0.55),
                    wood
                );
                seat.position.y = 0.52;
                seat.castShadow = true;
                seat.receiveShadow = true;
                group.add(seat);

                // Encosto
                const back = new THREE.Mesh(
                    new THREE.BoxGeometry(2.4, 0.55, 0.1),
                    woodDark
                );
                back.position.set(0, 0.85, -0.22);
                back.castShadow = true;
                group.add(back);

                // Pés
                const legGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
                const legPositions = [
                    [-1.0, 0.25, 0.18],
                    [1.0, 0.25, 0.18],
                    [-1.0, 0.25, -0.18],
                    [1.0, 0.25, -0.18]
                ];
                for (const lp of legPositions) {
                    const leg = new THREE.Mesh(legGeo, woodDark);
                    leg.position.set(lp[0], lp[1], lp[2]);
                    leg.castShadow = true;
                    group.add(leg);
                }

                // Apoios laterais do encosto
                for (const sx of [-1.1, 1.1]) {
                    const post = new THREE.Mesh(
                        new THREE.BoxGeometry(0.1, 0.7, 0.1),
                        woodDark
                    );
                    post.position.set(sx, 0.7, -0.22);
                    post.castShadow = true;
                    group.add(post);
                }

                this.scene.add(group);
                this._groups.push(group);
                this.colliders.push({ x: s.x, z: s.z, radius: 1.1, type: 'bench' });
            }
        }

        /**
         * Cerca de madeira envolvendo a vila, com aberturas (portões) nos eixos principais.
         */
        _createVillageFence() {
            const radius = 27.5;
            const segments = 56;
            const postH = 1.55;
            const postR = 0.11;
            const railH1 = 0.55;
            const railH2 = 1.1;
            // Ângulos dos portões (aberturas) — leste (saída) e sul/norte leves
            const gates = [
                { angle: Math.PI / 2, half: 0.22 },   // +X leste
                { angle: -Math.PI / 2, half: 0.18 },  // -X oeste
                { angle: 0, half: 0.16 },             // +Z sul
                { angle: Math.PI, half: 0.16 }        // -Z norte
            ];

            const woodMat = new THREE.MeshStandardMaterial({
                color: 0x6b4f32, roughness: 0.92, metalness: 0.04
            });
            const woodDark = new THREE.MeshStandardMaterial({
                color: 0x4a3420, roughness: 0.9, metalness: 0.04
            });

            const group = new THREE.Group();
            group.name = 'village_fence';

            const isInGate = (ang) => {
                // normaliza -PI..PI
                let a = ang;
                while (a > Math.PI) a -= Math.PI * 2;
                while (a < -Math.PI) a += Math.PI * 2;
                for (const g of gates) {
                    let d = a - g.angle;
                    while (d > Math.PI) d -= Math.PI * 2;
                    while (d < -Math.PI) d += Math.PI * 2;
                    if (Math.abs(d) < g.half) return true;
                }
                return false;
            };

            const posts = [];
            for (let i = 0; i < segments; i++) {
                const t = (i / segments) * Math.PI * 2;
                if (isInGate(t)) continue;
                const x = Math.cos(t) * radius;
                const z = Math.sin(t) * radius;
                const gy = this.world.getTerrainHeight(x, z);
                posts.push({ x, z, y: gy, t, i });
            }

            // Postes
            const postGeo = new THREE.CylinderGeometry(postR, postR * 1.15, postH, 6);
            for (const p of posts) {
                const post = new THREE.Mesh(postGeo, woodDark);
                post.position.set(p.x, p.y + postH * 0.5, p.z);
                post.castShadow = true;
                post.receiveShadow = true;
                group.add(post);
                // Colisor do poste (sólido)
                this.colliders.push({ x: p.x, z: p.z, radius: 0.85, type: 'fence' });
            }

            // Traves horizontais entre postes vizinhos + colisão contínua (não atravessa)
            const railGeo = new THREE.BoxGeometry(1, 0.1, 0.08);
            for (let i = 0; i < posts.length; i++) {
                const a = posts[i];
                const b = posts[(i + 1) % posts.length];
                // Se o índice original pula muito, é abertura de portão — não liga
                const idxGap = (b.i - a.i + segments) % segments;
                if (idxGap > 1) continue;

                const mx = (a.x + b.x) * 0.5;
                const mz = (a.z + b.z) * 0.5;
                const my = (a.y + b.y) * 0.5;
                const dx = b.x - a.x;
                const dz = b.z - a.z;
                const len = Math.hypot(dx, dz);
                if (len < 0.2) continue;
                const ang = Math.atan2(dx, dz);

                for (const rh of [railH1, railH2]) {
                    const rail = new THREE.Mesh(railGeo, woodMat);
                    rail.scale.x = len / 1.0;
                    rail.position.set(mx, my + rh, mz);
                    rail.rotation.y = ang + Math.PI / 2;
                    rail.castShadow = true;
                    group.add(rail);
                }

                // Colisores intermediários ao longo do trecho (cerca sólida)
                const steps = Math.max(2, Math.ceil(len / 0.9));
                for (let s = 1; s < steps; s++) {
                    const t = s / steps;
                    const cx = a.x + dx * t;
                    const cz = a.z + dz * t;
                    this.colliders.push({ x: cx, z: cz, radius: 0.95, type: 'fence' });
                }
            }

            // Portais (pilares maiores nas laterais de cada abertura)
            for (const g of gates) {
                for (const side of [-1, 1]) {
                    const ang = g.angle + side * g.half;
                    const x = Math.cos(ang) * radius;
                    const z = Math.sin(ang) * radius;
                    const gy = this.world.getTerrainHeight(x, z);
                    const pillar = new THREE.Mesh(
                        new THREE.BoxGeometry(0.35, 2.1, 0.35),
                        woodDark
                    );
                    pillar.position.set(x, gy + 1.05, z);
                    pillar.castShadow = true;
                    group.add(pillar);
                    // Topo do pilar
                    const cap = new THREE.Mesh(
                        new THREE.BoxGeometry(0.45, 0.12, 0.45),
                        woodMat
                    );
                    cap.position.set(x, gy + 2.15, z);
                    group.add(cap);
                    this.colliders.push({ x, z, radius: 0.55, type: 'fence_gate' });
                }
            }

            this.scene.add(group);
            this._groups.push(group);
        }

        dispose() {
            for (const g of this._groups) {
                this.scene.remove(g);
                g.traverse(obj => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                });
            }
            this._groups.length = 0;
            this.colliders.length = 0;
        }
    }

    global.VillageBuilder = VillageBuilder;
})(typeof window !== 'undefined' ? window : globalThis);
