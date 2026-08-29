/**
 * bandidos.js — Sistema de Bandidos do Vale Selvagem (mapa2)
 * Humanos hostis: Bandido, Arqueiro e Líder
 *
 * Depende de: THREE (global)
 * API pública:
 *   const bandits = new BanditManager(scene, world, player, options);
 *   await bandits.spawn(onProgress);
 *   bandits.update(dt);
 *   bandits.checkPlayerAttack(playerPos, playerRot, range);
 *   bandits.dispose();
 */

(function (global) {
    'use strict';

    // -------------------------------------------------------------------------
    // TIPOS DE BANDIDO
    // -------------------------------------------------------------------------
    const BANDIT_TYPES = {
        bandit: {
            label: 'Bandido',
            hp: 55,
            speed: 4.0,
            damage: 12,
            color: 0x4a3728,      // colete marrom
            accent: 0x2c1810,
            skin: 0xc68642,
            scale: 1.0,
            xp: 28,
            goldMin: 10,
            goldMax: 22,
            aggroRange: 15,
            attackRange: 2.3,
            attackCooldown: 1.2,
            eyeColor: 0x1c1917
        },
        archer: {
            label: 'Bandido Arqueiro',
            hp: 40,
            speed: 3.6,
            damage: 14,
            color: 0x3f3f46,      // roupa escura
            accent: 0x27272a,
            skin: 0xd4a574,
            scale: 0.98,
            xp: 32,
            goldMin: 12,
            goldMax: 25,
            aggroRange: 20,
            attackRange: 8.5,     // ataca de longe (simulado)
            attackCooldown: 1.6,
            eyeColor: 0x1c1917
        },
        leader: {
            label: 'Líder dos Bandidos',
            hp: 110,
            speed: 3.8,
            damage: 20,
            color: 0x1e293b,      // armadura escura
            accent: 0x0f172a,
            skin: 0xb45309,
            scale: 1.12,
            xp: 60,
            goldMin: 30,
            goldMax: 55,
            aggroRange: 18,
            attackRange: 2.5,
            attackCooldown: 1.05,
            eyeColor: 0x7f1d1d
        }
    };

    // Spawns padrão para o Vale Selvagem (mapa2)
    // Spawns em terra firme no Vale Selvagem (evita riacho / água)
    const DEFAULT_BANDIT_SPAWNS = [
        { x:  32, z: -38, type: 'bandit'  },
        { x:  50, z: -20, type: 'bandit'  },
        { x: -40, z:  48, type: 'bandit'  },
        { x:  60, z:  30, type: 'archer'  },
        { x: -60, z: -35, type: 'archer'  },
        { x:  22, z: -55, type: 'bandit'  },
        { x: -28, z: -48, type: 'bandit'  },
        { x:  75, z: -25, type: 'archer'  },
        { x: -70, z:  25, type: 'bandit'  },
        { x: -15, z:  72, type: 'leader'  },
        { x:  48, z:  60, type: 'bandit'  },
        { x: -55, z:  55, type: 'archer'  }
    ];

    const _tmpV = new THREE.Vector3();
    const _tmpFwd = new THREE.Vector3();

    function texMat(kind, baseHex, extra) {
        extra = extra || {};
        if (typeof EnemyTex !== 'undefined' && EnemyTex.material) {
            return EnemyTex.material(kind, baseHex, Object.assign({
                roughness: 0.8,
                metalness: 0.06,
                bump: 0.3,
                repeatX: 2,
                repeatY: 2
            }, extra));
        }
        return new THREE.MeshStandardMaterial({
            color: baseHex,
            roughness: extra.roughness != null ? extra.roughness : 0.8,
            metalness: extra.metalness != null ? extra.metalness : 0.06
        });
    }

    // -------------------------------------------------------------------------
    // MESH HUMANO DE BANDIDO
    // -------------------------------------------------------------------------
    function createBanditMesh(def, typeKey) {
        const s = def.scale;
        const group = new THREE.Group();
        const isArcher = typeKey === 'archer';
        const isLeader = typeKey === 'leader';

        const matBody = texMat(isLeader ? 'armor' : 'cloth', def.color, {
            roughness: 0.75, metalness: isLeader ? 0.35 : 0.08
        });
        const matAccent = texMat(isLeader ? 'armor' : 'leather', def.accent, {
            roughness: 0.8, metalness: 0.1
        });
        const matSkin = texMat('skin', def.skin, {
            roughness: 0.78, metalness: 0.02, bump: 0.15
        });
        const matMetal = texMat('armor', 0x94a3b8, {
            metalness: 0.85, roughness: 0.3, bump: 0.25
        });
        const matHair = texMat(isArcher ? 'cloth' : 'hair', 0x1c1917, {
            roughness: 0.9, bump: 0.2
        });
        const matLeather = texMat('leather', 0x5c4033, {
            roughness: 0.85, bump: 0.35
        });

        // ===== TORSO =====
        const torso = new THREE.Group();
        torso.position.y = 1.25 * s;

        const chest = new THREE.Mesh(
            new THREE.SphereGeometry(0.38 * s, 12, 10),
            matBody
        );
        chest.scale.set(1.15, 1.1, 0.85);
        chest.castShadow = true;
        torso.add(chest);

        // Colete / armadura
        const vest = new THREE.Mesh(
            new THREE.CylinderGeometry(0.36 * s, 0.40 * s, 0.55 * s, 10),
            matAccent
        );
        vest.position.y = -0.05 * s;
        vest.castShadow = true;
        torso.add(vest);

        if (isLeader) {
            // Ombreiras
            for (const side of [-1, 1]) {
                const sh = new THREE.Mesh(
                    new THREE.SphereGeometry(0.18 * s, 8, 6),
                    matMetal
                );
                sh.position.set(side * 0.42 * s, 0.22 * s, 0);
                sh.scale.set(1.1, 0.85, 1);
                torso.add(sh);
            }
        }

        // Cinto
        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(0.36 * s, 0.04 * s, 6, 14),
            matLeather
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.32 * s;
        torso.add(belt);

        group.add(torso);

        // ===== CABEÇA =====
        const headY = 1.95 * s;
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.27 * s, 12, 10),
            matSkin
        );
        head.position.y = headY;
        head.castShadow = true;
        group.add(head);

        // Cabelo / capuz (hemisfério — não cobre o rosto)
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.29 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
            isArcher ? matLeather : matHair
        );
        hair.position.y = headY + 0.08 * s;
        hair.castShadow = true;
        group.add(hair);

        // Olhos
        for (const sx of [-0.09, 0.09]) {
            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.035 * s, 6, 5),
                new THREE.MeshStandardMaterial({ color: 0x111111 })
            );
            eye.position.set(sx * s, headY + 0.02 * s, 0.24 * s);
            group.add(eye);
        }

        // ===== BRAÇOS =====
        function makeArm(side) {
            const arm = new THREE.Group();
            arm.position.set(side * 0.42 * s, 1.45 * s, 0);

            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09 * s, 0.08 * s, 0.45 * s, 7),
                matBody
            );
            upper.position.y = -0.22 * s;
            upper.castShadow = true;
            arm.add(upper);

            const lower = new THREE.Mesh(
                new THREE.CylinderGeometry(0.07 * s, 0.06 * s, 0.4 * s, 7),
                matSkin
            );
            lower.position.y = -0.62 * s;
            lower.castShadow = true;
            arm.add(lower);

            // Mão
            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(0.07 * s, 6, 5),
                matSkin
            );
            hand.position.y = -0.85 * s;
            arm.add(hand);

            // Arma
            if (isArcher && side === 1) {
                // Arco simples
                const bow = new THREE.Mesh(
                    new THREE.TorusGeometry(0.28 * s, 0.025 * s, 6, 12, Math.PI),
                    matLeather
                );
                bow.rotation.y = Math.PI / 2;
                bow.position.set(0.08 * s, -0.5 * s, 0);
                arm.add(bow);
            } else if (side === -1 || isLeader) {
                // Espada / adaga
                const blade = new THREE.Mesh(
                    new THREE.BoxGeometry(0.04 * s, 0.55 * s, 0.08 * s),
                    matMetal
                );
                blade.position.set(side * 0.05 * s, -0.95 * s, 0.05 * s);
                blade.rotation.z = side * 0.15;
                arm.add(blade);

                const hilt = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.12 * s, 6),
                    matLeather
                );
                hilt.position.set(side * 0.05 * s, -0.65 * s, 0.05 * s);
                arm.add(hilt);
            }

            return arm;
        }

        const leftArm = makeArm(-1);
        const rightArm = makeArm(1);
        group.add(leftArm);
        group.add(rightArm);

        // ===== PERNAS =====
        function makeLeg(side) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.16 * s, 0.85 * s, 0);

            const thigh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.11 * s, 0.09 * s, 0.45 * s, 7),
                matAccent
            );
            thigh.position.y = -0.2 * s;
            thigh.castShadow = true;
            leg.add(thigh);

            const shin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08 * s, 0.07 * s, 0.4 * s, 7),
                matBody
            );
            shin.position.y = -0.6 * s;
            shin.castShadow = true;
            leg.add(shin);

            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(0.12 * s, 0.08 * s, 0.2 * s),
                matLeather
            );
            foot.position.set(0, -0.85 * s, 0.04 * s);
            leg.add(foot);

            return leg;
        }

        const leftLeg = makeLeg(-1);
        const rightLeg = makeLeg(1);
        group.add(leftLeg);
        group.add(rightLeg);

        // ===== BARRA DE VIDA + NOME =====
        const barBg = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9 * s, 0.1 * s),
            new THREE.MeshBasicMaterial({ color: 0x1c1917, transparent: true, opacity: 0.75, depthSide: THREE.DoubleSide })
        );
        barBg.position.y = 2.55 * s;
        group.add(barBg);

        const barFg = new THREE.Mesh(
            new THREE.PlaneGeometry(0.86 * s, 0.07 * s),
            new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
        );
        barFg.position.set(0, 2.55 * s, 0.01);
        group.add(barFg);

        // Label de nome (sprite simples)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, 256, 48);
        ctx.font = 'bold 22px Arial';
        ctx.fillStyle = isLeader ? '#fbbf24' : '#f1f5f9';
        ctx.textAlign = 'center';
        ctx.fillText(def.label, 128, 32);
        const nameTex = new THREE.CanvasTexture(canvas);
        const nameMat = new THREE.SpriteMaterial({ map: nameTex, transparent: true });
        const nameLabel = new THREE.Sprite(nameMat);
        nameLabel.scale.set(1.6 * s, 0.3 * s, 1);
        nameLabel.position.y = 2.85 * s;
        group.add(nameLabel);

        // Sombra falsa no chão
        if (typeof EnemyTex !== 'undefined' && EnemyTex.groundShadow) {
            const blob = EnemyTex.groundShadow(0.7 * s);
            blob.position.y = 0.04;
            group.add(blob);
        }

        return {
            group,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            barBg,
            barFg,
            nameLabel,
            torso
        };
    }

    // -------------------------------------------------------------------------
    // ANIMAÇÃO
    // -------------------------------------------------------------------------
    function animateBandit(e, dt) {
        const isArcher = e.type === 'archer';
        const isAttacking = (e.attackAnim || 0) > 0;

        // Timer do golpe (0 → finito)
        if (e.attackAnim > 0) {
            e.attackAnim = Math.max(0, e.attackAnim - dt);
        }

        // Ritmo de caminhada só fora do ataque
        const speedMul = e.state === 'CHASE' ? 9.5 : e.state === 'PATROL' ? 6 : 4;
        e.animTime = (e.animTime || 0) + dt * (isAttacking ? 0 : speedMul);
        const t = e.animTime;

        const p = e.parts;
        if (!p) return;

        if (isAttacking) {
            // Golpe único: 0 → 1 ao longo de attackAnimMax
            const maxA = e.attackAnimMax || 0.45;
            const prog = 1 - (e.attackAnim / maxA); // 0 no início, 1 no fim
            // Sobe e desce (anticipation + strike)
            const swing = Math.sin(Math.min(1, prog) * Math.PI);

            // Pernas firmes no golpe
            if (p.leftLeg) p.leftLeg.rotation.x = 0.12;
            if (p.rightLeg) p.rightLeg.rotation.x = -0.08;

            if (isArcher) {
                // Arqueiro: puxa o arco e solta
                if (p.leftArm) {
                    p.leftArm.rotation.x = -0.9;
                    p.leftArm.rotation.z = -0.15;
                }
                if (p.rightArm) {
                    // Braço da corda: puxa para trás no início e solta
                    const pull = prog < 0.55 ? swing : swing * 0.3;
                    p.rightArm.rotation.x = -0.5 - pull * 0.9;
                    p.rightArm.rotation.z = 0.25;
                }
                if (p.torso) p.torso.rotation.y = swing * 0.12;
            } else {
                // Corpo a corpo: braço armado sobe e desce no golpe
                if (p.rightArm) {
                    p.rightArm.rotation.x = -0.35 - swing * 1.7;
                    p.rightArm.rotation.z = 0.15 + swing * 0.35;
                }
                if (p.leftArm) {
                    p.leftArm.rotation.x = -0.25;
                    p.leftArm.rotation.z = -0.2;
                }
                if (p.torso) {
                    p.torso.rotation.y = swing * 0.28;
                    p.torso.rotation.x = -swing * 0.1;
                }
            }
        } else {
            // Reset pose de ataque
            if (p.torso) {
                p.torso.rotation.y = 0;
                p.torso.rotation.x = 0;
            }
            if (p.leftArm) p.leftArm.rotation.z = 0;
            if (p.rightArm) p.rightArm.rotation.z = 0;

            if (e.state === 'CHASE' || e.state === 'PATROL') {
                const amp = e.state === 'CHASE' ? 0.55 : 0.35;
                const walk = Math.sin(t) * amp;
                const walk2 = Math.sin(t + Math.PI) * amp;
                if (p.leftLeg) p.leftLeg.rotation.x = walk;
                if (p.rightLeg) p.rightLeg.rotation.x = walk2;
                if (p.leftArm) p.leftArm.rotation.x = walk2 * 0.55;
                if (p.rightArm) p.rightArm.rotation.x = walk * 0.55;
            } else {
                // IDLE — respiração leve
                const breath = Math.sin(t * 0.9) * 0.06;
                if (p.leftLeg) p.leftLeg.rotation.x = 0;
                if (p.rightLeg) p.rightLeg.rotation.x = 0;
                if (p.leftArm) p.leftArm.rotation.x = 0.12 + breath;
                if (p.rightArm) p.rightArm.rotation.x = 0.12 - breath * 0.5;
            }
        }

        // Barra de vida
        if (e.barFg && e.maxHp > 0) {
            const pct = Math.max(0, e.hp / e.maxHp);
            e.barFg.scale.x = Math.max(0.02, pct);
            e.barFg.position.x = -0.43 * e.def.scale * (1 - pct);
            e.barFg.material.color.setHex(pct > 0.5 ? 0x22c55e : pct > 0.25 ? 0xeab308 : 0xef4444);
        }

        // Barras olham a câmera
        if (e.barBg && typeof Game !== 'undefined' && Game.camera) {
            e.barBg.lookAt(Game.camera.position);
            e.barFg.lookAt(Game.camera.position);
        }
    }

    // -------------------------------------------------------------------------
    // BANDIT MANAGER
    // -------------------------------------------------------------------------
    class BanditManager {
        constructor(scene, world, player, options = {}) {
            if (!scene) throw new Error('[BanditManager] scene é obrigatória');
            if (!world) throw new Error('[BanditManager] world é obrigatório');
            if (!player) throw new Error('[BanditManager] player é obrigatório');

            this.scene = scene;
            this.world = world;
            this.player = player;

            this.spawns = options.spawns || DEFAULT_BANDIT_SPAWNS.slice();
            this.cullDistance = options.cullDistance ?? 60;
            this.onEnemyDeath = options.onEnemyDeath || null;
            this.onPlayerHit = options.onPlayerHit || null;

            this.enemies = [];
            this._idCounter = 0;
        }

        async spawn(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(80, 'Bandidos do Vale se preparando...');

            for (let i = 0; i < this.spawns.length; i++) {
                const sp = this.spawns[i];
                this._spawnOne(sp.x, sp.z, sp.type || 'bandit');
            }

            await progress(90, `${this.enemies.length} bandidos no Vale Selvagem`);
        }

        spawnAt(x, z, typeKey = 'bandit') {
            return this._spawnOne(x, z, typeKey);
        }

        _findDryLand(x, z) {
            const wl = (this.world.cfg && this.world.cfg.waterLevel != null)
                ? this.world.cfg.waterLevel
                : 0.35;
            const minH = wl + 0.85;
            const hFn = this.world.getTerrainHeight
                ? (xx, zz) => this.world.getTerrainHeight(xx, zz)
                : () => 99;
            if (hFn(x, z) >= minH) return { x, z };
            for (let r = 4; r <= 48; r += 4) {
                for (let a = 0; a < 16; a++) {
                    const ang = (a / 16) * Math.PI * 2;
                    const nx = x + Math.cos(ang) * r;
                    const nz = z + Math.sin(ang) * r;
                    if (hFn(nx, nz) >= minH) return { x: nx, z: nz };
                }
            }
            return { x, z };
        }

        _spawnOne(x, z, typeKey) {
            const dry = this._findDryLand(x, z);
            x = dry.x; z = dry.z;
            const def = BANDIT_TYPES[typeKey] || BANDIT_TYPES.bandit;
            const y = this.world.getTerrainHeight ? this.world.getTerrainHeight(x, z) : 0;

            const parts = createBanditMesh(def, typeKey);
            parts.group.position.set(x, y, z);
            parts.group.name = `bandit_${typeKey}_${this._idCounter}`;
            this.scene.add(parts.group);

            const enemy = {
                id: this._idCounter++,
                type: typeKey,
                def,
                mesh: parts.group,
                parts,
                barBg: parts.barBg,
                barFg: parts.barFg,
                nameLabel: parts.nameLabel,
                pos: new THREE.Vector3(x, y, z),
                home: new THREE.Vector3(x, y, z),
                hp: def.hp,
                maxHp: def.hp,
                speed: def.speed,
                damage: def.damage,
                state: 'IDLE',
                atkCd: 0,
                attackAnim: 0,
                animTime: Math.random() * 10,
                patrolT: Math.random() * 10,
                alive: true
            };

            this.enemies.push(enemy);
            return enemy;
        }

        update(dt) {
            const playerPos = this.player.position;

            for (let i = 0; i < this.enemies.length; i++) {
                const e = this.enemies[i];
                if (!e.alive) continue;

                const dist = e.pos.distanceTo(playerPos);

                if (dist > this.cullDistance) {
                    e.state = 'IDLE';
                    animateBandit(e, dt);
                    continue;
                }

                if (e.atkCd > 0) e.atkCd -= dt;

                const def = e.def;
                // Histerese: evita alternar CHASE/ATTACK a cada frame na borda
                if (dist < def.aggroRange) {
                    if (e.state === 'ATTACK') {
                        // Só volta a perseguir se sair bem da área de golpe
                        if (dist > def.attackRange * 1.25 && (e.attackAnim || 0) <= 0) {
                            e.state = 'CHASE';
                        }
                    } else if (dist <= def.attackRange) {
                        e.state = 'ATTACK';
                    } else {
                        e.state = 'CHASE';
                    }
                } else if (dist > def.aggroRange + 12) {
                    e.state = 'PATROL';
                } else if (e.state === 'CHASE' || e.state === 'ATTACK') {
                    e.state = 'IDLE';
                }

                // Durante o golpe, não persegue (fica plantado)
                if ((e.attackAnim || 0) > 0 && e.state === 'CHASE') {
                    e.state = 'ATTACK';
                }

                switch (e.state) {
                    case 'CHASE':
                        this._doChase(e, playerPos, dt);
                        break;
                    case 'ATTACK':
                        this._doAttack(e, playerPos, dt);
                        break;
                    case 'PATROL':
                        this._doPatrol(e, dt);
                        break;
                    default:
                        break;
                }

                // Hit no meio do swing
                this._processPendingHits(e, playerPos, dt);

                // Mantém no chão
                if (this.world.getTerrainHeight) {
                    e.pos.y = this.world.getTerrainHeight(e.pos.x, e.pos.z);
                }
                e.mesh.position.copy(e.pos);

                animateBandit(e, dt);
            }
        }

        _doChase(e, playerPos, dt) {
            _tmpV.subVectors(playerPos, e.pos);
            _tmpV.y = 0;
            const len = _tmpV.length();
            if (len < 0.01) return;
            _tmpV.normalize();

            e.pos.x += _tmpV.x * e.speed * dt;
            e.pos.z += _tmpV.z * e.speed * dt;

            // Rotação
            e.mesh.rotation.y = Math.atan2(_tmpV.x, _tmpV.z);
        }

        _doAttack(e, playerPos, dt) {
            // Sempre olha para o jogador
            _tmpV.subVectors(playerPos, e.pos);
            _tmpV.y = 0;
            const dist = _tmpV.length();
            if (dist > 0.001) {
                e.mesh.rotation.y = Math.atan2(_tmpV.x, _tmpV.z);
            }

            // Ainda em animação de golpe — não inicia outro
            if ((e.attackAnim || 0) > 0) return;

            if (e.atkCd > 0) return;

            // Inicia golpe
            const isArcher = e.type === 'archer';
            e.attackAnimMax = isArcher ? 0.55 : 0.42;
            e.attackAnim = e.attackAnimMax;
            e.atkCd = e.def.attackCooldown;

            // Dano no meio do swing (não no frame 0)
            const delay = isArcher ? 0.28 : 0.18;
            e._pendingHit = delay;
            e._hitDone = false;
        }

        /** Aplica o hit no meio da animação (chamado no update) */
        _processPendingHits(e, playerPos, dt) {
            if (e._pendingHit == null) return;
            e._pendingHit -= dt;
            if (e._pendingHit > 0 || e._hitDone) return;
            e._hitDone = true;
            e._pendingHit = null;

            // Confere distância no momento do impacto
            const dist = e.pos.distanceTo(playerPos);
            const range = e.def.attackRange * (e.type === 'archer' ? 1.05 : 1.15);
            if (dist > range) return;

            if (typeof this.player.takeDamage === 'function') {
                this.player.takeDamage(e.damage);
            } else {
                this.player.hp = (this.player.hp || 100) - e.damage;
            }
            if (typeof this.onPlayerHit === 'function') {
                this.onPlayerHit(e.damage);
            }
            if (typeof Game !== 'undefined') {
                Game.spawnParticles?.(playerPos, 0xef4444, 5);
                if (typeof Game.showPopDamage === 'function') {
                    Game.showPopDamage(playerPos, e.damage);
                }
            }
        }

        _doPatrol(e, dt) {
            e.patrolT = (e.patrolT || 0) + dt;
            const angle = e.patrolT * 0.4;
            const radius = 4 + (e.id % 3);
            const tx = e.home.x + Math.cos(angle) * radius;
            const tz = e.home.z + Math.sin(angle) * radius;

            _tmpV.set(tx - e.pos.x, 0, tz - e.pos.z);
            const len = _tmpV.length();
            if (len > 0.3) {
                _tmpV.normalize();
                e.pos.x += _tmpV.x * e.speed * 0.45 * dt;
                e.pos.z += _tmpV.z * e.speed * 0.45 * dt;
                e.mesh.rotation.y = Math.atan2(_tmpV.x, _tmpV.z);
            }
        }

        checkPlayerAttack(playerPos, playerRot, range = 2.8) {
            const hits = [];
            const kills = [];
            let hit = false;

            _tmpFwd.set(
                Math.sin(playerRot),
                0,
                Math.cos(playerRot)
            );

            for (const e of this.enemies) {
                if (!e.alive) continue;
                const dist = e.pos.distanceTo(playerPos);
                if (dist > range) continue;

                // Verifica se está na frente do jogador
                _tmpV.subVectors(e.pos, playerPos).normalize();
                const dot = _tmpV.dot(_tmpFwd);
                if (dot < 0.35) continue;

                hit = true;
                const dmg = (typeof this.player.getAttackDamage === 'function')
                    ? this.player.getAttackDamage()
                    : (this.player.damage || 18);

                e.hp -= dmg;
                hits.push(e);

                if (typeof Game !== 'undefined') {
                    Game.spawnParticles?.(e.pos, 0xef4444, 6);
                }

                if (e.hp <= 0) {
                    const rewards = this._killEnemy(e);
                    kills.push({ enemy: e, rewards });
                }
            }

            return { hit, kills };
        }

        _killEnemy(e) {
            e.alive = false;
            e.hp = 0;
            this.scene.remove(e.mesh);

            const def = e.def;
            const xp = def.xp;
            let gold = def.goldMin + (Math.random() * (def.goldMax - def.goldMin + 1) | 0);
            if (this.player.goldBonusPct) gold = Math.round(gold * (1 + this.player.goldBonusPct));

            if (typeof this.player.gainXP === 'function') {
                this.player.gainXP(xp, (lvl) => {
                    if (typeof Game !== 'undefined') {
                        Game.showToast?.(`NÍVEL ${lvl}!`, 'amber');
                        Game.spawnParticles?.(this.player.position, 0xf59e0b, 18);
                    }
                });
            }
            this.player.gold = (this.player.gold || 0) + gold;

            const rewards = { xp, gold, type: e.type };

            if (typeof this.onEnemyDeath === 'function') {
                this.onEnemyDeath(e, rewards);
            }

            if (typeof Game !== 'undefined') {
                Game.onEnemyKilled?.(e.type);
                Game.showToast?.(`+${xp} XP · +${gold} ouro`, 'amber');
            }

            return rewards;
        }

        get aliveCount() {
            return this.enemies.filter(e => e.alive).length;
        }

        countByType(type) {
            return this.enemies.filter(e => e.alive && e.type === type).length;
        }

        getAlive() {
            return this.enemies.filter(e => e.alive);
        }

        dispose() {
            for (const e of this.enemies) {
                if (e.mesh) {
                    this.scene.remove(e.mesh);
                    e.mesh.traverse(obj => {
                        if (obj.geometry) obj.geometry.dispose();
                        if (obj.material) {
                            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                            else obj.material.dispose();
                        }
                    });
                }
            }
            this.enemies.length = 0;
        }
    }

    BanditManager.TYPES = BANDIT_TYPES;
    BanditManager.DEFAULT_SPAWNS = DEFAULT_BANDIT_SPAWNS;

    global.BanditManager = BanditManager;
    global.BANDIT_TYPES = BANDIT_TYPES;

})(typeof window !== 'undefined' ? window : globalThis);
