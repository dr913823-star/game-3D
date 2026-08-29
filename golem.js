/**
 * golem.js — Golem invocado pelo Mago
 *
 * API:
 *   const gm = new GolemManager(scene, world, player);
 *   gm.summon(game);
 *   gm.update(dt, game);
 *   gm.dispose();
 */
(function (global) {
    'use strict';

    function _mat(opts) {
        return new THREE.MeshStandardMaterial(opts);
    }

    function _texMat(kind, baseHex, o) {
        o = o || {};
        if (typeof EnemyTex !== 'undefined' && EnemyTex.material) {
            return EnemyTex.material(kind, baseHex, Object.assign({
                roughness: 0.88, metalness: 0.15, bump: 0.45, repeatX: 3, repeatY: 3
            }, o));
        }
        return _mat(Object.assign({ color: baseHex }, o));
    }

    function createGolemMesh() {
        const g = new THREE.Group();
        g.name = 'summon_golem';

        const stone = _texMat('stone', 0x7a8494, { roughness: 0.88, metalness: 0.18 });
        const stoneMid = _texMat('stone', 0x5c6675, { roughness: 0.9, metalness: 0.14 });
        const stoneDark = _texMat('stone', 0x3d4450, { roughness: 0.92, metalness: 0.12 });
        const moss = _texMat('moss', 0x4a5c3a, { roughness: 0.95, metalness: 0.05 });
        const crystal = _mat({
            color: 0xc4b5fd, roughness: 0.2, metalness: 0.45,
            emissive: 0x7c3aed, emissiveIntensity: 0.75
        });
        const crystalDim = _mat({
            color: 0xa78bfa, roughness: 0.3, metalness: 0.4,
            emissive: 0x5b21b6, emissiveIntensity: 0.4
        });

        const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

        // ===== PERNAS (grupos hierárquicos para animação) =====
        function makeLeg(side) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.32, 0.9, 0.02);

            const thigh = shadow(new THREE.Mesh(
                new THREE.CylinderGeometry(0.28, 0.32, 0.7, 10),
                stoneDark
            ));
            thigh.position.y = -0.35;
            leg.add(thigh);

            const calf = shadow(new THREE.Mesh(
                new THREE.CylinderGeometry(0.24, 0.28, 0.55, 10),
                stoneMid
            ));
            calf.position.set(0, -0.68, 0.02);
            leg.add(calf);

            // Pé em forma de rocha
            const foot = shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.28, 10, 8),
                stoneDark
            ));
            foot.scale.set(1.15, 0.55, 1.35);
            foot.position.set(0, -0.82, 0.1);
            leg.add(foot);

            // Musgo no pé
            const footMoss = new THREE.Mesh(
                new THREE.SphereGeometry(0.12, 6, 5),
                moss
            );
            footMoss.position.set(side * 0.06, -0.76, 0.2);
            leg.add(footMoss);

            return leg;
        }

        const leftLeg = makeLeg(-1);
        const rightLeg = makeLeg(1);
        g.add(leftLeg, rightLeg);

        // Sombra falsa no chão
        if (typeof EnemyTex !== 'undefined' && EnemyTex.groundShadow) {
            const blob = EnemyTex.groundShadow(1.5);
            blob.position.y = 0.05;
            g.add(blob);
        }

        // ===== TORSO (grupo) =====
        const torso = new THREE.Group();
        torso.position.y = 1.0;
        g.add(torso);

        // ===== QUADRIL =====
        const hips = shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.48, 12, 10),
            stoneMid
        ));
        hips.scale.set(1.25, 0.7, 0.95);
        hips.position.y = 0;
        torso.add(hips);

        // ===== BARRIGA / PEITO =====
        const belly = shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.62, 14, 12),
            stone
        ));
        belly.scale.set(1.15, 1.05, 0.85);
        belly.position.y = 0.55;
        torso.add(belly);

        const chest = shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.55, 12, 10),
            stoneMid
        ));
        chest.scale.set(1.2, 0.85, 0.9);
        chest.position.set(0, 1.0, 0.05);
        torso.add(chest);

        // Placas de pedra no peito
        for (const [px, py, s] of [[-0.25, 0.95, 0.9], [0.22, 1.05, 0.75], [0, 0.7, 0.65]]) {
            const plate = shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.22 * s, 8, 6),
                stoneDark
            ));
            plate.scale.set(1.2, 0.7, 0.5);
            plate.position.set(px, py, 0.38);
            torso.add(plate);
        }

        // Cristal central no peito
        const core = shadow(new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            crystal
        ));
        core.position.set(0, 0.9, 0.52);
        core.rotation.z = 0.2;
        torso.add(core);
        const coreRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.2, 0.03, 6, 12),
            crystalDim
        );
        coreRing.position.set(0, 0.9, 0.5);
        coreRing.rotation.y = 0.3;
        torso.add(coreRing);

        // ===== CABEÇA (grupo) =====
        const head = new THREE.Group();
        head.position.y = 1.7;
        torso.add(head);

        const headMesh = shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.42, 14, 12),
            stone
        ));
        headMesh.scale.set(1.05, 0.95, 1.0);
        head.add(headMesh);

        // Mandíbula / queixo rochoso
        const jaw = shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 10, 8),
            stoneDark
        ));
        jaw.scale.set(1.1, 0.55, 0.9);
        jaw.position.set(0, -0.28, 0.12);
        head.add(jaw);

        // “Crista” de pedra no topo da cabeça
        const crest = shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 6),
            stoneDark
        ));
        crest.scale.set(0.7, 1.4, 0.6);
        crest.position.set(0, 0.35, -0.05);
        head.add(crest);
        for (const sx of [-0.18, 0.18]) {
            const spike = shadow(new THREE.Mesh(
                new THREE.ConeGeometry(0.08, 0.28, 6),
                stoneMid
            ));
            spike.position.set(sx, 0.4, -0.08);
            spike.rotation.z = sx * 0.4;
            head.add(spike);
        }

        // Olhos brilhantes (fendas arredondadas)
        for (const sx of [-0.14, 0.14]) {
            const socket = new THREE.Mesh(
                new THREE.SphereGeometry(0.1, 8, 6),
                stoneDark
            );
            socket.scale.set(1, 0.7, 0.5);
            socket.position.set(sx, 0.02, 0.36);
            head.add(socket);

            const eye = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 10, 8),
                crystal
            );
            eye.position.set(sx, 0.02, 0.4);
            head.add(eye);
        }

        // ===== BRAÇOS (grupos hierárquicos) =====
        function makeArm(side) {
            const arm = new THREE.Group();
            arm.position.set(side * 0.85, 1.25, 0);

            // Ombro redondo
            const shoulder = shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.32, 12, 10),
                stoneDark
            ));
            arm.add(shoulder);

            // Braço superior
            const upper = shadow(new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10),
                stoneMid
            ));
            upper.position.set(side * 0.2, -0.5, 0.05);
            upper.rotation.z = side * 0.25;
            arm.add(upper);

            // Cotovelo
            const elbow = shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.18, 10, 8),
                stoneDark
            ));
            elbow.position.set(side * 0.33, -0.85, 0.08);
            arm.add(elbow);

            // Antebraço
            const lower = shadow(new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.22, 0.6, 10),
                stone
            ));
            lower.position.set(side * 0.35, -1.2, 0.1);
            lower.rotation.z = side * 0.1;
            arm.add(lower);

            // Mão / punho rochoso
            const hand = shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 10, 8),
                stoneDark
            ));
            hand.scale.set(1.1, 0.85, 1.15);
            hand.position.set(side * 0.37, -1.53, 0.12);
            arm.add(hand);

            // “Dedos” de pedra
            for (let f = 0; f < 3; f++) {
                const finger = shadow(new THREE.Mesh(
                    new THREE.ConeGeometry(0.05, 0.18, 5),
                    stoneMid
                ));
                finger.position.set(
                    side * 0.37 + side * 0.02,
                    -1.67,
                    0.05 + f * 0.08
                );
                finger.rotation.x = 0.6;
                arm.add(finger);
            }

            // Pose inicial levemente aberta
            arm.rotation.z = side * 0.15;
            return arm;
        }

        const leftArm = makeArm(-1);
        const rightArm = makeArm(1);
        torso.add(leftArm, rightArm);

        // ===== DETALHES: musgo e pedras soltas =====
        const mossSpots = [
            [0.4, 0.5, 0.4], [-0.45, 0.8, 0.3], [0.2, 1.4, -0.35],
            [-0.3, 0.2, -0.3], [0.5, 1.1, 0.15]
        ];
        for (const [mx, my, mz] of mossSpots) {
            const blob = new THREE.Mesh(
                new THREE.SphereGeometry(0.1 + Math.random() * 0.06, 6, 5),
                moss
            );
            blob.position.set(mx, my, mz);
            torso.add(blob);
        }

        // Brilho ambiente sutil no cristal
        const glow = new THREE.PointLight(0xa78bfa, 0.55, 4, 2);
        glow.position.set(0, 0.9, 0.6);
        torso.add(glow);

        // Referências para animação
        g.userData.parts = {
            leftLeg,
            rightLeg,
            leftArm,
            rightArm,
            torso,
            head,
            core
        };

        return g;
    }

    function animateGolem(golem, dt, isMoving) {
        const p = golem.parts;
        if (!p) return;

        golem.animTime = (golem.animTime || 0) + dt;

        // Ataque tem prioridade
        if (golem.attackAnim > 0) {
            const t = 1 - (golem.attackAnim / 0.45);
            const swing = Math.sin(Math.min(1, t) * Math.PI);

            // Braço direito bate forte para baixo/frente
            p.rightArm.rotation.x = -0.4 - swing * 1.8;
            p.rightArm.rotation.z = 0.15 + swing * 0.5;
            p.leftArm.rotation.x = -0.25;
            p.leftArm.rotation.z = -0.2;

            // Torso inclina e gira um pouco no golpe
            p.torso.rotation.x = -swing * 0.12;
            p.torso.rotation.y = swing * 0.22;

            // Pernas firmes
            p.leftLeg.rotation.x = 0.12;
            p.rightLeg.rotation.x = -0.08;

            // Cabeça olha para frente
            p.head.rotation.x = -swing * 0.08;
            return;
        }

        // Reset rotações de ataque
        p.torso.rotation.x = 0;
        p.torso.rotation.y = 0;
        p.head.rotation.x = 0;
        p.rightArm.rotation.z = 0.15;
        p.leftArm.rotation.z = -0.15;

        if (isMoving) {
            // Caminhada pesada de golem (mais lenta e marcada)
            const speed = 6.5;
            golem.animTime += dt * (speed - 1);
            const s = Math.sin(golem.animTime);
            const s2 = Math.sin(golem.animTime * 2);

            p.leftLeg.rotation.x = s * 0.55;
            p.rightLeg.rotation.x = -s * 0.55;
            p.leftArm.rotation.x = -s * 0.4;
            p.rightArm.rotation.x = s * 0.4;

            // Bob vertical pesado
            const bob = Math.abs(s2) * 0.06;
            p.torso.position.y = 1.0 + bob;
            p.head.position.y = 1.7 + bob * 0.5;
        } else {
            // Idle — respiração lenta e pesada
            const breath = Math.sin(golem.animTime * 1.8) * 0.035;
            p.leftLeg.rotation.x = 0;
            p.rightLeg.rotation.x = 0;
            p.leftArm.rotation.x = 0.15;
            p.rightArm.rotation.x = 0.15;
            p.torso.position.y = 1.0 + breath;
            p.head.position.y = 1.7 + breath * 0.5;

            // Cristal pulsa levemente
            if (p.core && p.core.material) {
                p.core.material.emissiveIntensity = 0.55 + Math.sin(golem.animTime * 2.5) * 0.2;
            }
        }
    }

    // Pés do mesh ficam ~0.07 abaixo da origem do group — compensamos no chão
    const GOLEM_GROUND_OFFSET = 0.08;

    class GolemManager {
        /**
         * @param {THREE.Scene} scene
         * @param {object} world
         * @param {object} player
         */
        constructor(scene, world, player) {
            this.scene = scene;
            this.world = world;
            this.player = player;
            this.golems = [];
            this.maxGolems = 1;
        }

        /**
         * Sempre usa o world atual do jogo (evita afundar ao trocar de mapa).
         * @param {object} [game]
         */
        _syncWorld(game) {
            const w = (game && game.world)
                || (this.player && this.player.world)
                || this.world;
            if (w && w !== this.world) {
                // Mapa mudou: remove golems do mapa anterior
                while (this.golems.length) this._despawn(this.golems[0]);
                this.world = w;
            } else if (w) {
                this.world = w;
            }
            return this.world;
        }

        _terrainY(world, x, z) {
            if (!world || typeof world.getTerrainHeight !== 'function') return GOLEM_GROUND_OFFSET;
            return world.getTerrainHeight(x, z) + GOLEM_GROUND_OFFSET;
        }

        /**
         * Invoca um golem perto do jogador.
         * @param {object} game
         * @returns {boolean}
         */
        summon(game) {
            const world = this._syncWorld(game);
            if (!world) return false;

            // Remove golems antigos se no limite
            while (this.golems.length >= this.maxGolems) {
                this._despawn(this.golems[0]);
            }

            const px = this.player.position.x;
            const pz = this.player.position.z;
            const ang = (this.player.rotationY || 0) + Math.PI; // atrás do player um pouco ao lado
            const ox = px + Math.sin(ang) * 2.2 + Math.cos(ang) * 1.2;
            const oz = pz + Math.cos(ang) * 2.2 - Math.sin(ang) * 1.2;
            let x = ox, z = oz;
            if (world && typeof world.resolveRadius === 'function') {
                const r = world.resolveRadius(x, z, 1.0);
                x = r.x; z = r.z;
            }
            const y = this._terrainY(world, x, z);

            const mesh = createGolemMesh();
            mesh.position.set(x, y, z);
            this.scene.add(mesh);

            const golem = {
                mesh,
                parts: mesh.userData.parts,
                pos: new THREE.Vector3(x, y, z),
                hp: 180,
                maxHp: 180,
                damage: 28,
                speed: 4.2,
                attackRange: 2.8,
                atkCd: 0,
                lifetime: 45, // segundos
                alive: true,
                attackAnim: 0,
                animTime: 0,
                isMoving: false
            };
            this.golems.push(golem);

            if (game && game.showToast) game.showToast('Golem invocado!', 'violet');
            if (game && game.spawnParticles) game.spawnParticles(golem.pos, 0xa78bfa, 20);
            return true;
        }

        update(dt, game) {
            const world = this._syncWorld(game);
            if (!world || !this.golems.length) return;
            const enemies = this._collectEnemies(game);

            for (let i = this.golems.length - 1; i >= 0; i--) {
                const g = this.golems[i];
                if (!g.alive) continue;

                g.lifetime -= dt;
                if (g.atkCd > 0) g.atkCd -= dt;
                if (g.attackAnim > 0) g.attackAnim -= dt;

                if (g.lifetime <= 0 || g.hp <= 0) {
                    if (game && game.spawnParticles) game.spawnParticles(g.pos, 0x6b7280, 14);
                    this._despawn(g);
                    continue;
                }

                // Alvo: inimigo mais próximo
                let best = null;
                let bestD = 22;
                for (let j = 0; j < enemies.length; j++) {
                    const e = enemies[j];
                    if (!e || e.alive === false) continue;
                    const ep = e.pos || e.position || (e.mesh && e.mesh.position);
                    if (!ep) continue;
                    const d = Math.hypot(ep.x - g.pos.x, ep.z - g.pos.z);
                    if (d < bestD) { bestD = d; best = e; }
                }

                let isMoving = false;

                if (best) {
                    const ep = best.pos || best.position || best.mesh.position;
                    const dx = ep.x - g.pos.x;
                    const dz = ep.z - g.pos.z;
                    const dist = Math.hypot(dx, dz) || 0.001;

                    if (dist > g.attackRange) {
                        // Persegue
                        g.pos.x += (dx / dist) * g.speed * dt;
                        g.pos.z += (dz / dist) * g.speed * dt;
                        if (typeof world.resolveRadius === 'function') {
                            const r = world.resolveRadius(g.pos.x, g.pos.z, 1.0);
                            g.pos.x = r.x;
                            g.pos.z = r.z;
                        }
                        g.pos.y = this._terrainY(world, g.pos.x, g.pos.z);
                        g.mesh.position.copy(g.pos);
                        g.mesh.rotation.y = Math.atan2(dx, dz);
                        isMoving = true;
                    } else {
                        // Ataca (ainda cola no chão do mapa atual)
                        g.pos.y = this._terrainY(world, g.pos.x, g.pos.z);
                        g.mesh.position.copy(g.pos);
                        g.mesh.rotation.y = Math.atan2(dx, dz);
                        if (g.atkCd <= 0) {
                            g.atkCd = 1.4;
                            g.attackAnim = 0.45;
                            const dmg = g.damage;
                            // Aplica dano via helpers do player se existir
                            if (this.player && typeof this.player._applySpellDamage === 'function') {
                                this.player._applySpellDamage(best, dmg, game);
                            } else if (best.hp != null) {
                                best.hp -= dmg;
                                if (best.hp <= 0 && this.player && typeof this.player._killEnemyViaManager === 'function') {
                                    this.player._killEnemyViaManager(best, game);
                                }
                            }
                            if (game && game.showPopDamage) game.showPopDamage(ep, dmg);
                            if (game && game.spawnParticles) game.spawnParticles(ep, 0xa78bfa, 6);
                        }
                    }
                } else {
                    // Segue o jogador à distância
                    const px = this.player.position.x;
                    const pz = this.player.position.z;
                    const dx = px - g.pos.x;
                    const dz = pz - g.pos.z;
                    const dist = Math.hypot(dx, dz);
                    if (dist > 5) {
                        g.pos.x += (dx / dist) * g.speed * 0.7 * dt;
                        g.pos.z += (dz / dist) * g.speed * 0.7 * dt;
                        if (typeof world.resolveRadius === 'function') {
                            const r = world.resolveRadius(g.pos.x, g.pos.z, 1.0);
                            g.pos.x = r.x;
                            g.pos.z = r.z;
                        }
                        g.pos.y = this._terrainY(world, g.pos.x, g.pos.z);
                        g.mesh.position.copy(g.pos);
                        g.mesh.rotation.y = Math.atan2(dx, dz);
                        isMoving = true;
                    } else {
                        g.pos.y = this._terrainY(world, g.pos.x, g.pos.z);
                        g.mesh.position.copy(g.pos);
                    }
                }

                g.isMoving = isMoving;
                animateGolem(g, dt, isMoving);
            }
        }

        _collectEnemies(game) {
            const list = [];
            const push = (arr) => {
                if (!arr) return;
                for (let i = 0; i < arr.length; i++) {
                    const e = arr[i];
                    if (e && e.alive !== false && !(e.hp != null && e.hp <= 0)) list.push(e);
                }
            };
            if (game) {
                push(game.enemyManager && game.enemyManager.enemies);
                push(game.banditManager && game.banditManager.enemies);
                if (game.bossManager && game.bossManager.boss) push([game.bossManager.boss]);
            }
            return list;
        }

        _despawn(g) {
            if (!g) return;
            g.alive = false;
            if (g.mesh) {
                this.scene.remove(g.mesh);
                g.mesh.traverse(o => {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) {
                        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                        else o.material.dispose();
                    }
                });
            }
            const idx = this.golems.indexOf(g);
            if (idx >= 0) this.golems.splice(idx, 1);
        }

        dispose() {
            while (this.golems.length) this._despawn(this.golems[0]);
        }
    }

    global.GolemManager = GolemManager;
    global.createGolemMesh = createGolemMesh;
})(typeof window !== 'undefined' ? window : globalThis);
