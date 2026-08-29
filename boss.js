/**
 * boss.js — Sistema de Boss único com fases e padrões de ataque
 * Mesh gigante + animações complexas + mudanças de comportamento por fase
 *
 * Depende de: THREE (global)
 * API pública:
 *   const boss = new BossManager(scene, world, player, options);
 *   await boss.spawn(onProgress);
 *   boss.update(dt);
 *   boss.checkPlayerAttack(playerPos, playerRot, range);
 *   boss.dispose();
 */

(function (global) {
    'use strict';

    // -------------------------------------------------------------------------
    // DEFINIÇÃO DO BOSS
    // -------------------------------------------------------------------------
    const BOSS_DEFINITION = {
        label: 'Soberano das Sombras',
        hp: 600,
        speed: 3.5,
        damage: 45,
        color: 0x1a0033,
        accent: 0x440066,
        skin: 0x2d0052,
        scale: 2.2,
        xp: 250,
        goldMin: 150,
        goldMax: 250,
        aggroRange: 25,
        attackRange: 3.0,
        attackCooldown: 1.8,
        eyeColor: 0xff006e,
        // Fases
        phases: {
            phase1: { hpThreshold: 0.66, attackVariations: 1, speed: 3.5 },
            phase2: { hpThreshold: 0.33, attackVariations: 2, speed: 4.2 },
            phase3: { hpThreshold: 0.0, attackVariations: 3, speed: 5.0 }
        }
    };

    const _tmpV = new THREE.Vector3();
    const _tmpFwd = new THREE.Vector3();

    function texMat(kind, baseHex, extra) {
        extra = extra || {};
        if (typeof EnemyTex !== 'undefined' && EnemyTex.material) {
            return EnemyTex.material(kind, baseHex, Object.assign({
                roughness: 0.7,
                metalness: 0.1,
                bump: 0.4,
                repeatX: 2,
                repeatY: 2
            }, extra));
        }
        return new THREE.MeshStandardMaterial({
            color: baseHex,
            roughness: extra.roughness != null ? extra.roughness : 0.7,
            metalness: extra.metalness != null ? extra.metalness : 0.1
        });
    }

    // -------------------------------------------------------------------------
    // FACTORY DE MESH (corpo épico articulado)
    // -------------------------------------------------------------------------
    function createBossMesh(def) {
        const s = def.scale;
        const group = new THREE.Group();

        const matBody = texMat('veins', def.color, { roughness: 0.65, metalness: 0.15 });
        const matAccent = texMat('veins', def.accent, { roughness: 0.7, metalness: 0.1 });
        const matSkin = texMat('smoke', def.skin, { roughness: 0.75, metalness: 0.08 });
        const matEye = new THREE.MeshStandardMaterial({
            color: def.eyeColor, emissive: def.eyeColor, emissiveIntensity: 0.9, roughness: 0.2
        });
        const matClaw = texMat('armor', 0x0f0f0f, {
            roughness: 0.35, metalness: 0.5, bump: 0.3
        });
        const matCrown = new THREE.MeshStandardMaterial({
            color: 0xb91c1c, emissive: 0xff006e, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.6
        });

        // --- Tronco imenso e musculoso ---
        const torso = new THREE.Mesh(
            new THREE.SphereGeometry(0.65 * s, 12, 10),
            matBody
        );
        torso.position.y = 1.35 * s;
        torso.scale.set(1.3, 1.45, 0.95);
        torso.castShadow = true;
        group.add(torso);

        // Peito/tórax em relevo
        const chest = new THREE.Mesh(
            new THREE.SphereGeometry(0.48 * s, 10, 8),
            matAccent
        );
        chest.position.set(0, 1.5 * s, 0.35 * s);
        chest.scale.set(1.2, 1.15, 0.85);
        chest.castShadow = true;
        group.add(chest);

        // Costelas proeminentes
        for (let i = 0; i < 4; i++) {
            const rib = new THREE.Mesh(
                new THREE.BoxGeometry(0.8 * s, 0.12 * s, 0.3 * s),
                matBody
            );
            rib.position.set(0, (1.35 - i * 0.25) * s, 0.5 * s);
            rib.rotation.z = Math.random() * 0.2 - 0.1;
            group.add(rib);
        }

        // Espinhos dorsais gigantes
        for (let i = 0; i < 6; i++) {
            const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.15 * s, (0.6 + i * 0.15) * s, 8),
                matAccent
            );
            spike.position.set(
                (i - 2.5) * 0.18 * s,
                (1.5 + i * 0.15) * s,
                -0.5 * s
            );
            spike.rotation.x = -0.8;
            spike.castShadow = true;
            group.add(spike);
        }

        // --- Cabeça colossal e assustadora ---
        const head = new THREE.Group();
        head.position.y = (2.3) * s;

        const skull = new THREE.Mesh(
            new THREE.SphereGeometry(0.55 * s, 12, 10),
            matSkin
        );
        skull.scale.set(1.15, 1.2, 1.25);
        skull.castShadow = true;
        head.add(skull);

        // Focinho aterrorizante
        const snout = new THREE.Mesh(
            new THREE.SphereGeometry(0.28 * s, 10, 8),
            matAccent
        );
        snout.position.set(0, -0.1 * s, 0.42 * s);
        snout.scale.set(1.1, 0.8, 1.3);
        head.add(snout);

        // Presas gigantes
        for (const sx of [-0.15, 0.15]) {
            const fang = new THREE.Mesh(
                new THREE.ConeGeometry(0.08 * s, 0.35 * s, 6),
                matClaw
            );
            fang.position.set(sx * s, -0.25 * s, 0.5 * s);
            fang.rotation.x = Math.PI;
            fang.castShadow = true;
            head.add(fang);
        }

        // Olhos hipnotizantes
        for (const sx of [-0.18, 0.18]) {
            const eyeWhite = new THREE.Mesh(
                new THREE.SphereGeometry(0.15 * s, 8, 6),
                new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 })
            );
            eyeWhite.position.set(sx * s, 0.12 * s, 0.35 * s);
            head.add(eyeWhite);

            const iris = new THREE.Mesh(
                new THREE.SphereGeometry(0.09 * s, 8, 6),
                matEye
            );
            iris.position.set(sx * s, 0.12 * s, 0.44 * s);
            head.add(iris);

            // Aura nos olhos
            const glow = new THREE.Mesh(
                new THREE.SphereGeometry(0.18 * s, 6, 5),
                new THREE.MeshStandardMaterial({
                    color: def.eyeColor,
                    emissive: def.eyeColor,
                    emissiveIntensity: 0.3,
                    transparent: true,
                    opacity: 0.2
                })
            );
            glow.position.copy(eyeWhite.position);
            head.add(glow);
        }

        // Chifres retorcidos gigantes
        for (const sx of [-1, 1]) {
            const horn = new THREE.Mesh(
                new THREE.ConeGeometry(0.12 * s, 0.9 * s, 8),
                matClaw
            );
            horn.position.set(sx * 0.35 * s, 0.55 * s, -0.15 * s);
            horn.rotation.z = sx * 0.65;
            horn.rotation.x = -0.35;
            horn.castShadow = true;
            head.add(horn);
        }

        // Coroa/crista maligna no topo
        for (let i = 0; i < 5; i++) {
            const crown = new THREE.Mesh(
                new THREE.ConeGeometry(0.1 * s, 0.5 * s, 6),
                matCrown
            );
            crown.position.set(
                (i - 2) * 0.2 * s,
                0.75 * s,
                0
            );
            crown.rotation.x = -0.3;
            crown.castShadow = true;
            head.add(crown);
        }

        group.add(head);

        // --- Braços enormes e musculosos ---
        function makeArm(side) {
            const arm = new THREE.Group();
            arm.position.set(side * 0.8 * s, 1.5 * s, -0.1 * s);

            // Ombro
            const shoulder = new THREE.Mesh(
                new THREE.SphereGeometry(0.25 * s, 8, 6),
                matBody
            );
            shoulder.castShadow = true;
            arm.add(shoulder);

            // Bíceps
            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2 * s, 0.18 * s, 0.75 * s, 8),
                matBody
            );
            upper.position.y = -0.4 * s;
            upper.castShadow = true;
            arm.add(upper);

            // Cotovelo
            const elbow = new THREE.Mesh(
                new THREE.SphereGeometry(0.16 * s, 6, 5),
                matAccent
            );
            elbow.position.y = -0.8 * s;
            arm.add(elbow);

            // Antebraço
            const lower = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15 * s, 0.12 * s, 0.7 * s, 8),
                matBody
            );
            lower.position.y = -1.15 * s;
            lower.castShadow = true;
            arm.add(lower);

            // Garra/mão
            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(0.18 * s, 8, 6),
                matAccent
            );
            hand.position.y = -1.55 * s;
            hand.scale.set(1.2, 0.9, 1.1);
            hand.castShadow = true;
            arm.add(hand);

            // Dedos/garras
            for (let f = 0; f < 4; f++) {
                const claw = new THREE.Mesh(
                    new THREE.ConeGeometry(0.05 * s, 0.25 * s, 5),
                    matClaw
                );
                claw.position.set(
                    (f - 1.5) * 0.12 * s,
                    -1.75 * s,
                    0.2 * s
                );
                claw.rotation.x = 0.5;
                arm.add(claw);
            }

            arm.castShadow = true;
            return arm;
        }

        const armL = makeArm(-1);
        const armR = makeArm(1);
        group.add(armL);
        group.add(armR);

        // --- Pernas/bases do corpo ---
        function makeLeg(side) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.4 * s, 0, 0);

            const thigh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.28 * s, 0.24 * s, 0.9 * s, 8),
                matBody
            );
            thigh.position.y = 0.45 * s;
            thigh.castShadow = true;
            leg.add(thigh);

            const knee = new THREE.Mesh(
                new THREE.SphereGeometry(0.2 * s, 6, 5),
                matAccent
            );
            knee.position.y = 0.0 * s;
            leg.add(knee);

            const shin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2 * s, 0.18 * s, 0.8 * s, 8),
                matBody
            );
            shin.position.y = -0.4 * s;
            shin.castShadow = true;
            leg.add(shin);

            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(0.4 * s, 0.2 * s, 0.5 * s),
                matAccent
            );
            foot.position.y = -0.8 * s;
            foot.castShadow = true;
            leg.add(foot);

            return leg;
        }

        const legL = makeLeg(-1);
        const legR = makeLeg(1);
        group.add(legL);
        group.add(legR);

        // --- UI (barra de vida) ---
        const barGroup = new THREE.Group();
        barGroup.position.y = (3.0) * s;

        const barBg = new THREE.Mesh(
            new THREE.BoxGeometry(1.1 * s, 0.25 * s, 0.05 * s),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
        );
        barBg.position.z = 0.1 * s;
        barGroup.add(barBg);

        const barFg = new THREE.Mesh(
            new THREE.BoxGeometry(1.0 * s, 0.2 * s, 0.05 * s),
            new THREE.MeshStandardMaterial({ color: 0xff006e })
        );
        barFg.position.z = 0.12 * s;
        barGroup.add(barFg);

        group.add(barGroup);

        // Canvas de nome
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = '#ff006e';
        ctx.textAlign = 'center';
        ctx.fillText(BOSS_DEFINITION.label, 128, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const nameLabel = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: texture, sizeAttenuation: false })
        );
        nameLabel.position.y = (3.5) * s;
        nameLabel.scale.set(1.5, 0.4, 1);
        group.add(nameLabel);

        // Sombra falsa no chão
        if (typeof EnemyTex !== 'undefined' && EnemyTex.groundShadow) {
            const blob = EnemyTex.groundShadow(2.1 * s);
            blob.position.y = 0.06;
            group.add(blob);
        }

        group.castShadow = true;
        return { group, barBg, barFg, nameLabel };
    }

    // -------------------------------------------------------------------------
    // ANIMAÇÃO DO BOSS
    // -------------------------------------------------------------------------
    function animateBoss(boss, dt) {
        boss.animTime += dt;

        // Respiração
        const breathe = Math.sin(boss.animTime * 1.5) * 0.08;

        // Oscilação dos espinhos
        const sway = Math.sin(boss.animTime * 0.8) * 0.15;

        // Ataque: bater com os braços
        if (boss.attackAnim > 0) {
            boss.attackAnim -= dt;
            const pct = 1 - boss.attackAnim / 0.35;
            const swingForce = Math.sin(pct * Math.PI) * 0.3;
            // Aplicar rotação de ataque aos braços...
        }

        // Aplicar respiração (leve pulsação)
        if (boss.mesh) {
            boss.mesh.scale.y = 1 + breathe * 0.05;
        }
    }

    // -------------------------------------------------------------------------
    // BOSS MANAGER
    // -------------------------------------------------------------------------
    class BossManager {
        constructor(scene, world, player, options = {}) {
            this.scene = scene;
            this.world = world;
            this.player = player;
            this.boss = null;
            this.cullDistance = options.cullDistance || 100;
            this.onPlayerHit = options.onPlayerHit;
            this.onBossPhaseChange = options.onBossPhaseChange;
            this.onBossDeath = options.onBossDeath;
        }

        async spawn(onProgress) {
            const def = BOSS_DEFINITION;
            const parts = createBossMesh(def);

            // Posição central do mapa
            const x = 0, z = -25, y = this.world.getTerrainHeight(x, z);

            this.boss = {
                id: 0,
                type: 'boss',
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
                attackPattern: 0,
                animTime: 0,
                patrolT: 0,
                phase: 1,
                alive: true
            };

            this.boss.mesh.position.copy(this.boss.pos);
            this.scene.add(this.boss.mesh);

            if (onProgress) onProgress();
            return this.boss;
        }

        update(dt) {
            if (!this.boss || !this.boss.alive) return;

            const boss = this.boss;
            const playerPos = this.player.position;
            const camPos = (typeof Game !== 'undefined' && Game.camera)
                ? Game.camera.position
                : null;

            // Determinar fase
            const hpRatio = boss.hp / boss.maxHp;
            if (hpRatio <= 0.33) {
                boss.phase = 3;
            } else if (hpRatio <= 0.66) {
                boss.phase = 2;
            } else {
                boss.phase = 1;
            }

            const dist = boss.pos.distanceTo(playerPos);

            if (dist > this.cullDistance) {
                boss.state = 'IDLE';
                animateBoss(boss, dt);
                return;
            }

            if (boss.atkCd > 0) boss.atkCd -= dt;

            const def = boss.def;
            if (dist < def.aggroRange) {
                boss.state = dist < def.attackRange ? 'ATTACK' : 'CHASE';
            } else if (dist > def.aggroRange + 15) {
                boss.state = 'PATROL';
            } else if (boss.state === 'CHASE') {
                boss.state = 'IDLE';
            }

            switch (boss.state) {
                case 'CHASE':
                    this._doChase(boss, playerPos, dt);
                    break;
                case 'ATTACK':
                    this._doAttack(boss, playerPos, dt);
                    break;
                case 'PATROL':
                    this._doPatrol(boss, dt);
                    break;
                default:
                    break;
            }

            animateBoss(boss, dt);
            this._updateHealthBar(boss, camPos);
        }

        _doChase(boss, playerPos, dt) {
            const speed = boss.def.speed + (boss.phase - 1) * 0.5;
            _tmpV.subVectors(playerPos, boss.pos).normalize();
            boss.pos.x += _tmpV.x * speed * dt;
            boss.pos.z += _tmpV.z * speed * dt;
            boss.pos.y = this.world.getTerrainHeight(boss.pos.x, boss.pos.z);
            boss.mesh.position.copy(boss.pos);
            boss.mesh.rotation.y = Math.atan2(_tmpV.x, _tmpV.z);
        }

        _doAttack(boss, playerPos, dt) {
            const dx = playerPos.x - boss.pos.x;
            const dz = playerPos.z - boss.pos.z;
            boss.mesh.rotation.y = Math.atan2(dx, dz);

            if (boss.atkCd <= 0) {
                boss.attackAnim = 0.35;
                boss.attackPattern = (boss.attackPattern + 1) % boss.phase;

                // Variações de ataque por fase
                let damage = boss.damage;
                if (boss.phase === 2) damage *= 1.2;
                if (boss.phase === 3) damage *= 1.5;

                const applied = this.player.takeDamage(damage);
                if (applied && typeof this.onPlayerHit === 'function') {
                    this.onPlayerHit(damage);
                }

                // Efeitos visuais
                if (typeof Game !== 'undefined') {
                    Game.spawnParticles?.(boss.pos, 0xff006e, 12);
                }

                boss.atkCd = boss.def.attackCooldown - (boss.phase - 1) * 0.2;
            }
        }

        _doPatrol(boss, dt) {
            const speed = boss.def.speed * 0.3;
            boss.patrolT += dt;
            const angle = boss.patrolT * 0.2;
            const px = boss.home.x + Math.cos(angle) * 8;
            const pz = boss.home.z + Math.sin(angle) * 8;

            _tmpV.set(px - boss.pos.x, 0, pz - boss.pos.z);
            if (_tmpV.lengthSq() > 0.1) {
                _tmpV.normalize();
                boss.pos.x += _tmpV.x * speed * dt;
                boss.pos.z += _tmpV.z * speed * dt;
                boss.pos.y = this.world.getTerrainHeight(boss.pos.x, boss.pos.z);
                boss.mesh.position.copy(boss.pos);
                boss.mesh.rotation.y = Math.atan2(_tmpV.x, _tmpV.z);
            }
        }

        _updateHealthBar(boss, camPos) {
            const pct = Math.max(0, boss.hp / boss.maxHp);
            boss.barFg.scale.x = pct;
            boss.barFg.position.x = -0.55 * (1 - pct);

            if (camPos) {
                boss.barFg.lookAt(camPos);
                boss.barBg.lookAt(camPos);
                if (boss.nameLabel) boss.nameLabel.lookAt(camPos);
            }
        }

        checkPlayerAttack(playerPos, playerRot, range) {
            if (!this.boss || !this.boss.alive) return { hit: false, kills: [] };

            const boss = this.boss;
            _tmpFwd.set(Math.sin(playerRot), 0, Math.cos(playerRot));

            _tmpV.subVectors(boss.pos, playerPos);
            const dist = _tmpV.length();

            if (dist >= range) return { hit: false, kills: [] };

            _tmpV.normalize();
            if (_tmpFwd.dot(_tmpV) < 0.25) return { hit: false, kills: [] };

            const dmg = typeof this.player.getAttackDamage === 'function'
                ? this.player.getAttackDamage()
                : 25;

            boss.hp -= dmg;

            boss.pos.x += _tmpV.x * 2.5;
            boss.pos.z += _tmpV.z * 2.5;
            boss.mesh.position.copy(boss.pos);

            if (typeof Game !== 'undefined') {
                Game.showPopDamage?.(boss.pos, dmg);
                Game.spawnParticles?.(boss.pos, 0xef4444, 10);
            }
            if (typeof Sound !== 'undefined') Sound.playHit?.();

            let kills = [];
            if (boss.hp <= 0) {
                const rewards = this._killBoss(boss);
                kills.push({ enemy: boss, rewards });
            }

            return { hit: true, kills };
        }

        _killBoss(boss) {
            boss.alive = false;
            boss.hp = 0;
            this.scene.remove(boss.mesh);

            const def = boss.def;
            const xp = def.xp;
            const gold = def.goldMin + (Math.random() * (def.goldMax - def.goldMin + 1) | 0);

            if (typeof this.player.gainXP === 'function') {
                this.player.gainXP(xp, (lvl) => {
                    if (typeof Game !== 'undefined') {
                        Game.showToast?.(`NÍVEL ${lvl}!`, 'rose');
                        Game.spawnParticles?.(this.player.position, 0xff006e, 30);
                    }
                });
            }
            this.player.gold = (this.player.gold || 0) + gold;

            const rewards = { xp, gold, type: 'boss' };

            if (typeof this.onBossDeath === 'function') {
                this.onBossDeath(boss, rewards);
            }

            if (typeof Game !== 'undefined') {
                Game.showToast?.(`BOSS DERROTADO! +${xp} XP · +${gold} ouro`, 'rose');
                Game.spawnParticles?.(boss.pos, 0xff006e, 50);
            }

            return rewards;
        }

        get isAlive() {
            return this.boss && this.boss.alive;
        }

        getStats() {
            if (!this.boss) return null;
            return {
                hp: this.boss.hp,
                maxHp: this.boss.maxHp,
                phase: this.boss.phase,
                distance: this.boss.pos.distanceTo(this.player.position)
            };
        }

        dispose() {
            if (this.boss && this.boss.mesh) {
                this.scene.remove(this.boss.mesh);
                this.boss.mesh.traverse(obj => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) {
                        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                        else obj.material.dispose();
                    }
                });
            }
            this.boss = null;
        }
    }

    BossManager.DEFINITION = BOSS_DEFINITION;

    global.BossManager = BossManager;

})(typeof window !== 'undefined' ? window : globalThis);
