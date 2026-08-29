/**
 * castelo.js — Interior do Keep (torre multi-andares)
 * Refeito do zero: SEM escadas. Transição entre andares só por teleporte nas portas.
 *
 * Estrutura:
 *   1º — Grande Salão + Trono
 *   2º — Tesouraria
 *   3º — Biblioteca
 *   4º — Arsenal
 *   5º — Sala Mágica
 *   6º — Boss Final (Sala do Rei)
 *
 * API:
 *   WorldCastleInterior(scene, options)
 *   build(onProgress), getTerrainHeight(x,z), update(time), dispose()
 *   getExitDoorPoint(), getInteriorSpawns(), getEntrySpawn()
 *   getTeleportDoors()  — portas ativas do andar atual
 *
 * Teleporte (colisão):
 *   Colliders type: 'teleport' (só do andar atual em world.colliders).
 *   O jogo deve, ao detectar colisão:
 *     player.position.set(door.targetX, door.targetY, door.targetZ)
 *   update() sincroniza _playerFloor pela altura Y e refresca colliders.
 */
(function (global) {
    'use strict';

    // Altura base de cada andar (centro do piso)
    // Paredes mais altas: FLOOR_H maior e espaçamento entre andares ajustado
    const F = { 1: 0.15, 2: 10.5, 3: 21.0, 4: 31.5, 5: 42.0, 6: 52.5 };
    const FLOOR_H = 9.5;

    const DEFAULTS = {
        mapSize: 60,
        bound: 30,
        waterLevel: -10,
        hallW: 14,
        hallD: 16,
        wallH: F[6] + FLOOR_H
    };

    class WorldCastleInterior {
        constructor(scene, options) {
            if (!scene) throw new Error('[WorldCastleInterior] scene obrigatória');
            this.scene = scene;
            this.cfg = Object.assign({}, DEFAULTS, options || {});
            this.colliders = [];
            this.collectibles = [];
            this.chests = [];
            this.boats = [];
            this.terrainMesh = null;
            this.waterMesh = null;
            this._instanced = [];
            this._groups = [];
            this._embers = [];
            this._anim = [];
            this._mats = null;
            this._geos = null;
            this._updSkip = 0;
            this._built = false;
            this._playerFloor = 1;

            // Colliders do 1º (objetos) + paredes por andar + portas
            this._baseColliders = [];
            this._doorColliders = [];
            this._wallColliders = []; // paredes de qualquer andar (filtradas por floor)

            // Carregamento sob demanda: só o andar ativo existe na cena
            this._loadedFloors = {};
            this._loadingFloor = null;
            this._activeFloor = 1;
        }

        /**
         * Altura do chão no andar atual (sincronizado via Y do jogador).
         */
        getTerrainHeight(x, z) {
            const hw = this.cfg.hallW;
            const hd = this.cfg.hallD;

            if (Math.abs(x) <= hw + 1.5 && Math.abs(z) <= hd + 1.5) {
                const fy = F[this._playerFloor] || F[1];
                // Trono elevado só no 1º
                if (this._playerFloor === 1 && z < -11 && Math.abs(x) < 6) {
                    return fy + 0.7;
                }
                return fy;
            }
            return F[1];
        }

        _floorFromY(y) {
            if (y >= F[6] - 0.8) return 6;
            if (y >= F[5] - 0.8) return 5;
            if (y >= F[4] - 0.8) return 4;
            if (y >= F[3] - 0.8) return 3;
            if (y >= F[2] - 0.8) return 2;
            return 1;
        }

        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };
            this._initSharedAssets();

            // Só o 1º andar no carregamento inicial (evita travar tudo de uma vez)
            await progress(20, '1º andar — Grande Salão...');
            await this.ensureFloor(1, progress);

            await progress(85, 'Atmosfera...');
            this._setupAtmosphere();

            this._playerFloor = 1;
            this._refreshColliders();
            this._built = true;
            await progress(100, 'Torre do castelo pronta');
        }

        isFloorLoaded(level) {
            return !!this._loadedFloors[level];
        }

        /**
         * Constrói um andar sob demanda (com yields para não travar a UI).
         * Idempotente: se já carregado, retorna imediato.
         */
        async ensureFloor(level, onProgress) {
            const lv = Math.max(1, Math.min(6, level | 0));
            if (this._loadedFloors[lv]) return true;
            if (this._loadingFloor === lv) {
                while (this._loadingFloor === lv) {
                    await new Promise(r => setTimeout(r, 40));
                }
                return !!this._loadedFloors[lv];
            }

            this._loadingFloor = lv;
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
                else await new Promise(r => setTimeout(r, 0));
            };

            const label = this.getFloorName(lv);

            try {
                await progress(15, 'Preparando ' + label + '...');
                await new Promise(r => setTimeout(r, 30));

                await progress(40, 'Estrutura — ' + label + '...');
                this._buildFloorShell(lv, F[lv]);
                await new Promise(r => setTimeout(r, 20));

                await progress(70, 'Decorando ' + label + '...');
                if (lv === 1) this._buildHallAndThrone();
                else if (lv === 2) this._buildTreasury(F[2]);
                else if (lv === 3) this._buildLibrary(F[3]);
                else if (lv === 4) this._buildArmory(F[4]);
                else if (lv === 5) this._buildMagicRoom(F[5]);
                else if (lv === 6) this._buildBossRoom(F[6]);
                await new Promise(r => setTimeout(r, 20));

                this._loadedFloors[lv] = true;
                await progress(100, label + ' pronto');
                return true;
            } finally {
                this._loadingFloor = null;
            }
        }

        /**
         * Ativa apenas um andar: carrega o destino e descarrega todos os outros.
         * Assim só existe geometria do andar em que o jogador está.
         */
        async activateFloor(level, onProgress) {
            const lv = Math.max(1, Math.min(6, level | 0));
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(10, 'Carregando ' + this.getFloorName(lv) + '...');
            await this.ensureFloor(lv, progress);

            // Desativa / remove todos os outros andares
            for (let f = 1; f <= 6; f++) {
                if (f !== lv && this._loadedFloors[f]) {
                    await progress(85, 'Liberando ' + this.getFloorName(f) + '...');
                    this.unloadFloor(f);
                    await new Promise(r => setTimeout(r, 10));
                }
            }

            this._playerFloor = lv;
            this._activeFloor = lv;
            this._refreshColliders();
            await progress(100, this.getFloorName(lv) + ' ativo');
            return true;
        }

        /**
         * Remove da cena toda a geometria/colliders/animações de um andar.
         */
        unloadFloor(level) {
            const lv = level | 0;
            if (!this._loadedFloors[lv]) return;

            const disposeMesh = (obj) => {
                if (!obj) return;
                if (obj.geometry && obj.geometry !== this._geos?.box
                    && obj.geometry !== this._geos?.sphere
                    && obj.geometry !== this._geos?.cyl
                    && obj.geometry !== this._geos?.cone
                    && obj.geometry !== this._geos?.plane) {
                    try { obj.geometry.dispose(); } catch (e) {}
                }
                // Materiais compartilhados (_mats) NÃO são disposed aqui
            };

            // Remove grupos deste andar
            const keep = [];
            for (let i = 0; i < this._groups.length; i++) {
                const g = this._groups[i];
                const fl = g && g.userData ? g.userData.floor : null;
                if (fl === lv) {
                    this.scene.remove(g);
                    if (g.traverse) {
                        g.traverse((obj) => {
                            if (obj.isMesh) disposeMesh(obj);
                        });
                    }
                    if (this.terrainMesh && g.children && g.children.indexOf(this.terrainMesh) >= 0) {
                        this.terrainMesh = null;
                    }
                } else {
                    keep.push(g);
                }
            }
            this._groups = keep;

            // Portas de teleporte do andar
            this._doorColliders = this._doorColliders.filter(d => d.floor !== lv);

            // Paredes do andar
            this._wallColliders = this._wallColliders.filter(c => c.floor !== lv);

            // Colliders de objetos do 1º andar
            if (lv === 1) {
                this._baseColliders = [];
            }

            // Baús / anim / embers órfãos
            this.chests = this.chests.filter(ch => {
                if (!ch) return false;
                let p = ch.parent;
                while (p) {
                    if (p.userData && p.userData.floor === lv) return false;
                    p = p.parent;
                }
                // Se o grupo pai sumiu da cena
                if (!ch.parent) return false;
                return true;
            });

            this._anim = this._anim.filter(a => {
                if (a.mesh && a.mesh.parent) return true;
                if (a.light && a.light.parent) return true;
                return false;
            });
            this._embers = this._embers.filter(m => m && m.parent);

            this._loadedFloors[lv] = false;
            if (this._activeFloor === lv) this._activeFloor = null;
        }

        getFloorName(level) {
            const names = {
                1: 'Grande Salão',
                2: 'Tesouraria',
                3: 'Biblioteca',
                4: 'Arsenal',
                5: 'Sala Mágica',
                6: 'Sala do Rei'
            };
            return names[level] || ('Andar ' + level);
        }

        /**
         * Gera textura procedural em canvas (leve, sem assets externos).
         * kind: 'stone' | 'brick' | 'plank' | 'tile' | 'carpet' | 'marble' | 'rune' | 'metal'
         */
        _makeTexture(kind, w, h, opts) {
            opts = opts || {};
            const canvas = document.createElement('canvas');
            canvas.width = w || 256;
            canvas.height = h || 256;
            const ctx = canvas.getContext('2d');
            const rng = (a, b) => a + Math.random() * (b - a);

            if (kind === 'stone') {
                const base = opts.base || '#4b5563';
                ctx.fillStyle = base;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Blocos irregulares
                for (let y = 0; y < canvas.height; y += 28) {
                    const off = (Math.floor(y / 28) % 2) * 20;
                    for (let x = -20; x < canvas.width; x += 40) {
                        const shade = rng(-18, 18);
                        ctx.fillStyle = `rgb(${75 + shade},${85 + shade},${99 + shade})`;
                        ctx.fillRect(x + off + 1, y + 1, 38, 26);
                        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                        ctx.lineWidth = 1.5;
                        ctx.strokeRect(x + off + 1, y + 1, 38, 26);
                    }
                }
                // Ruído / musgo
                for (let i = 0; i < 900; i++) {
                    const gx = rng(0, canvas.width), gy = rng(0, canvas.height);
                    ctx.fillStyle = `rgba(${rng(20, 60)},${rng(30, 70)},${rng(20, 50)},${rng(0.05, 0.2)})`;
                    ctx.fillRect(gx, gy, rng(1, 3), rng(1, 3));
                }
            } else if (kind === 'brick') {
                ctx.fillStyle = opts.base || '#6b3a2a';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const bw = 36, bh = 16;
                for (let row = 0; row < canvas.height / bh + 1; row++) {
                    const off = (row % 2) * (bw * 0.5);
                    for (let col = -1; col < canvas.width / bw + 1; col++) {
                        const shade = rng(-20, 15);
                        ctx.fillStyle = `rgb(${120 + shade},${55 + shade * 0.5},${40 + shade * 0.4})`;
                        ctx.fillRect(col * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
                    }
                }
            } else if (kind === 'plank') {
                ctx.fillStyle = opts.base || '#5c4033';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const pw = canvas.width / 6;
                for (let i = 0; i < 6; i++) {
                    const shade = rng(-15, 20);
                    ctx.fillStyle = `rgb(${90 + shade},${60 + shade * 0.6},${40 + shade * 0.4})`;
                    ctx.fillRect(i * pw + 1, 0, pw - 2, canvas.height);
                    // Veios
                    ctx.strokeStyle = 'rgba(30,15,8,0.25)';
                    for (let y = 0; y < canvas.height; y += 8) {
                        ctx.beginPath();
                        ctx.moveTo(i * pw + 4, y);
                        ctx.lineTo(i * pw + pw - 4, y + rng(-3, 3));
                        ctx.stroke();
                    }
                }
            } else if (kind === 'tile') {
                const c1 = opts.c1 || '#374151';
                const c2 = opts.c2 || '#1f2937';
                const ts = 32;
                for (let y = 0; y < canvas.height; y += ts) {
                    for (let x = 0; x < canvas.width; x += ts) {
                        ctx.fillStyle = ((x / ts + y / ts) % 2 === 0) ? c1 : c2;
                        ctx.fillRect(x, y, ts, ts);
                        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                        ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);
                    }
                }
            } else if (kind === 'carpet') {
                ctx.fillStyle = opts.base || '#7f1d1d';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Borda dourada
                ctx.strokeStyle = opts.trim || '#d97706';
                ctx.lineWidth = 10;
                ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
                ctx.lineWidth = 3;
                ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
                // Motivo central
                ctx.fillStyle = opts.trim || '#d97706';
                ctx.globalAlpha = 0.35;
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (kind === 'marble') {
                ctx.fillStyle = opts.base || '#e7e5e4';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < 18; i++) {
                    ctx.strokeStyle = `rgba(80,70,90,${rng(0.08, 0.22)})`;
                    ctx.lineWidth = rng(1, 3);
                    ctx.beginPath();
                    ctx.moveTo(rng(0, canvas.width), rng(0, canvas.height));
                    for (let j = 0; j < 5; j++) {
                        ctx.quadraticCurveTo(
                            rng(0, canvas.width), rng(0, canvas.height),
                            rng(0, canvas.width), rng(0, canvas.height)
                        );
                    }
                    ctx.stroke();
                }
            } else if (kind === 'rune') {
                ctx.fillStyle = opts.base || '#1e1b4b';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                // Grade de pedra
                for (let y = 0; y < canvas.height; y += 32) {
                    for (let x = 0; x < canvas.width; x += 32) {
                        ctx.strokeStyle = 'rgba(100,80,160,0.25)';
                        ctx.strokeRect(x + 1, y + 1, 30, 30);
                    }
                }
                // Runas
                ctx.fillStyle = opts.glow || '#22d3ee';
                ctx.font = 'bold 18px serif';
                const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';
                for (let i = 0; i < 24; i++) {
                    ctx.globalAlpha = rng(0.3, 0.85);
                    ctx.fillText(runes[i % runes.length], rng(8, canvas.width - 20), rng(20, canvas.height - 8));
                }
                ctx.globalAlpha = 1;
            } else if (kind === 'metal') {
                const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                g.addColorStop(0, '#71717a');
                g.addColorStop(0.5, '#3f3f46');
                g.addColorStop(1, '#52525b');
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < 40; i++) {
                    ctx.strokeStyle = `rgba(255,255,255,${rng(0.03, 0.12)})`;
                    ctx.beginPath();
                    ctx.moveTo(rng(0, canvas.width), 0);
                    ctx.lineTo(rng(0, canvas.width), canvas.height);
                    ctx.stroke();
                }
            } else {
                ctx.fillStyle = opts.base || '#666';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(opts.repeatX || 1, opts.repeatY || 1);
            tex.anisotropy = 4;
            tex.needsUpdate = true;
            return tex;
        }

        _matFromTex(map, extras) {
            extras = extras || {};
            return new THREE.MeshStandardMaterial(Object.assign({
                map: map,
                roughness: extras.roughness != null ? extras.roughness : 0.88,
                metalness: extras.metalness != null ? extras.metalness : 0.05,
                color: extras.color != null ? extras.color : 0xffffff
            }, extras.more || {}));
        }

        _initSharedAssets() {
            // Texturas base
            const texStone = this._makeTexture('stone', 256, 256, { repeatX: 3, repeatY: 2 });
            const texStoneDark = this._makeTexture('stone', 256, 256, { base: '#1f2937', repeatX: 2, repeatY: 2 });
            const texBrick = this._makeTexture('brick', 256, 256, { repeatX: 2, repeatY: 2 });
            const texPlank = this._makeTexture('plank', 256, 256, { repeatX: 2, repeatY: 1 });
            const texPlankDark = this._makeTexture('plank', 256, 256, { base: '#3d2914', repeatX: 2, repeatY: 1 });
            const texMarble = this._makeTexture('marble', 256, 256, { repeatX: 2, repeatY: 2 });
            const texTileHall = this._makeTexture('tile', 256, 256, { c1: '#4b5563', c2: '#374151', repeatX: 4, repeatY: 4 });
            const texTileGold = this._makeTexture('tile', 256, 256, { c1: '#a16207', c2: '#713f12', repeatX: 4, repeatY: 4 });
            const texTileLib = this._makeTexture('plank', 256, 256, { base: '#4a3728', repeatX: 3, repeatY: 3 });
            const texTileArm = this._makeTexture('metal', 256, 256, { repeatX: 3, repeatY: 3 });
            const texTileMagic = this._makeTexture('rune', 256, 256, { repeatX: 2, repeatY: 2 });
            const texTileBoss = this._makeTexture('marble', 256, 256, { base: '#292524', repeatX: 3, repeatY: 3 });
            const texCarpet = this._makeTexture('carpet', 256, 256, { repeatX: 1, repeatY: 2 });

            this._textures = [
                texStone, texStoneDark, texBrick, texPlank, texPlankDark, texMarble,
                texTileHall, texTileGold, texTileLib, texTileArm, texTileMagic, texTileBoss, texCarpet
            ];

            this._mats = {
                stone: this._matFromTex(texStone, { roughness: 0.92, metalness: 0.04 }),
                stoneLight: this._matFromTex(texStone, { roughness: 0.9, metalness: 0.03, color: 0xc4c9d0 }),
                stoneDark: this._matFromTex(texStoneDark, { roughness: 0.93, metalness: 0.05 }),
                stoneWorn: this._matFromTex(texBrick, { roughness: 0.94, metalness: 0.03 }),
                // Piso padrão (fallback)
                floor: this._matFromTex(texTileHall, { roughness: 0.85, metalness: 0.06 }),
                // Pisos temáticos por andar
                floor1: this._matFromTex(texTileHall, { roughness: 0.85, metalness: 0.06 }),
                floor2: this._matFromTex(texTileGold, { roughness: 0.7, metalness: 0.25 }),
                floor3: this._matFromTex(texTileLib, { roughness: 0.88, metalness: 0.02 }),
                floor4: this._matFromTex(texTileArm, { roughness: 0.55, metalness: 0.55 }),
                floor5: this._matFromTex(texTileMagic, {
                    roughness: 0.6, metalness: 0.15,
                    more: { emissive: 0x1e1b4b, emissiveIntensity: 0.15 }
                }),
                floor6: this._matFromTex(texTileBoss, {
                    roughness: 0.75, metalness: 0.12,
                    more: { emissive: 0x450a0a, emissiveIntensity: 0.08 }
                }),
                // Paredes levemente tintadas por andar (clone de stone)
                wall1: this._matFromTex(texStone, { roughness: 0.92, color: 0xb0b8c4 }),
                wall2: this._matFromTex(texStone, { roughness: 0.9, color: 0xc4a574 }),
                wall3: this._matFromTex(texStone, { roughness: 0.92, color: 0x8b7355 }),
                wall4: this._matFromTex(texStoneDark, { roughness: 0.88, color: 0x6b7280 }),
                wall5: this._matFromTex(texStoneDark, {
                    roughness: 0.85, color: 0x6366f1,
                    more: { emissive: 0x312e81, emissiveIntensity: 0.12 }
                }),
                wall6: this._matFromTex(texStoneDark, {
                    roughness: 0.9, color: 0x7f1d1d,
                    more: { emissive: 0x450a0a, emissiveIntensity: 0.1 }
                }),
                wood: this._matFromTex(texPlank, { roughness: 0.88, metalness: 0.02 }),
                woodDark: this._matFromTex(texPlankDark, { roughness: 0.9, metalness: 0.02 }),
                iron: this._matFromTex(texTileArm, { roughness: 0.45, metalness: 0.75 }),
                bronze: new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.4, metalness: 0.6 }),
                gold: new THREE.MeshStandardMaterial({
                    color: 0xfbbf24, roughness: 0.3, metalness: 0.85,
                    emissive: 0xb45309, emissiveIntensity: 0.18
                }),
                carpet: this._matFromTex(texCarpet, { roughness: 0.95, metalness: 0 }),
                banner: new THREE.MeshStandardMaterial({
                    color: 0x7f1d1d, roughness: 0.85, metalness: 0,
                    emissive: 0x450a0a, emissiveIntensity: 0.1, side: THREE.DoubleSide
                }),
                torchGlow: new THREE.MeshStandardMaterial({
                    color: 0xff6b00, emissive: 0xff4500, emissiveIntensity: 1.0
                }),
                crystal: new THREE.MeshStandardMaterial({
                    color: 0xa78bfa, emissive: 0x7c3aed, emissiveIntensity: 0.8,
                    transparent: true, opacity: 0.9, metalness: 0.3, roughness: 0.2
                }),
                bone: new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.7, metalness: 0.05 }),
                book: new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.85, metalness: 0 }),
                magic: new THREE.MeshStandardMaterial({
                    color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.6,
                    transparent: true, opacity: 0.75, roughness: 0.25, metalness: 0.2
                }),
                portalUp: new THREE.MeshStandardMaterial({
                    color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.7,
                    transparent: true, opacity: 0.55, side: THREE.DoubleSide
                }),
                portalDown: new THREE.MeshStandardMaterial({
                    color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.65,
                    transparent: true, opacity: 0.55, side: THREE.DoubleSide
                })
            };
            this._geos = {
                box: new THREE.BoxGeometry(1, 1, 1),
                sphere: new THREE.SphereGeometry(0.5, 6, 5),
                cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
                cone: new THREE.ConeGeometry(0.5, 1, 6),
                plane: new THREE.PlaneGeometry(1, 1)
            };
        }

        _addGroup(name, floor) {
            const g = new THREE.Group();
            g.name = name;
            g.userData = g.userData || {};
            if (floor != null) g.userData.floor = floor;
            this.scene.add(g);
            this._groups.push(g);
            return g;
        }

        _mesh(geo, mat, x, y, z, sx, sy, sz) {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(x, y, z);
            if (sx != null) m.scale.set(sx, sy != null ? sy : sx, sz != null ? sz : sx);
            m.castShadow = false;
            m.receiveShadow = true;
            return m;
        }

        createTorch(x, y, z, parent, withLight) {
            const M = this._mats;
            parent.add(this._mesh(this._geos.box, M.iron, x, y, z, 0.16, 0.1, 0.28));
            const flame = this._mesh(this._geos.sphere, M.torchGlow, x, y + 0.28, z, 0.28, 0.32, 0.28);
            parent.add(flame);
            this._embers.push(flame);
            let light = null;
            if (withLight) {
                light = new THREE.PointLight(0xff6a00, 0.7, 10, 2);
                light.position.set(x, y + 0.35, z);
                parent.add(light);
            }
            this._anim.push({ type: 'torch', mesh: flame, light: light, phase: Math.random() * 6 });
            return flame;
        }

        _makeChest(scale, x, y, z, parent) {
            const s = scale || 1;
            const M = this._mats;
            const g = new THREE.Group();
            g.name = 'treasure_chest';
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 0.8 * s, 1.0 * s), M.wood);
            body.position.y = 0.45 * s;
            body.receiveShadow = true;
            g.add(body);
            const lid = new THREE.Mesh(new THREE.BoxGeometry(1.55 * s, 0.22 * s, 1.05 * s), M.woodDark);
            lid.position.y = 0.95 * s;
            g.add(lid);
            const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.25 * s, 0.12 * s), M.gold);
            lock.position.set(0, 0.7 * s, 0.5 * s);
            g.add(lock);
            g.position.set(x, y, z);
            g.userData = { opened: false, baseY: y };
            parent.add(g);
            this.chests.push(g);
            // Collider só no 1º (outros andares não usam colliders de objetos altos)
            if (y < 2) {
                this._baseColliders.push({ x: x, z: z, radius: 1.2 * s, type: 'chest' });
            }
            return g;
        }

        /**
         * Casca do andar: piso, teto, 4 paredes.
         * - Leste (x = +hallW): porta SUBIR (se level < 6)
         * - Oeste (x = -hallW): porta DESCER (se level > 1)
         * - Sul (z = +hallD): porta de saída só no 1º
         * Nenhuma escada.
         */
        _buildFloorShell(level, fy) {
            const group = this._addGroup('floor_' + level, level);
            const M = this._mats;
            const hw = this.cfg.hallW;
            const hd = this.cfg.hallD;
            const T = 1.3;
            const H = FLOOR_H - 0.4;

            // Helper: collider de parede (todos os andares — câmera + jogador)
            const addWall = (x, z, halfW, halfD) => {
                this._wallColliders.push({
                    x, z, halfW, halfD, type: 'wall', floor: level
                });
            };

            // Materiais temáticos do andar
            const floorMat = M['floor' + level] || M.floor;
            const wallMat = M['wall' + level] || M.stone;

            // Piso
            const floor = this._mesh(
                new THREE.BoxGeometry(hw * 2 + 2, 0.35, hd * 2 + 2),
                floorMat, 0, fy - 0.05, 0
            );
            group.add(floor);
            if (level === 1) this.terrainMesh = floor;

            // Teto
            group.add(this._mesh(
                new THREE.BoxGeometry(hw * 2 + 2, 0.3, hd * 2 + 2),
                M.stoneDark, 0, fy + H, 0
            ));

            // Norte (z = -hd) — parede sólida
            group.add(this._mesh(
                new THREE.BoxGeometry(hw * 2 + T * 2, H, T),
                wallMat, 0, fy + H * 0.5, -hd
            ));
            addWall(0, -hd, hw + T, T * 0.7);

            // Sul (z = +hd) — no 1º: porta de saída para mapa3; demais: sólido
            if (level === 1) {
                this._exitDoorWall(group, fy, H, M, hd, T, hw);
            } else {
                group.add(this._mesh(
                    new THREE.BoxGeometry(hw * 2 + T * 2, H, T),
                    wallMat, 0, fy + H * 0.5, hd
                ));
                addWall(0, hd, hw + T, T * 0.7);
            }

            // Oeste (x = -hw) — porta DESCER se level > 1
            if (level > 1) {
                this._buildTeleportDoor(group, level, fy, H, M, 'down', -hw, 0);
            } else {
                group.add(this._mesh(
                    new THREE.BoxGeometry(T, H, hd * 2),
                    wallMat, -hw, fy + H * 0.5, 0
                ));
                addWall(-hw, 0, T * 0.7, hd);
            }

            // Leste (x = +hw) — porta SUBIR se level < 6
            if (level < 6) {
                this._buildTeleportDoor(group, level, fy, H, M, 'up', hw, 0);
            } else {
                group.add(this._mesh(
                    new THREE.BoxGeometry(T, H, hd * 2),
                    wallMat, hw, fy + H * 0.5, 0
                ));
                addWall(hw, 0, T * 0.7, hd);
            }

            // Tochas decorativas (mais altas com o novo pé-direito)
            this.createTorch(-hw + 1.0, fy + 4.2, -hd + 3, group, level === 1 || level === 6);
            this.createTorch(hw - 1.5, fy + 4.2, hd - 3, group, false);
        }

        /**
         * Porta de teleporte (subir ou descer). Zero escadas.
         * direction: 'up' | 'down'
         * wallX: X da parede onde a porta fica
         */
        _buildTeleportDoor(group, level, fy, H, M, direction, wallX, doorZ) {
            const isUp = direction === 'up';
            const targetFloor = isUp ? level + 1 : level - 1;
            const doorGap = 3.6;
            const frameH = 4.2;
            const wallThickness = 1.3;
            const halfD = this.cfg.hallD;
            const wallMat = M['wall' + level] || M.stone;

            // Painéis de parede ao norte e sul da abertura
            const northLen = Math.abs(doorZ - doorGap * 0.5 - (-halfD));
            const southLen = Math.abs(halfD - (doorZ + doorGap * 0.5));

            if (northLen > 0.8) {
                const nz = (doorZ - doorGap * 0.5 + (-halfD)) * 0.5;
                group.add(this._mesh(
                    new THREE.BoxGeometry(wallThickness, H, northLen),
                    wallMat, wallX, fy + H * 0.5, nz
                ));
                this._wallColliders.push({
                    x: wallX, z: nz,
                    halfW: wallThickness * 0.7, halfD: northLen * 0.5,
                    type: 'wall', floor: level
                });
            }
            if (southLen > 0.8) {
                const sz = (doorZ + doorGap * 0.5 + halfD) * 0.5;
                group.add(this._mesh(
                    new THREE.BoxGeometry(wallThickness, H, southLen),
                    wallMat, wallX, fy + H * 0.5, sz
                ));
                this._wallColliders.push({
                    x: wallX, z: sz,
                    halfW: wallThickness * 0.7, halfD: southLen * 0.5,
                    type: 'wall', floor: level
                });
            }

            // Moldura
            group.add(this._mesh(
                new THREE.BoxGeometry(wallThickness + 0.15, 0.35, doorGap + 0.5),
                M.stoneLight, wallX, fy + frameH + 0.12, doorZ
            ));
            for (const side of [-1, 1]) {
                group.add(this._mesh(
                    new THREE.BoxGeometry(wallThickness + 0.1, frameH, 0.32),
                    wallMat, wallX, fy + frameH * 0.5, doorZ + side * (doorGap * 0.5 + 0.08)
                ));
            }

            // Folhas de madeira FECHADAS (preenchem o vão da porta)
            const openDir = wallX > 0 ? -1 : 1;
            const leafW = doorGap * 0.48;
            for (const side of [-1, 1]) {
                const leaf = this._mesh(
                    new THREE.BoxGeometry(0.18, 3.15, leafW),
                    M.woodDark,
                    wallX + openDir * 0.12,
                    fy + 1.65,
                    doorZ + side * (leafW * 0.5 + 0.02)
                );
                // Sem rotação — porta fechada alinhada à parede
                group.add(leaf);
            }

            // Faixas de ferro na porta fechada
            group.add(this._mesh(
                new THREE.BoxGeometry(wallThickness + 0.15, 0.12, doorGap + 0.15),
                M.iron, wallX, fy + 1.7, doorZ
            ));
            group.add(this._mesh(
                new THREE.BoxGeometry(wallThickness + 0.15, 0.1, doorGap + 0.15),
                M.iron, wallX, fy + 2.6, doorZ
            ));
            // Maçaneta
            group.add(this._mesh(
                this._geos.sphere,
                M.bronze || M.iron,
                wallX + openDir * 0.28,
                fy + 1.7,
                doorZ + 0.15,
                0.12, 0.12, 0.12
            ));

            // Brilho sutil na porta (indica portal, mas visual fechado)
            const portalMat = isUp ? M.portalUp : M.portalDown;
            const portal = this._mesh(
                this._geos.plane, portalMat,
                wallX + openDir * 0.22, fy + 1.75, doorZ,
                doorGap * 0.7, 2.6, 1
            );
            portal.rotation.y = wallX > 0 ? -Math.PI / 2 : Math.PI / 2;
            portal.material = portalMat.clone();
            portal.material.opacity = 0.22;
            group.add(portal);
            this._anim.push({ type: 'portal', mesh: portal, phase: Math.random() * 4, isUp: isUp });

            const pLight = new THREE.PointLight(isUp ? 0x22d3ee : 0xf97316, 0.28, 6, 2);
            pLight.position.set(wallX + openDir * 0.5, fy + 2.0, doorZ);
            group.add(pLight);

            // Destino: centro do andar alvo
            const targetX = 0;
            const targetZ = 0;
            const targetY = F[targetFloor] + 0.1;

            this._doorColliders.push({
                x: wallX + openDir * 1.2,
                z: doorZ,
                radius: 1.8,
                type: 'teleport',
                floor: level,
                direction: direction,
                targetFloor: targetFloor,
                targetX: targetX,
                targetY: targetY,
                targetZ: targetZ,
                label: isUp
                    ? ('Subir para o ' + targetFloor + 'º andar')
                    : ('Descer para o ' + targetFloor + 'º andar')
            });
        }

        /**
         * Parede sul do 1º com vão + porta FECHADA (visual).
         * Colliders só nas laterais — o centro é o ponto de saída para o mapa3.
         */
        _exitDoorWall(group, fy, H, M, hd, T, hw) {
            const gap = 4.2;
            const wallW = hw * 2 + T * 2;
            const sideW = (wallW - gap) * 0.5;

            // Painéis de pedra à esquerda e direita do vão
            for (const side of [-1, 1]) {
                const sx = side * (gap * 0.5 + sideW * 0.5);
                group.add(this._mesh(
                    new THREE.BoxGeometry(sideW, H, T),
                    M.stone, sx, fy + H * 0.5, hd
                ));
                this._wallColliders.push({
                    x: sx, z: hd,
                    halfW: sideW * 0.52, halfD: T * 0.7,
                    type: 'wall', floor: 1
                });
            }

            // Lintol acima do vão
            group.add(this._mesh(
                new THREE.BoxGeometry(gap + 0.6, 1.0, T + 0.15),
                M.stoneDark, 0, fy + H - 0.5, hd
            ));

            // Moldura
            const doorH = 4.2;
            group.add(this._mesh(
                new THREE.BoxGeometry(gap + 0.4, 0.28, T + 0.12),
                M.stoneLight, 0, fy + doorH + 0.05, hd - 0.05
            ));
            for (const side of [-1, 1]) {
                group.add(this._mesh(
                    new THREE.BoxGeometry(0.28, doorH, T + 0.08),
                    M.stone, side * (gap * 0.5 - 0.05), fy + doorH * 0.5, hd - 0.05
                ));
            }

            // Folhas FECHADAS (só visual — jogador interage e sai)
            for (const side of [-1, 1]) {
                group.add(this._mesh(
                    new THREE.BoxGeometry(gap * 0.48, doorH - 0.15, 0.18),
                    M.woodDark,
                    side * (gap * 0.25),
                    fy + doorH * 0.5,
                    hd - 0.2
                ));
            }
            // Faixas de ferro + maçaneta
            group.add(this._mesh(
                new THREE.BoxGeometry(gap * 0.92, 0.12, 0.2),
                M.iron, 0, fy + doorH * 0.5, hd - 0.28
            ));
            group.add(this._mesh(
                new THREE.BoxGeometry(gap * 0.92, 0.1, 0.2),
                M.iron, 0, fy + 2.5, hd - 0.28
            ));
            group.add(this._mesh(
                this._geos.sphere, M.bronze || M.iron,
                0.22, fy + doorH * 0.48, hd - 0.4,
                0.14, 0.14, 0.14
            ));
        }

        // ========== CONTEÚDO DOS ANDARES ==========

        _buildHallAndThrone() {
            const group = this._addGroup('hall_throne', 1);
            const M = this._mats;
            const fy = F[1];
            const hd = this.cfg.hallD;

            group.add(this._mesh(
                new THREE.BoxGeometry(4.5, 0.06, hd * 1.4),
                M.carpet, 0, fy + 0.1, -1
            ));

            for (const pos of [[-6, -6], [6, -6], [-6, 4], [6, 4]]) {
                group.add(this._mesh(
                    new THREE.CylinderGeometry(0.5, 0.6, 5.5, 6),
                    M.stoneDark, pos[0], fy + 2.9, pos[1]
                ));
                this._baseColliders.push({ x: pos[0], z: pos[1], radius: 0.85, type: 'column' });
            }

            const baseZ = -hd + 4;
            group.add(this._mesh(new THREE.BoxGeometry(8, 0.6, 4), M.stone, 0, fy + 0.4, baseZ));
            this._baseColliders.push({ x: 0, z: baseZ, halfW: 4.2, halfD: 2.2, type: 'dais' });
            group.add(this._mesh(new THREE.BoxGeometry(2.2, 0.3, 1.5), M.wood, 0, fy + 1.2, baseZ - 0.5));
            group.add(this._mesh(new THREE.BoxGeometry(2.4, 3.2, 0.35), M.woodDark, 0, fy + 2.6, baseZ - 1.2));
            group.add(this._mesh(this._geos.cone, M.woodDark, 0, fy + 4.6, baseZ - 1.2, 0.9, 1.2, 0.45));
            this._baseColliders.push({ x: 0, z: baseZ - 0.5, radius: 1.8, type: 'throne' });

            for (const sx of [-3, 3]) {
                group.add(this._mesh(this._geos.cyl, M.iron, sx, fy + 4, baseZ - 1.8, 0.08, 3.5, 0.08));
                const flag = new THREE.Mesh(this._geos.plane, M.banner);
                flag.position.set(sx + 0.7, fy + 4.2, baseZ - 1.8);
                flag.scale.set(1.4, 2.2, 1);
                group.add(flag);
            }

            this.createTorch(-5, fy + 3.5, baseZ + 1, group, true);
            this.createTorch(5, fy + 3.5, baseZ + 1, group, false);
            this._makeChest(0.95, -7, fy, 8, group);
        }

        _buildTreasury(fy) {
            const group = this._addGroup('treasury', 2);
            const M = this._mats;
            group.add(this._mesh(new THREE.BoxGeometry(5, 0.08, 8), M.carpet, 0, fy + 0.12, 0));
            for (let i = 0; i < 6; i++) {
                const gx = (i % 3 - 1) * 4;
                const gz = (Math.floor(i / 3) - 0.5) * 5;
                group.add(this._mesh(this._geos.sphere, M.gold, gx, fy + 0.45, gz, 0.9, 0.45, 0.9));
            }
            this._makeChest(1.1, -6, fy, -8, group);
            this._makeChest(1.0, 6, fy, -8, group);
            this._makeChest(1.2, 0, fy, 9, group);
            group.add(this._mesh(this._geos.cyl, M.stoneDark, 0, fy + 0.9, -5, 0.9, 1.5, 0.9));
            const gem = this._mesh(this._geos.sphere, M.crystal, 0, fy + 1.9, -5, 0.45, 0.45, 0.45);
            group.add(gem);
            this._anim.push({ type: 'orb', mesh: gem, phase: 0, baseY: fy + 1.9 });
            const light = new THREE.PointLight(0xfbbf24, 0.45, 11, 2);
            light.position.set(0, fy + 3, 0);
            group.add(light);
        }

        _buildLibrary(fy) {
            const group = this._addGroup('library', 3);
            const M = this._mats;
            const hw = this.cfg.hallW;
            const hd = this.cfg.hallD;
            const shelves = [
                { x: 0, z: -hd + 1.4, w: 18, d: 0.6 },
                { x: -hw + 1.3, z: 0, w: 0.6, d: 16 },
                { x: 0, z: hd - 1.4, w: 12, d: 0.6 }
            ];
            for (let si = 0; si < shelves.length; si++) {
                const s = shelves[si];
                group.add(this._mesh(new THREE.BoxGeometry(s.w, 4.5, s.d), M.woodDark, s.x, fy + 2.4, s.z));
                for (let b = 0; b < 5; b++) {
                    const bx = s.x + (s.w > 2 ? (b - 2) * 2 : 0);
                    const bz = s.z + (s.d > 2 ? (b - 2) * 1.5 : 0);
                    group.add(this._mesh(
                        this._geos.box, b % 2 ? M.book : M.bronze,
                        bx, fy + 1.3 + (b % 3) * 0.85, bz, 0.3, 0.5, 0.4
                    ));
                }
            }
            group.add(this._mesh(this._geos.box, M.wood, 0, fy + 1.0, 2, 3.5, 0.18, 1.6));
            this._makeChest(0.9, 5, fy, 8, group);
            const light = new THREE.PointLight(0xffcc88, 0.4, 11, 2);
            light.position.set(0, fy + 4, 0);
            group.add(light);
        }

        _buildArmory(fy) {
            const group = this._addGroup('armory', 4);
            const M = this._mats;
            for (let i = 0; i < 4; i++) {
                const z = -8 + i * 4;
                group.add(this._mesh(this._geos.box, M.iron, -10, fy + 2.5, z, 0.08, 1.2, 0.04));
                group.add(this._mesh(this._geos.box, M.iron, 10, fy + 2.3, z, 0.12, 0.9, 0.7));
            }
            for (let i = 0; i < 4; i++) {
                group.add(this._mesh(this._geos.cyl, M.wood, -6 + i * 0.4, fy + 2.2, 10, 0.07, 2.6, 0.07));
            }
            group.add(this._mesh(this._geos.box, M.iron, 5, fy + 2.3, -8, 0.85, 1.1, 0.5));
            group.add(this._mesh(this._geos.sphere, M.iron, 5, fy + 3.2, -8, 0.38, 0.38, 0.42));
            for (const pos of [[-8, 6], [7, 8]]) {
                group.add(this._mesh(this._geos.cyl, M.wood, pos[0], fy + 0.55, pos[1], 1.0, 1.1, 1.0));
            }
            this._makeChest(1.0, 0, fy, -10, group);
            const light = new THREE.PointLight(0xff8844, 0.35, 10, 2);
            light.position.set(0, fy + 4, 0);
            group.add(light);
        }

        _buildMagicRoom(fy) {
            const group = this._addGroup('magic_room', 5);
            const M = this._mats;
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const rune = new THREE.Mesh(this._geos.plane, M.magic);
                rune.rotation.x = -Math.PI / 2;
                rune.position.set(Math.cos(a) * 4, fy + 0.2, Math.sin(a) * 4);
                rune.scale.set(0.65, 0.65, 1);
                group.add(rune);
            }
            group.add(this._mesh(this._geos.cyl, M.stoneDark, 0, fy + 0.8, 0, 1.1, 1.4, 1.1));
            const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), M.crystal);
            crystal.position.set(0, fy + 2.3, 0);
            crystal.userData = { type: 'crystal', name: 'Cristal Arcano', baseY: fy + 2.3 };
            group.add(crystal);
            this.collectibles.push(crystal);
            this._anim.push({ type: 'crystal', mesh: crystal, phase: 0, baseY: fy + 2.3 });
            const cLight = new THREE.PointLight(0xa78bfa, 0.75, 11, 2);
            cLight.position.set(0, fy + 2.5, 0);
            group.add(cLight);
            this._anim.push({ type: 'crystalLight', light: cLight, phase: 0 });
            for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
                const px = Math.cos(a) * 8;
                const pz = Math.sin(a) * 8;
                group.add(this._mesh(this._geos.cyl, M.stoneDark, px, fy + 2.5, pz, 0.5, 4.5, 0.5));
                const orb = this._mesh(this._geos.sphere, M.magic, px, fy + 5, pz, 0.3, 0.3, 0.3);
                group.add(orb);
                this._anim.push({ type: 'orb', mesh: orb, phase: a, baseY: fy + 5 });
            }
            this._makeChest(1.0, -7, fy, 8, group);
        }

        _buildBossRoom(fy) {
            const group = this._addGroup('boss_king', 6);
            const M = this._mats;
            group.add(this._mesh(new THREE.CylinderGeometry(9, 9.5, 0.4, 16), M.stone, 0, fy + 0.15, 0));
            group.add(this._mesh(this._geos.box, M.stoneWorn, 0, fy + 1.0, -4, 4, 1.5, 3.5));
            group.add(this._mesh(this._geos.box, M.woodDark, 0, fy + 2.3, -5, 2.4, 2.8, 0.4));
            group.add(this._mesh(this._geos.cone, M.gold, 0, fy + 4.2, -5, 0.7, 1.0, 0.4));
            for (const sx of [-6, 6]) {
                group.add(this._mesh(this._geos.cyl, M.iron, sx, fy + 4, -6, 0.08, 4, 0.08));
                const flag = new THREE.Mesh(this._geos.plane, M.banner);
                flag.position.set(sx + Math.sign(sx) * 0.7, fy + 4.5, -6);
                flag.scale.set(1.5, 2.5, 1);
                group.add(flag);
            }
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                const rune = new THREE.Mesh(
                    this._geos.plane,
                    new THREE.MeshStandardMaterial({
                        color: 0x7f1d1d, emissive: 0x450a0a, emissiveIntensity: 0.4,
                        transparent: true, opacity: 0.65, side: THREE.DoubleSide
                    })
                );
                rune.rotation.x = -Math.PI / 2;
                rune.position.set(Math.cos(a) * 5, fy + 0.4, Math.sin(a) * 5);
                rune.scale.set(0.65, 0.65, 1);
                group.add(rune);
            }
            for (const sx of [-7, 7]) {
                group.add(this._mesh(this._geos.box, M.stone, sx, fy + 1.5, 3, 0.7, 1.5, 0.5));
                group.add(this._mesh(this._geos.sphere, M.stone, sx, fy + 2.6, 3, 0.4, 0.45, 0.4));
            }
            this.createTorch(-8, fy + 3.5, -2, group, true);
            this.createTorch(8, fy + 3.5, -2, group, false);
            const bossLight = new THREE.PointLight(0x7f1d1d, 0.65, 14, 2);
            bossLight.position.set(0, fy + 5, 0);
            group.add(bossLight);
            this._makeChest(1.25, 0, fy, 8, group);
        }

        _setupAtmosphere() {
            this.scene.fog = new THREE.FogExp2(0x0c0a09, 0.016);
            this.scene.background = new THREE.Color(0x0a0908);
        }

        /**
         * colliders = objetos + paredes do andar ativo + portas de teleporte.
         */
        _refreshColliders() {
            const fl = this._playerFloor;
            const floorDoors = this._doorColliders.filter(d => d.floor === fl);
            const floorWalls = this._wallColliders.filter(c => c.floor === fl);
            // baseColliders só do 1º (colunas, trono) — só quando no 1º
            const base = fl === 1 ? this._baseColliders : [];
            this.colliders = base.concat(floorWalls).concat(floorDoors);
        }

        getTeleportDoors() {
            return this._doorColliders.filter(d => d.floor === this._playerFloor);
        }

        /** Porta sul do 1º andar → volta ao pátio (mapa3) */
        getExitDoorPoint() {
            if (this._playerFloor !== 1) return null;
            const hd = this.cfg.hallD;
            return {
                x: 0,
                z: hd - 1.5,
                radius: 2.6,
                label: 'Sair do Keep',
                type: 'castle_exit_door'
            };
        }

        getInteriorSpawns() {
            return [
                { x: -5, z: 4, type: 'skeleton' },
                { x: 4, z: -6, type: 'skeleton' },
                { x: -4, z: 5, type: 'skeleton' },
                { x: 5, z: -4, type: 'skeleton' },
                { x: 0, z: 2, type: 'skeleton' },
                { x: -3, z: 6, type: 'skeleton' },
                { x: 3, z: -8, type: 'skeleton' }
            ];
        }

        getEntrySpawn() {
            return { x: 0, z: this.cfg.hallD - 4, y: F[1] };
        }

        update(time) {
            this._updSkip++;
            if (this._updSkip < 2) return;
            this._updSkip = 0;

            // Sincroniza andar com a altura real do jogador
            let floorChanged = false;
            try {
                if (typeof Game !== 'undefined' && Game.player && Game.player.position) {
                    const newFloor = this._floorFromY(Game.player.position.y);
                    if (newFloor !== this._playerFloor) {
                        this._playerFloor = newFloor;
                        floorChanged = true;
                    }
                }
            } catch (e) {}

            if (floorChanged) {
                this._refreshColliders();
            }

            for (let i = 0; i < this._anim.length; i++) {
                const a = this._anim[i];
                if (a.type === 'torch') {
                    if (a.mesh && a.mesh.material) {
                        a.mesh.material.emissiveIntensity = 0.75 + Math.sin(time * 5 + a.phase) * 0.35;
                    }
                    if (a.light) a.light.intensity = 0.5 + Math.sin(time * 4 + a.phase) * 0.18;
                } else if (a.type === 'crystal' && a.mesh) {
                    a.mesh.rotation.y = time * 1.3;
                    a.mesh.position.y = a.baseY + Math.sin(time * 2) * 0.15;
                } else if (a.type === 'crystalLight' && a.light) {
                    a.light.intensity = 0.6 + Math.sin(time * 2.5) * 0.18;
                } else if (a.type === 'orb' && a.mesh) {
                    a.mesh.position.y = a.baseY + Math.sin(time * 2 + a.phase) * 0.1;
                } else if (a.type === 'portal' && a.mesh && a.mesh.material) {
                    a.mesh.material.emissiveIntensity = 0.5 + Math.sin(time * 3 + a.phase) * 0.25;
                    a.mesh.material.opacity = 0.45 + Math.sin(time * 2.2 + a.phase) * 0.12;
                }
            }

            for (let i = 0; i < this.chests.length; i++) {
                const ch = this.chests[i];
                if (!ch || !ch.userData || ch.userData.opened) continue;
                const base = ch.userData.baseY != null ? ch.userData.baseY : ch.position.y;
                ch.position.y = base + Math.sin(time * 1.5 + i) * 0.03;
            }
        }

        clampPosition(pos) {
            const b = this.cfg.bound;
            pos.x = Math.max(-b, Math.min(b, pos.x));
            pos.z = Math.max(-b, Math.min(b, pos.z));
            return pos;
        }

        dispose() {
            const disposeMesh = function (obj) {
                if (!obj) return;
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(function (m) { m.dispose(); });
                    else obj.material.dispose();
                }
            };
            if (this.terrainMesh) {
                this.scene.remove(this.terrainMesh);
                disposeMesh(this.terrainMesh);
                this.terrainMesh = null;
            }
            for (let i = 0; i < this._groups.length; i++) {
                const g = this._groups[i];
                this.scene.remove(g);
                if (g.traverse) g.traverse(disposeMesh);
                else disposeMesh(g);
            }
            this._groups.length = 0;
            for (let i = 0; i < this.collectibles.length; i++) {
                this.scene.remove(this.collectibles[i]);
                disposeMesh(this.collectibles[i]);
            }
            this.collectibles.length = 0;
            this.chests.length = 0;
            this.colliders.length = 0;
            this._baseColliders.length = 0;
            this._doorColliders.length = 0;
            this._wallColliders.length = 0;
            this._embers = [];
            this._anim = [];
            this._loadedFloors = {};
            this._loadingFloor = null;
            this._activeFloor = null;
            if (this._mats) {
                const vals = Object.keys(this._mats);
                for (let i = 0; i < vals.length; i++) {
                    try { this._mats[vals[i]].dispose(); } catch (e) {}
                }
                this._mats = null;
            }
            if (this._textures) {
                for (let i = 0; i < this._textures.length; i++) {
                    try { this._textures[i].dispose(); } catch (e) {}
                }
                this._textures = null;
            }
            if (this._geos) {
                const vals = Object.keys(this._geos);
                for (let i = 0; i < vals.length; i++) {
                    try { this._geos[vals[i]].dispose(); } catch (e) {}
                }
                this._geos = null;
            }
            this._built = false;
        }
    }

    global.WorldCastleInterior = WorldCastleInterior;
})(typeof window !== 'undefined' ? window : globalThis);
