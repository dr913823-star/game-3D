/**
 * anciao.js — Sistema de NPCs da vila
 * Profissões, patrulhas, olhar para o jogador e diálogos únicos
 *
 * Depende de: THREE (global)
 * API:
 *   const npcs = new NPCManager(scene, world, options);
 *   npcs.update(dt, playerPosition);
 *   npcs.getDialogueList(); // array compatível com game.html
 *   npcs.dispose();
 *
 * Compat: ElderNPC ainda existe (Ancião Marcus isolado).
 */

(function (global) {
    'use strict';

    // -------------------------------------------------------------------------
    // DEFINIÇÕES DE NPCs
    // -------------------------------------------------------------------------
    // Rotas no centro / caminhos entre casas (evitam colisores das casas)
    // Rotas pré-definidas em áreas abertas (praça / caminhos), longe de casas e lojas.
    // Se surgir obstáculo no caminho, o NPC para ou desvia um passo e segue.
    const NPC_DEFS = [
        {
            id: 'npc_marcus',
            name: 'Ancião Marcus',
            title: 'Guardião da Vila',
            profession: 'elder',
            dialogue:
                'Saudações, viajante! Os goblins infestam o vale ao norte. Derrote três e trarei recompensas. Cuidado também com a Besta das Sombras no sul...',
            home: { x: -4, z: -4 },
            patrolPoints: [
                { x: -4, z: -4 },
                { x: 4, z: -4 },
                { x: 4, z: 4 },
                { x: -4, z: 4 }
            ],
            walkSpeed: 1.45,
            scale: 1.0
        },
        {
            id: 'npc_fazendeiro',
            name: 'Tomás',
            title: 'Fazendeiro',
            profession: 'farmer',
            dialogue:
                'A colheita está boa este ano, graças aos espíritos da terra. Se vir lobos perto das plantações ao leste, me avise. Meu espantalho não assusta mais ninguém!',
            home: { x: 2, z: -12 },
            patrolPoints: [
                { x: 2, z: -12 },
                { x: -2, z: -12 },
                { x: -2, z: -8 },
                { x: 2, z: -8 }
            ],
            walkSpeed: 1.55,
            scale: 1.0
        },
        {
            id: 'npc_guarda',
            name: 'Capitão Roric',
            title: 'Guarda da Vila',
            profession: 'guard',
            dialogue:
                'Mantenha a espada afiada, aventureiro. A muralha protege a vila, mas os monstros do vale não dormem. Se ouvir o sino, corra para o poço central.',
            home: { x: 0, z: 8 },
            patrolPoints: [
                { x: 0, z: 8 },
                { x: 5, z: 6 },
                { x: 0, z: 4 },
                { x: -5, z: 6 }
            ],
            walkSpeed: 1.85,
            scale: 1.05
        },
        {
            id: 'npc_ferreiro',
            name: 'Borin',
            title: 'Ferreiro',
            profession: 'blacksmith',
            dialogue:
                'Minha forja nunca esfria! Traga minério do norte e forjo lâminas dignas de heróis. Essa sua arma... hum, já vi melhores. Volte quando tiver ouro de sobra.',
            home: { x: -10, z: 4 },
            patrolPoints: [
                { x: -10, z: 4 },
                { x: -8, z: 2 },
                { x: -6, z: 4 },
                { x: -8, z: 6 }
            ],
            walkSpeed: 1.35,
            scale: 1.08
        },
        {
            id: 'npc_curandeira',
            name: 'Elara',
            title: 'Curandeira',
            profession: 'healer',
            dialogue:
                'As feridas do corpo e da alma encontram alívio aqui. Colho ervas perto do rio — mas cuidado com a água escura. Se precisar de poções, é só pedir.',
            home: { x: -6, z: -6 },
            patrolPoints: [
                { x: -6, z: -6 },
                { x: -8, z: -4 },
                { x: -6, z: -2 },
                { x: -4, z: -4 }
            ],
            walkSpeed: 1.4,
            scale: 0.95
        },
        {
            id: 'npc_comerciante',
            name: 'Vessa',
            title: 'Comerciante',
            profession: 'merchant',
            dialogue:
                'Bem-vindo à minha tenda! Especiarias do sul, tecidos élficos, e um ou outro artefato... misterioso. Tudo tem preço — e eu sempre tenho o melhor.',
            home: { x: 6, z: 2 },
            patrolPoints: [
                { x: 6, z: 2 },
                { x: 8, z: 0 },
                { x: 6, z: -2 },
                { x: 4, z: 0 }
            ],
            walkSpeed: 1.5,
            scale: 0.98
        },
        {
            id: 'npc_crianca',
            name: 'Lila',
            title: 'Criança da Vila',
            profession: 'child',
            dialogue:
                'Você é um herói de verdade? Eu vi um goblin ontem perto da cerca! ...Tá, talvez fosse só a sombra do espantalho. Quer brincar de esconde-esconde?',
            home: { x: 2, z: 0 },
            patrolPoints: [
                { x: 2, z: 0 },
                { x: 0, z: 3 },
                { x: -2, z: 0 },
                { x: 0, z: -3 }
            ],
            walkSpeed: 2.2,
            scale: 0.72
        },
        // Aldeões — rotas curtas na frente das casas (lado da praça)
        {
            id: 'npc_aldeao_1',
            name: 'Greta',
            title: 'Aldeã',
            profession: 'villager',
            dialogue: 'Bom dia! As casas novas deixaram a vila mais viva. Se precisar de farinha, o forno da praça ainda funciona.',
            home: { x: 12, z: -8 },
            patrolPoints: [
                { x: 12, z: -8 },
                { x: 10, z: -6 },
                { x: 12, z: -4 },
                { x: 14, z: -6 }
            ],
            walkSpeed: 1.4,
            scale: 0.96,
            clothColor: 0x9a3412,
            accentColor: 0x7c2d12,
            hairColor: 0x78350f
        },
        {
            id: 'npc_aldeao_2',
            name: 'Piet',
            title: 'Aldeão',
            profession: 'villager',
            dialogue: 'Trabalho no quintal desde o amanhecer. Os goblins andam quietos... demais. Fique de olho na cerca sul.',
            home: { x: 4, z: -14 },
            patrolPoints: [
                { x: 4, z: -14 },
                { x: 2, z: -12 },
                { x: 4, z: -10 },
                { x: 6, z: -12 }
            ],
            walkSpeed: 1.45,
            scale: 1.02,
            clothColor: 0x3f6212,
            accentColor: 0x365314,
            hairColor: 0x1c1917
        },
        {
            id: 'npc_aldeao_3',
            name: 'Mara',
            title: 'Aldeã',
            profession: 'villager',
            dialogue: 'Trouxe ervas do rio para a Elara. Cuidado com a correnteza — a água esconde pedras traiçoeiras.',
            home: { x: -4, z: -14 },
            patrolPoints: [
                { x: -4, z: -14 },
                { x: -2, z: -12 },
                { x: -4, z: -10 },
                { x: -6, z: -12 }
            ],
            walkSpeed: 1.45,
            scale: 0.94,
            clothColor: 0x1d4ed8,
            accentColor: 0x1e3a8a,
            hairColor: 0x44403c
        },
        {
            id: 'npc_aldeao_4',
            name: 'Jonas',
            title: 'Aldeão',
            profession: 'villager',
            dialogue: 'Consertei o telhado da casa do canto. Se ouvir barulho à noite, é só o vento... espero.',
            home: { x: -12, z: -8 },
            patrolPoints: [
                { x: -12, z: -8 },
                { x: -10, z: -6 },
                { x: -12, z: -4 },
                { x: -14, z: -6 }
            ],
            walkSpeed: 1.35,
            scale: 1.05,
            clothColor: 0x57534e,
            accentColor: 0x292524,
            hairColor: 0x292524
        }
    ];

    // MESH — delega para arquivos por profissão (ferreiro.js, curandeira.js, etc.)
    // -------------------------------------------------------------------------
    function createNPCNameSprite(name, title) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 256, 64);

        ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const tw = Math.min(ctx.measureText(name).width + 24, 240);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, (256 - tw) / 2, 8, tw, 28, 6);
        ctx.fill();

        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 3;
        ctx.fillStyle = '#fef3c7';
        ctx.fillText(name, 128, 22);

        ctx.font = '13px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.shadowBlur = 2;
        ctx.fillText(title, 128, 48);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), mat);
        mesh.renderOrder = 10;
        return mesh;
    }

    // Expõe para os arquivos de cada NPC
    if (typeof window !== 'undefined') {
        window.createNPCNameSprite = createNPCNameSprite;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function createNPCMesh(def) {
        const creators = (typeof window !== 'undefined' && window.NPC_MESH_CREATORS)
            ? window.NPC_MESH_CREATORS
            : (globalThis.NPC_MESH_CREATORS || {});
        const fn = creators[def.profession];
        if (typeof fn === 'function') {
            return fn(def);
        }
        // Fallback mínimo caso algum arquivo não carregue
        console.warn('[NPC] Sem mesh para profissão:', def.profession);
        const s = def.scale || 1;
        const group = new THREE.Group();
        group.name = def.id;
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.35 * s, 1.0 * s, 6, 10),
            new THREE.MeshStandardMaterial({ color: 0x64748b })
        );
        body.position.y = 1.0 * s;
        group.add(body);
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.28 * s, 12, 10),
            new THREE.MeshStandardMaterial({ color: 0xe0b090 })
        );
        head.position.y = 1.9 * s;
        group.add(head);
        const nameLabel = createNPCNameSprite(def.name, def.title);
        nameLabel.position.y = 2.35 * s;
        group.add(nameLabel);
        return {
            group, torso: body, head,
            leftArm: body, rightArm: body, leftLeg: body, rightLeg: body,
            nameLabel, scale: s, headBaseY: 1.9 * s, torsoBaseY: 1.0 * s
        };
    }

    // -------------------------------------------------------------------------
    // VILLAGE NPC (unidade)
    // -------------------------------------------------------------------------
    class VillageNPC {
        constructor(scene, world, def) {
            this.scene = scene;
            this.world = world;
            this.def = def;

            this.id = def.id;
            this.name = def.name;
            this.title = def.title;
            this.dialogue = def.dialogue;
            this.profession = def.profession;

            this.position = new THREE.Vector3(
                def.home.x,
                world.getTerrainHeight(def.home.x, def.home.z),
                def.home.z
            );

            this.state = 'IDLE';
            this.patrolIndex = 0;
            this.idleTimer = 1 + Math.random() * 3;
            this.animTime = Math.random() * 10;
            this.facing = Math.random() * Math.PI * 2;

            this.stopDistance = 3.2;
            this.arriveDistance = 0.55;
            this.idleWaitMin = 2.0;
            this.idleWaitMax = 5.0;
            this.walkSpeed = def.walkSpeed || 1.6;
            this.bodyRadius = 0.55;
            this.stuckTimer = 0;
            this._lastX = this.position.x;
            this._lastZ = this.position.z;
            this._steerSide = 1;
            this._moveNx = 0;
            this._moveNz = 1;
            this.blockWait = 0;

            this.parts = createNPCMesh(def);
            this.group = this.parts.group;
            this.mesh = this.group;
            this._resolveColliders();
            // Garante spawn fora de colisores (casas etc.)
            this._pushOutOfColliders(8);
            this.position.y = world.getTerrainHeight(this.position.x, this.position.z);
            this.group.position.copy(this.position);
            this.scene.add(this.group);
        }

        update(dt, playerPos, camPos) {
            if (playerPos) {
                const dist = this.position.distanceTo(playerPos);
                if (dist < this.stopDistance) {
                    this.state = 'TALK';
                    this._lookAt(playerPos.x, playerPos.z, dt, 4);
                    this._animateIdle(dt);
                    this._apply(camPos);
                    return;
                }
            }

            if (this.state === 'TALK') {
                this.state = 'IDLE';
                this.idleTimer = 0.6 + Math.random();
            }

            if (this.state === 'IDLE') {
                this.idleTimer -= dt;
                this._animateIdle(dt);
                if (this.idleTimer <= 0) {
                    this.state = 'WALK';
                    this.patrolIndex = (this.patrolIndex + 1) % this.def.patrolPoints.length;
                }
            } else if (this.state === 'WALK') {
                const target = this.def.patrolPoints[this.patrolIndex];
                const dx = target.x - this.position.x;
                const dz = target.z - this.position.z;
                const dist = Math.hypot(dx, dz);

                if (dist < this.arriveDistance) {
                    this.state = 'IDLE';
                    this.stuckTimer = 0;
                    this.blockWait = 0;
                    this.idleTimer =
                        this.idleWaitMin + Math.random() * (this.idleWaitMax - this.idleWaitMin);
                    this._animateIdle(dt);
                } else {
                    let nx = dx / dist;
                    let nz = dz / dist;

                    // Passo à frente na rota
                    const step = this.walkSpeed * dt;
                    const nextX = this.position.x + nx * step * 2.5;
                    const nextZ = this.position.z + nz * step * 2.5;

                    if (this._pointBlocked(nextX, nextZ, 0.15)) {
                        // Obstáculo na rota: tenta 1 desvio lateral; senão para
                        const side = this._steerSide || 1;
                        const lx = -nz * side;
                        const lz = nx * side;
                        const sideX = this.position.x + lx * 1.1;
                        const sideZ = this.position.z + lz * 1.1;
                        if (!this._pointBlocked(sideX, sideZ, 0.1)) {
                            // Desvia um passo para o lado e continua
                            this.position.x += lx * this.walkSpeed * dt;
                            this.position.z += lz * this.walkSpeed * dt;
                            this._resolveColliders();
                            this.position.y = this.world.getTerrainHeight(this.position.x, this.position.z);
                            this._lookAt(this.position.x + lx, this.position.z + lz, dt, 5);
                            this._animateWalk(dt);
                        } else {
                            // Para, espera e depois pula o ponto da rota
                            this.blockWait = (this.blockWait || 0) + dt;
                            this._animateIdle(dt);
                            if (this.blockWait > 1.0) {
                                this.blockWait = 0;
                                this._steerSide = -side;
                                this.patrolIndex = (this.patrolIndex + 1) % this.def.patrolPoints.length;
                                this.state = 'IDLE';
                                this.idleTimer = 0.5 + Math.random() * 0.5;
                            }
                        }
                    } else {
                        // Rota livre — segue o caminho
                        this.blockWait = 0;
                        this.position.x += nx * this.walkSpeed * dt;
                        this.position.z += nz * this.walkSpeed * dt;
                        this._resolveColliders();
                        this.position.y = this.world.getTerrainHeight(this.position.x, this.position.z);
                        this._lookAt(target.x, target.z, dt, 5.5);
                        this._animateWalk(dt);
                    }
                }
            }

            this._apply(camPos);
        }

        /** Impede NPC de atravessar casas, poço e outros colisores */
        _resolveColliders() {
            const colliders = this.world && this.world.colliders;
            if (!colliders || !colliders.length) return;
            const bodyR = this.bodyRadius || 0.55;
            for (let i = 0, len = colliders.length; i < len; i++) {
                const c = colliders[i];
                if (!c || c.type === 'teleport') continue;
                // Caixa AABB (lojas / casas com halfW)
                if (c.halfW != null && c.halfD != null) {
                    const nearestX = Math.max(c.x - c.halfW, Math.min(this.position.x, c.x + c.halfW));
                    const nearestZ = Math.max(c.z - c.halfD, Math.min(this.position.z, c.z + c.halfD));
                    let dx = this.position.x - nearestX;
                    let dz = this.position.z - nearestZ;
                    let dist = Math.hypot(dx, dz);
                    if (dist < bodyR) {
                        if (dist < 0.001) {
                            const penX = c.halfW + bodyR - Math.abs(this.position.x - c.x);
                            const penZ = c.halfD + bodyR - Math.abs(this.position.z - c.z);
                            if (penX < penZ) {
                                this.position.x = c.x + Math.sign(this.position.x - c.x || 1) * (c.halfW + bodyR);
                            } else {
                                this.position.z = c.z + Math.sign(this.position.z - c.z || 1) * (c.halfD + bodyR);
                            }
                        } else {
                            const o = bodyR - dist;
                            this.position.x += (dx / dist) * o;
                            this.position.z += (dz / dist) * o;
                        }
                    }
                    continue;
                }
                // Círculo
                const dx = this.position.x - c.x;
                const dz = this.position.z - c.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const minD = (c.radius || 1) + bodyR;
                if (dist < minD && dist > 0.001) {
                    const o = minD - dist;
                    this.position.x += (dx / dist) * o;
                    this.position.z += (dz / dist) * o;
                } else if (dist <= 0.001) {
                    this.position.x += minD;
                }
            }
        }

        /** Empurra o NPC para fora de colisores (spawn / recuperação) */
        _pushOutOfColliders(iterations) {
            const n = iterations || 6;
            for (let k = 0; k < n; k++) this._resolveColliders();
        }

        /**
         * Raio efetivo de um colisor (casas/lojas maiores).
         */
        _colliderRadius(c) {
            if (!c) return 1;
            if (c.halfW != null && c.halfD != null) {
                return Math.hypot(c.halfW, c.halfD);
            }
            let r = c.radius || 1;
            // Casas/lojas: margem extra para desviar antes de encostar
            const t = c.type || '';
            if (t === 'house' || t.indexOf('shop') >= 0 || t === 'blacksmith_shop') {
                r += 0.6;
            }
            return r;
        }

        /**
         * True se o ponto (x,z) colide com algum obstáculo sólido.
         */
        _pointBlocked(x, z, margin) {
            const colliders = this.world && this.world.colliders;
            if (!colliders) return false;
            const bodyR = (this.bodyRadius || 0.55) + (margin || 0);
            for (let i = 0; i < colliders.length; i++) {
                const c = colliders[i];
                if (!c || c.type === 'teleport' || c.type === 'fence_gate') continue;
                if (c.halfW != null && c.halfD != null) {
                    const nearestX = Math.max(c.x - c.halfW, Math.min(x, c.x + c.halfW));
                    const nearestZ = Math.max(c.z - c.halfD, Math.min(z, c.z + c.halfD));
                    if (Math.hypot(x - nearestX, z - nearestZ) < bodyR) return true;
                    continue;
                }
                const cr = this._colliderRadius(c);
                if (Math.hypot(x - c.x, z - c.z) < cr + bodyR) return true;
            }
            return false;
        }

        /**
         * Desvia de casas/obstáculos com sondas em leque.
         * Retorna vetor unitário {x,z}.
         */
        _steerAroundObstacles(nx, nz) {
            const colliders = this.world && this.world.colliders;
            if (!colliders || !colliders.length) return { x: nx, z: nz };

            const bodyR = this.bodyRadius || 0.55;
            const px = this.position.x;
            const pz = this.position.z;

            // Obstáculo mais próximo no caminho (até ~7u)
            let near = null;
            let nearDist = 8;
            for (let i = 0; i < colliders.length; i++) {
                const c = colliders[i];
                if (!c || c.type === 'teleport' || c.type === 'fence_gate') continue;
                // Ignora postes finos de cerca isolados no desvio longo
                const t = c.type || '';
                if (t === 'fence' && (c.radius || 1) < 1.2) continue;

                const cr = this._colliderRadius(c);
                const dx = c.x - px;
                const dz = c.z - pz;
                const dist = Math.hypot(dx, dz);
                // Só considera o que está à frente / no caminho
                const ahead = (dx * nx + dz * nz);
                if (ahead < -0.5) continue;
                const clearance = dist - cr - bodyR;
                if (clearance < 5.5 && dist < nearDist + cr) {
                    nearDist = dist;
                    near = { c, cr, dx, dz, dist, clearance, ahead };
                }
            }

            // Caminho livre
            if (!near || near.clearance > 2.8) {
                // Ainda valida um passo à frente
                if (!this._pointBlocked(px + nx * 1.4, pz + nz * 1.4, 0.15)) {
                    return { x: nx, z: nz };
                }
            }

            // Sondas em leque: frente, ±25°, ±50°, ±80°, ±110°
            const angles = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 1.9, -1.9];
            // Preferir o lado já escolhido
            angles.sort((a, b) => {
                const pa = a === 0 ? 0 : (Math.sign(a) === this._steerSide ? Math.abs(a) : Math.abs(a) + 3);
                const pb = b === 0 ? 0 : (Math.sign(b) === this._steerSide ? Math.abs(b) : Math.abs(b) + 3);
                return pa - pb;
            });

            let bestDir = null;
            let bestScore = -1e9;

            for (let k = 0; k < angles.length; k++) {
                const a = angles[k];
                const ca = Math.cos(a);
                const sa = Math.sin(a);
                // Rotaciona (nx,nz)
                const rx = nx * ca - nz * sa;
                const rz = nx * sa + nz * ca;

                // Testa 3 pontos ao longo da direção
                let blocked = false;
                for (const step of [1.2, 2.4, 3.6]) {
                    if (this._pointBlocked(px + rx * step, pz + rz * step, 0.2)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) continue;

                // Score: progresso em direção ao alvo + leve preferência pelo lado estável
                const progress = rx * nx + rz * nz;
                const sideBonus = (a !== 0 && Math.sign(a) === this._steerSide) ? 0.15 : 0;
                const score = progress + sideBonus - Math.abs(a) * 0.05;
                if (score > bestScore) {
                    bestScore = score;
                    bestDir = { x: rx, z: rz, angle: a };
                }
            }

            if (bestDir) {
                if (bestDir.angle !== 0) {
                    this._steerSide = Math.sign(bestDir.angle) || this._steerSide;
                }
                return { x: bestDir.x, z: bestDir.z };
            }

            // Fallback: afastamento radial do obstáculo mais próximo
            if (near) {
                let ox = near.dist > 0.001 ? -near.dx / near.dist : 1;
                let oz = near.dist > 0.001 ? -near.dz / near.dist : 0;
                let tx = -oz * this._steerSide;
                let tz = ox * this._steerSide;
                let sx = ox * 0.4 + tx * 0.8;
                let sz = oz * 0.4 + tz * 0.8;
                const len = Math.hypot(sx, sz) || 1;
                return { x: sx / len, z: sz / len };
            }

            return { x: nx, z: nz };
        }

        _lookAt(tx, tz, dt, turnSpeed) {
            const speed = turnSpeed != null ? turnSpeed : 6;
            const targetYaw = Math.atan2(tx - this.position.x, tz - this.position.z);
            let diff = targetYaw - this.facing;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            // Zona morta: não corrige micro-diferenças (evita tremor/spin)
            if (Math.abs(diff) < 0.04) return;
            const maxStep = speed * dt;
            if (diff > maxStep) diff = maxStep;
            if (diff < -maxStep) diff = -maxStep;
            this.facing += diff;
        }

        _animateWalk(dt) {
            const p = this.parts;
            this.animTime += dt * 7.5;
            const s = Math.sin(this.animTime);
            p.leftLeg.rotation.x = s * 0.55;
            p.rightLeg.rotation.x = -s * 0.55;
            p.leftArm.rotation.x = -s * 0.35;
            p.rightArm.rotation.x = s * 0.35;
            const bob = Math.abs(Math.sin(this.animTime * 2)) * 0.03;
            p.torso.position.y = p.torsoBaseY + bob;
            p.head.position.y = p.headBaseY + bob * 0.8;
        }

        _animateIdle(dt) {
            const p = this.parts;
            this.animTime += dt * 1.4;
            const breath = Math.sin(this.animTime) * 0.022;
            p.leftLeg.rotation.x = 0;
            p.rightLeg.rotation.x = 0;
            p.leftArm.rotation.x = 0.08;
            p.rightArm.rotation.x = 0.08;
            p.torso.position.y = p.torsoBaseY + breath;
            p.head.position.y = p.headBaseY + breath * 0.6;
        }

        _apply(camPos) {
            this.group.position.copy(this.position);
            this.group.rotation.y = this.facing;
            // Label sempre de frente para a câmera, sem inclinar o NPC
            if (camPos && this.parts.nameLabel) {
                const lbl = this.parts.nameLabel;
                lbl.rotation.set(0, 0, 0);
                // Compensa a rotação do grupo para o texto ficar legível
                const dx = camPos.x - this.position.x;
                const dz = camPos.z - this.position.z;
                if (dx * dx + dz * dz > 0.01) {
                    lbl.rotation.y = Math.atan2(dx, dz) - this.facing;
                }
            }
        }

        get dialogueData() {
            return {
                id: this.id,
                name: this.name,
                title: this.title,
                mesh: this.group,
                dialogue: this.dialogue
            };
        }

        dispose() {
            if (this.group) {
                this.scene.remove(this.group);
                this.group.traverse(obj => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                });
            }
        }
    }

    // -------------------------------------------------------------------------
    // NPC MANAGER
    // -------------------------------------------------------------------------
    class NPCManager {
        /**
         * @param {THREE.Scene} scene
         * @param {object} world
         * @param {object} [options]
         */
        constructor(scene, world, options = {}) {
            if (!scene) throw new Error('[NPCManager] scene obrigatória');
            if (!world) throw new Error('[NPCManager] world obrigatório');

            this.scene = scene;
            this.world = world;
            this.npcs = [];

            const defs = options.defs || NPC_DEFS;
            for (const def of defs) {
                this.npcs.push(new VillageNPC(scene, world, def));
            }

            // Referência conveniente ao ancião
            this.elder = this.npcs.find(n => n.id === 'npc_marcus') || this.npcs[0] || null;
        }

        update(dt, playerPos) {
            const camPos =
                typeof Game !== 'undefined' && Game.camera
                    ? Game.camera.position
                    : null;
            for (const npc of this.npcs) {
                npc.update(dt, playerPos, camPos);
            }
            // Evita NPCs empilhados / atravessando uns aos outros
            this._separateNpcs();
        }

        _separateNpcs() {
            const list = this.npcs;
            const n = list.length;
            const minDist = 1.15;
            for (let i = 0; i < n; i++) {
                const a = list[i];
                if (!a || !a.position) continue;
                for (let j = i + 1; j < n; j++) {
                    const b = list[j];
                    if (!b || !b.position) continue;
                    let dx = a.position.x - b.position.x;
                    let dz = a.position.z - b.position.z;
                    let dist = Math.hypot(dx, dz);
                    if (dist < 0.001) {
                        dx = 1; dz = 0; dist = 0.001;
                    }
                    if (dist < minDist) {
                        const push = (minDist - dist) * 0.5;
                        const nx = dx / dist;
                        const nz = dz / dist;
                        a.position.x += nx * push;
                        a.position.z += nz * push;
                        b.position.x -= nx * push;
                        b.position.z -= nz * push;
                        if (typeof a._resolveColliders === 'function') a._resolveColliders();
                        if (typeof b._resolveColliders === 'function') b._resolveColliders();
                        if (a.world && typeof a.world.getTerrainHeight === 'function') {
                            a.position.y = a.world.getTerrainHeight(a.position.x, a.position.z);
                        }
                        if (b.world && typeof b.world.getTerrainHeight === 'function') {
                            b.position.y = b.world.getTerrainHeight(b.position.x, b.position.z);
                        }
                        if (a.group) a.group.position.copy(a.position);
                        if (b.group) b.group.position.copy(b.position);
                    }
                }
            }
        }

        /** Lista compatível com o sistema de diálogo do game.html */
        getDialogueList() {
            return this.npcs.map(n => n.dialogueData);
        }

        getById(id) {
            return this.npcs.find(n => n.id === id) || null;
        }

        dispose() {
            for (const npc of this.npcs) npc.dispose();
            this.npcs.length = 0;
        }
    }

    // -------------------------------------------------------------------------
    // Compat: ElderNPC (API antiga — Ancião isolado)
    // -------------------------------------------------------------------------
    class ElderNPC extends VillageNPC {
        constructor(scene, world, options = {}) {
            const def = Object.assign({}, NPC_DEFS[0], options, {
                id: options.id || 'npc_marcus',
                name: options.name || NPC_DEFS[0].name,
                title: options.title || NPC_DEFS[0].title,
                dialogue: options.dialogue || NPC_DEFS[0].dialogue,
                home: options.home || NPC_DEFS[0].home,
                patrolPoints: options.patrolPoints || NPC_DEFS[0].patrolPoints,
                profession: 'elder'
            });
            super(scene, world, def);
            this.cfg = {
                stopDistance: this.stopDistance,
                arriveDistance: this.arriveDistance,
                idleWaitMin: this.idleWaitMin,
                idleWaitMax: this.idleWaitMax,
                walkSpeed: this.walkSpeed,
                patrolPoints: def.patrolPoints
            };
        }

        update(dt, playerPos) {
            const camPos =
                typeof Game !== 'undefined' && Game.camera
                    ? Game.camera.position
                    : null;
            super.update(dt, playerPos, camPos);
        }
    }

    global.NPCManager = NPCManager;
    global.VillageNPC = VillageNPC;
    global.ElderNPC = ElderNPC;
    global.NPC_DEFS = NPC_DEFS;
})(typeof window !== 'undefined' ? window : globalThis);
