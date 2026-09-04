/**
 * personagem.js — Personagem com visual arredondado e detalhado
 * Cabeça esférica, olhos, boca, cabelo, armadura, capa e animações
 *
 * Depende de: THREE (global), Sound (global opcional)
 * Uso: const player = new Player(scene, world);
 */

class Player {
    /**
     * @param {THREE.Scene} scene
     * @param {object} world - getTerrainHeight(x,z) + colliders[]
     * @param {object} [options]
     */
    constructor(scene, world, options = {}) {
        this.scene = scene;
        this.world = world;

        // Stats
        this.hp = options.hp ?? 100;
        this.maxHp = options.maxHp ?? 100;
        this.stamina = options.stamina ?? 100;
        this.maxStamina = options.maxStamina ?? 100;
        this.mana = options.mana ?? 80;
        this.maxMana = options.maxMana ?? 80;
        this.manaRegen = options.manaRegen ?? 6; // por segundo
        this.level = options.level ?? 1;
        this.xp = options.xp ?? 0;
        this.xpNext = options.xpNext ?? (typeof xpForLevel === 'function' ? xpForLevel(1) : 100);
        this.totalXp = options.totalXp ?? 0;
        this.gold = options.gold ?? 30;
        this.skillPoints = options.skillPoints ?? 0;
        this.unlockedSkills = options.unlockedSkills || {};
        this.critChance = options.critChance ?? 0.05;
        this.magicPower = options.magicPower ?? 0;

        // Spell cooldowns (id -> remaining seconds)
        this.spellCds = {};
        this.shieldTimer = 0;
        this.shieldReduction = 0;
        this._staffCastTimer = 0;
        this._staffCastDuration = 0.5;
        this._staffCastStyle = null;

        // Movimento
        this.position = new THREE.Vector3(0, 2, 8);
        this.velocity = new THREE.Vector3();
        this.rotationY = 0;
        this.isGrounded = false;
        this.isSprinting = false;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.moveSpeed = options.moveSpeed ?? 9.5;
        this.sprintMult = options.sprintMult ?? 1.55;
        this.jumpForce = options.jumpForce ?? 11.5;
        this.gravity = options.gravity ?? 28;
        this.attackRange = options.attackRange ?? 3.6;
        this.attackDuration = options.attackDuration ?? 0.38;
        this.baseDamage = options.baseDamage ?? 22;
        this.defense = options.defense ?? 0;
        this.armorId = options.armorId ?? 'armor_cloth';
        this.skinId = options.skinId ?? 'guerreiro';
        this.skinName = options.skinName ?? 'Guerreiro';
        this.invuln = 0;
        this.invulnDuration = 0.45;

        this.animTime = 0;
        this._tmpDir = new THREE.Vector3();
        this._tmpAxis = new THREE.Vector3(0, 1, 0);

        this.mats = this._createMaterials();
        this.initMesh();
        // Aplica skin inicial (se skins.js já carregou)
        if (typeof applySkinToPlayer === 'function') {
            applySkinToPlayer(this, this.skinId);
        }
    }

    // -------------------------------------------------------------------------
    // MATERIAIS
    // -------------------------------------------------------------------------
    _createMaterials() {
        return {
            skin: new THREE.MeshStandardMaterial({
                color: 0xe8b896, roughness: 0.75, metalness: 0.05
            }),
            skinDark: new THREE.MeshStandardMaterial({
                color: 0xc9956c, roughness: 0.8, metalness: 0.05
            }),
            hair: new THREE.MeshStandardMaterial({
                color: 0x2c1810, roughness: 0.9, metalness: 0.0
            }),
            eyeWhite: new THREE.MeshStandardMaterial({
                color: 0xf5f5f5, roughness: 0.3, metalness: 0.1
            }),
            eyeIris: new THREE.MeshStandardMaterial({
                color: 0x3b82f6, roughness: 0.25, metalness: 0.2
            }),
            eyePupil: new THREE.MeshStandardMaterial({
                color: 0x0f172a, roughness: 0.4, metalness: 0.1
            }),
            mouth: new THREE.MeshStandardMaterial({
                color: 0x8b3a3a, roughness: 0.6, metalness: 0.05
            }),
            armor: new THREE.MeshStandardMaterial({
                color: 0x334155, roughness: 0.4, metalness: 0.55
            }),
            armorDark: new THREE.MeshStandardMaterial({
                color: 0x1e293b, roughness: 0.45, metalness: 0.5
            }),
            gold: new THREE.MeshStandardMaterial({
                color: 0xd97706, roughness: 0.35, metalness: 0.7
            }),
            cloth: new THREE.MeshStandardMaterial({
                color: 0xb45309, roughness: 0.85, metalness: 0.05
            }),
            clothDark: new THREE.MeshStandardMaterial({
                color: 0x78350f, roughness: 0.9, metalness: 0.05
            }),
            leather: new THREE.MeshStandardMaterial({
                color: 0x5c3d2e, roughness: 0.8, metalness: 0.1
            }),
            blade: new THREE.MeshStandardMaterial({
                color: 0xe2e8f0, roughness: 0.15, metalness: 0.95
            }),
            cape: new THREE.MeshStandardMaterial({
                color: 0x7c2d12, roughness: 0.8, metalness: 0.05, side: THREE.DoubleSide
            })
        };
    }

    // -------------------------------------------------------------------------
    // MESH — personagem arredondado e detalhado
    // -------------------------------------------------------------------------
    initMesh() {
        this.group = new THREE.Group();
        const m = this.mats;

        // ===== TORSO / ARMADURA =====
        this.torso = new THREE.Group();
        this.torso.position.y = 1.55;

        const chest = new THREE.Mesh(
            new THREE.SphereGeometry(0.52, 12, 10),
            m.armor
        );
        chest.scale.set(1.15, 1.05, 0.85);
        chest.castShadow = true;
        this.torso.add(chest);

        // Cinto dourado
        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(0.48, 0.07, 8, 16),
            m.gold
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.45;
        belt.castShadow = true;
        this.torso.add(belt);

        // Ombreiras
        const shoulderGeo = new THREE.SphereGeometry(0.22, 10, 8);
        const lShoulder = new THREE.Mesh(shoulderGeo, m.armorDark);
        lShoulder.position.set(-0.58, 0.25, 0);
        lShoulder.scale.set(1.1, 0.85, 1);
        lShoulder.castShadow = true;
        this.torso.add(lShoulder);

        const rShoulder = new THREE.Mesh(shoulderGeo, m.armorDark);
        rShoulder.position.set(0.58, 0.25, 0);
        rShoulder.scale.set(1.1, 0.85, 1);
        rShoulder.castShadow = true;
        this.torso.add(rShoulder);

        // Emblema dourado no peito
        const emblem = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 6),
            m.gold
        );
        emblem.position.set(0, 0.1, 0.42);
        emblem.scale.set(1, 1, 0.4);
        this.torso.add(emblem);

        this.group.add(this.torso);

        // ===== CABEÇA =====
        this.headGroup = new THREE.Group();
        this.headGroup.position.y = 2.35;

        // Cabeça esférica (não quadrada)
        this.head = new THREE.Mesh(
            new THREE.SphereGeometry(0.38, 16, 14),
            m.skin
        );
        this.head.castShadow = true;
        this.headGroup.add(this.head);

        // Cabelo — topo
        const hairTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.40, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
            m.hair
        );
        hairTop.position.y = 0.08;
        hairTop.castShadow = true;
        this.headGroup.add(hairTop);

        // Cabelo — volume atrás
        const hairBack = new THREE.Mesh(
            new THREE.SphereGeometry(0.36, 10, 8),
            m.hair
        );
        hairBack.position.set(0, 0.02, -0.12);
        hairBack.scale.set(1.05, 1.1, 0.9);
        hairBack.castShadow = true;
        this.headGroup.add(hairBack);

        // Franja
        const fringe = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 8, 6),
            m.hair
        );
        fringe.position.set(0, 0.18, 0.28);
        fringe.scale.set(1.4, 0.55, 0.5);
        this.headGroup.add(fringe);

        // --- Olhos ---
        const makeEye = (x) => {
            const eyeG = new THREE.Group();
            const white = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 10, 8),
                m.eyeWhite
            );
            white.scale.set(1, 1.05, 0.7);
            eyeG.add(white);

            const iris = new THREE.Mesh(
                new THREE.SphereGeometry(0.045, 8, 6),
                m.eyeIris
            );
            iris.position.z = 0.045;
            eyeG.add(iris);

            const pupil = new THREE.Mesh(
                new THREE.SphereGeometry(0.022, 6, 5),
                m.eyePupil
            );
            pupil.position.z = 0.07;
            eyeG.add(pupil);

            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.012, 5, 4),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            shine.position.set(0.015, 0.015, 0.085);
            eyeG.add(shine);

            eyeG.position.set(x, 0.04, 0.30);
            return eyeG;
        };
        this.headGroup.add(makeEye(-0.13));
        this.headGroup.add(makeEye(0.13));

        // Sobrancelhas
        const browGeo = new THREE.SphereGeometry(0.06, 6, 4);
        const lBrow = new THREE.Mesh(browGeo, m.hair);
        lBrow.position.set(-0.13, 0.14, 0.32);
        lBrow.scale.set(1.3, 0.35, 0.5);
        lBrow.rotation.z = 0.15;
        this.headGroup.add(lBrow);

        const rBrow = new THREE.Mesh(browGeo, m.hair);
        rBrow.position.set(0.13, 0.14, 0.32);
        rBrow.scale.set(1.3, 0.35, 0.5);
        rBrow.rotation.z = -0.15;
        this.headGroup.add(rBrow);

        // Nariz
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 8, 6),
            m.skinDark
        );
        nose.position.set(0, -0.02, 0.35);
        nose.scale.set(0.7, 0.9, 0.85);
        this.headGroup.add(nose);

        // Boca
        const mouth = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 8, 6),
            m.mouth
        );
        mouth.position.set(0, -0.14, 0.32);
        mouth.scale.set(1.1, 0.35, 0.4);
        this.headGroup.add(mouth);

        // Orelhas
        const earGeo = new THREE.SphereGeometry(0.09, 8, 6);
        const lEar = new THREE.Mesh(earGeo, m.skin);
        lEar.position.set(-0.36, 0.0, 0.02);
        lEar.scale.set(0.55, 1, 0.7);
        this.headGroup.add(lEar);

        const rEar = new THREE.Mesh(earGeo, m.skin);
        rEar.position.set(0.36, 0.0, 0.02);
        rEar.scale.set(0.55, 1, 0.7);
        this.headGroup.add(rEar);

        // Pescoço
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.16, 0.22, 10),
            m.skin
        );
        neck.position.y = -0.42;
        neck.castShadow = true;
        this.headGroup.add(neck);

        this.group.add(this.headGroup);

        // ===== BRAÇOS =====
        this.leftArm = this._makeLimb(m, -1);
        this.rightArm = this._makeLimb(m, 1);
        this.group.add(this.leftArm);
        this.group.add(this.rightArm);

        // ===== PERNAS =====
        this.leftLeg = this._makeLeg(m, -1);
        this.rightLeg = this._makeLeg(m, 1);
        this.group.add(this.leftLeg);
        this.group.add(this.rightLeg);

        // ===== CAPA =====
        this.cape = new THREE.Mesh(
            new THREE.PlaneGeometry(1.1, 1.3, 4, 4),
            m.cape
        );
        this.cape.position.set(0, 1.4, -0.45);
        this.cape.castShadow = true;
        const capePos = this.cape.geometry.attributes.position;
        for (let i = 0; i < capePos.count; i++) {
            const y = capePos.getY(i);
            const x = capePos.getX(i);
            if (y < 0) {
                capePos.setZ(i, -0.15 * (1 + y / 0.65) + Math.sin(x * 3) * 0.04);
            }
        }
        capePos.needsUpdate = true;
        this.cape.geometry.computeVertexNormals();
        this.group.add(this.cape);

        // ===== ESPADA =====
        this.sword = this._makeSword(m);
        this.rightArm.add(this.sword);

        this.group.position.copy(this.position);
        this.scene.add(this.group);
    }

    /** Braço arredondado */
    _makeLimb(m, side) {
        const arm = new THREE.Group();
        arm.position.set(side * 0.72, 1.85, 0);

        const upper = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.11, 0.55, 10),
            m.armor
        );
        upper.position.y = -0.28;
        upper.castShadow = true;
        arm.add(upper);

        const elbow = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 6),
            m.armorDark
        );
        elbow.position.y = -0.55;
        elbow.castShadow = true;
        arm.add(elbow);

        const lower = new THREE.Mesh(
            new THREE.CylinderGeometry(0.10, 0.09, 0.42, 10),
            m.armor
        );
        lower.position.y = -0.78;
        lower.castShadow = true;
        arm.add(lower);

        const hand = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 6),
            m.skin
        );
        hand.position.y = -1.05;
        hand.scale.set(1, 0.85, 0.9);
        hand.castShadow = true;
        arm.add(hand);

        const bracelet = new THREE.Mesh(
            new THREE.TorusGeometry(0.11, 0.025, 6, 12),
            m.gold
        );
        bracelet.rotation.x = Math.PI / 2;
        bracelet.position.y = -0.62;
        arm.add(bracelet);

        return arm;
    }

    /** Perna com bota */
    _makeLeg(m, side) {
        const leg = new THREE.Group();
        leg.position.set(side * 0.22, 1.0, 0);

        const thigh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.13, 0.5, 10),
            m.cloth
        );
        thigh.position.y = -0.2;
        thigh.castShadow = true;
        leg.add(thigh);

        const knee = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 6),
            m.clothDark
        );
        knee.position.y = -0.48;
        knee.castShadow = true;
        leg.add(knee);

        const shin = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11, 0.10, 0.42, 10),
            m.cloth
        );
        shin.position.y = -0.72;
        shin.castShadow = true;
        leg.add(shin);

        const boot = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 10, 8),
            m.leather
        );
        boot.position.set(0, -1.0, 0.04);
        boot.scale.set(1, 0.7, 1.25);
        boot.castShadow = true;
        leg.add(boot);

        const bootTop = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.13, 0.18, 10),
            m.leather
        );
        bootTop.position.y = -0.92;
        bootTop.castShadow = true;
        leg.add(bootTop);

        return leg;
    }

    /** Espada com guarda e cabo */
    _makeSword(m) {
        const sword = new THREE.Group();

        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 1.7, 0.22),
            m.blade
        );
        blade.position.y = 0.95;
        blade.castShadow = true;
        sword.add(blade);

        const tip = new THREE.Mesh(
            new THREE.ConeGeometry(0.11, 0.28, 4),
            m.blade
        );
        tip.position.y = 1.9;
        tip.rotation.y = Math.PI / 4;
        tip.castShadow = true;
        sword.add(tip);

        const guard = new THREE.Mesh(
            new THREE.BoxGeometry(0.45, 0.08, 0.14),
            m.gold
        );
        guard.position.y = 0.12;
        guard.castShadow = true;
        sword.add(guard);

        const hilt = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.05, 0.35, 8),
            m.leather
        );
        hilt.position.y = -0.08;
        sword.add(hilt);

        const pommel = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 8, 6),
            m.gold
        );
        pommel.position.y = -0.28;
        sword.add(pommel);

        sword.position.set(0.05, -1.0, 0.12);
        sword.rotation.x = Math.PI / 2.8;
        sword.rotation.z = -0.15;

        return sword;
    }

    setColors({ armor, cloth, skin, hair, cape } = {}) {
        if (armor) {
            this.mats.armor.color.setHex(armor);
            this.mats.armorDark.color.setHex(armor);
        }
        if (cloth) {
            this.mats.cloth.color.setHex(cloth);
            this.mats.clothDark.color.setHex(cloth);
        }
        if (skin) this.mats.skin.color.setHex(skin);
        if (hair) this.mats.hair.color.setHex(hair);
        if (cape) this.mats.cape.color.setHex(cape);
    }

    // -------------------------------------------------------------------------
    // UPDATE
    // -------------------------------------------------------------------------
    update(dt, keys, camYaw, firstPerson) {
        if (this.invuln > 0) this.invuln -= dt;

        const analogMoving = (typeof keys._moveX === 'number' && typeof keys._moveY === 'number')
            && (Math.abs(keys._moveX) > 0.05 || Math.abs(keys._moveY) > 0.05);
        const moving = !!(keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD || analogMoving);
        this.isSprinting = !!(keys.ShiftLeft && moving && this.stamina > 4);

        const skFx = this._skillEffects();
        const stamCostMult = 1 + (skFx.staminaCostPct || 0);
        const stamRegenMult = 1 + (skFx.staminaRegenPct || 0);

        if (this.isSprinting) {
            this.stamina = Math.max(0, this.stamina - 22 * stamCostMult * dt);
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + 18 * stamRegenMult * dt);
        }

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            if (this.attackCooldown <= 0) this.isAttacking = false;
        }

        // Mana + skill regen
        this.updateMagic(dt);

        const speed = this.moveSpeed * (this.isSprinting ? this.sprintMult : 1);
        const dir = this._tmpDir.set(0, 0, 0);
        // Analógico do joystick virtual (mobile) tem prioridade
        if (typeof keys._moveX === 'number' && typeof keys._moveY === 'number'
            && (keys._moveX !== 0 || keys._moveY !== 0)) {
            dir.x = keys._moveX;
            dir.z = keys._moveY;
        } else {
            if (keys.KeyW) dir.z -= 1;
            if (keys.KeyS) dir.z += 1;
            if (keys.KeyA) dir.x -= 1;
            if (keys.KeyD) dir.x += 1;
        }

        if (dir.lengthSq() > 0) {
            // Mantém magnitude parcial do analógico (até 1)
            const mag = Math.min(1, dir.length());
            dir.normalize().multiplyScalar(mag).applyAxisAngle(this._tmpAxis, camYaw);

            if (firstPerson) {
                // Em 1ª pessoa o corpo sempre olha na direção da câmera (não gira ao strafear)
                this.rotationY = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
            } else {
                let targetRot = Math.atan2(dir.x, dir.z);
                let diff = targetRot - this.rotationY;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI)  diff -= Math.PI * 2;
                this.rotationY += diff * Math.min(1, 14 * dt);
            }

            this.velocity.x = dir.x * speed;
            this.velocity.z = dir.z * speed;

            if (this.isGrounded && typeof Sound !== 'undefined') {
                Sound.playFootstep?.();
            }
        } else {
            this.velocity.x *= 0.78;
            this.velocity.z *= 0.78;
            if (firstPerson) {
                // Parado: mantém alinhado à mira
                this.rotationY = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
            }
        }

        if (keys.Space && this.isGrounded) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }

        this.velocity.y -= this.gravity * dt;
        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
        this.position.y += this.velocity.y * dt;

        const terrainY = this.world.getTerrainHeight(this.position.x, this.position.z);
        if (this.position.y <= terrainY) {
            this.position.y = terrainY;
            this.velocity.y = 0;
            this.isGrounded = true;
        }

        this._resolveColliders();

        const bound = (this.world && this.world.cfg && this.world.cfg.bound) ? this.world.cfg.bound : 145;
        this.position.x = Math.max(-bound, Math.min(bound, this.position.x));
        this.position.z = Math.max(-bound, Math.min(bound, this.position.z));

        this.group.position.copy(this.position);
        this.group.rotation.y = this.rotationY;
        // Garante mesh oculto em 1ª pessoa (evita ver as costas)
        if (firstPerson) this.group.visible = false;
        else if (this.group.visible === false) this.group.visible = true;

        this.animate(dt, moving);
    }

    _resolveColliders() {
        const colliders = this.world.colliders;
        const bodyR = 0.55;
        if (colliders) {
            for (let i = 0, len = colliders.length; i < len; i++) {
                const c = colliders[i];

                // A cerca é um obstáculo físico no chão, mas NÃO deve bloquear
                // o jogador quando ele estiver pulando por cima dela.
                // Os postes têm ~1.55m de altura; quando os pés do jogador
                // estão acima do topo da cerca, ignoramos o colisor horizontal.
                if (c.type === 'fence') {
                    const groundY = this.world.getTerrainHeight(this.position.x, this.position.z);
                    const fenceTop = groundY + 1.65;
                    if (this.position.y > fenceTop) continue;
                }

                // Portas de teleporte: não empurram — o jogo teleporta ao colidir
                if (c.type === 'teleport') continue;
                // Colisor retangular (AABB) — muros, keep, etc.
                if (c.halfW != null && c.halfD != null) {
                    const nearestX = Math.max(c.x - c.halfW, Math.min(this.position.x, c.x + c.halfW));
                    const nearestZ = Math.max(c.z - c.halfD, Math.min(this.position.z, c.z + c.halfD));
                    let dx = this.position.x - nearestX;
                    let dz = this.position.z - nearestZ;
                    let dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < bodyR) {
                        if (dist < 0.001) {
                            // Centro exatamente dentro: empurra pelo eixo de menor penetração
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
                // Colisor circular (torres, árvores, rochas, baús...)
                if (c.radius == null) continue;
                const dx = this.position.x - c.x;
                const dz = this.position.z - c.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                const minD = c.radius + bodyR;
                if (dist < minD && dist > 0.001) {
                    const o = minD - dist;
                    this.position.x += (dx / dist) * o;
                    this.position.z += (dz / dist) * o;
                }
            }
        }

        // Muralha sólida (anel contínuo) — com abertura no portão
        this._resolveSolidWall();
    }

    /** Impede atravessar a muralha; deixa passar pelos portões (leste + norte) */
    _resolveSolidWall() {
        const cfg = this.world && this.world.cfg;
        if (!cfg || !cfg.wallRadius) return;

        const R = cfg.wallRadius;
        const halfT = (cfg.wallThickness || 3.2) * 0.55;
        const bodyR = 0.55;
        const inner = R - halfT - bodyR;
        const outer = R + halfT + bodyR;

        const x = this.position.x;
        const z = this.position.z;
        const dist = Math.hypot(x, z);
        if (dist < 0.001) return;

        // Dentro da faixa da muralha?
        if (dist <= inner || dist >= outer) return;

        const ang = Math.atan2(x, z); // x=sin(a)*R, z=cos(a)*R
        const norm = (a) => {
            while (a > Math.PI) a -= Math.PI * 2;
            while (a < -Math.PI) a += Math.PI * 2;
            return a;
        };

        // Portão 1 (leste → Vale)
        let gateHalf = cfg.gateHalfAngle || 0;
        if (gateHalf < 0.001 && cfg.gateWidth > 0.5) {
            gateHalf = (cfg.gateWidth * 0.5) / R;
        }
        const gateA = cfg.gateAngle != null ? cfg.gateAngle : Math.PI / 2;
        if (gateHalf > 0 && Math.abs(norm(ang - gateA)) < gateHalf) return;

        // Portão 2 (norte → Castelo)
        let gate2Half = cfg.gate2HalfAngle || 0;
        if (gate2Half < 0.001 && cfg.gate2Width > 0.5) {
            gate2Half = (cfg.gate2Width * 0.5) / R;
        }
        const gate2A = cfg.gate2Angle != null ? cfg.gate2Angle : Math.PI;
        if (gate2Half > 0 && Math.abs(norm(ang - gate2A)) < gate2Half) return;

        // Empurra para o lado de dentro ou de fora (o mais próximo)
        const nx = x / dist;
        const nz = z / dist;
        if (dist < R) {
            this.position.x = nx * inner;
            this.position.z = nz * inner;
        } else {
            this.position.x = nx * outer;
            this.position.z = nz * outer;
        }
    }

    // -------------------------------------------------------------------------
    // ANIMAÇÃO
    // -------------------------------------------------------------------------
    animate(dt, moving) {
        this.animTime += dt * (this.isSprinting ? 13 : 8.5);

        // Efeito de cor no orbe do cajado ao lançar magia (sem girar o cajado)
        if (this._staffCastTimer > 0 && this._mageStaff) {
            this._staffCastTimer -= dt;
            const dur = this._staffCastDuration || 0.55;
            const prog = 1 - Math.max(0, this._staffCastTimer) / dur;
            const pulse = Math.sin(Math.min(1, prog) * Math.PI); // 0→1→0
            const style = this._staffCastStyle || 'cast';

            const orbColors = {
                fireball: 0xf97316,
                lightning: 0x38bdf8,
                heal: 0x4ade80,
                shadow_explosion: 0x7c3aed,
                magic_shield: 0x60a5fa,
                summon_golem: 0x9ca3af,
                cast: 0xc084fc
            };
            const hex = orbColors[style] || orbColors.cast;

            this._mageStaff.traverse(o => {
                if (!o.material || o.material.emissiveIntensity == null) return;
                if (!o.material.userData) o.material.userData = {};
                if (o.material.userData._baseEmiColor == null && o.material.emissive) {
                    o.material.userData._baseEmiColor = o.material.emissive.getHex();
                }
                if (o.material.userData._baseColor == null && o.material.color) {
                    o.material.userData._baseColor = o.material.color.getHex();
                }
                const baseE = o.material.userData._baseEmi != null ? o.material.userData._baseEmi : 0.45;
                o.material.emissive.setHex(hex);
                o.material.emissiveIntensity = baseE + pulse * 1.6;
                if (o.material.color) o.material.color.setHex(hex);
            });

            if (this._staffCastTimer <= 0) {
                this._staffCastTimer = 0;
                this._staffCastStyle = null;
                this._mageStaff.traverse(o => {
                    if (!o.material || !o.material.userData) return;
                    if (o.material.userData._baseEmi != null) {
                        o.material.emissiveIntensity = o.material.userData._baseEmi;
                    }
                    if (o.material.userData._baseEmiColor != null && o.material.emissive) {
                        o.material.emissive.setHex(o.material.userData._baseEmiColor);
                    }
                    if (o.material.userData._baseColor != null && o.material.color) {
                        o.material.color.setHex(o.material.userData._baseColor);
                    }
                });
            }
        }

        if (this.isAttacking) {
            // Mago não usa ataque corpo a corpo
            if (this.isMageSkin && this.isMageSkin()) {
                this.isAttacking = false;
                this.attackCooldown = 0;
            } else {
                const p = (this.attackDuration - this.attackCooldown) / this.attackDuration;
                const swing = Math.sin(p * Math.PI);
                this.rightArm.rotation.x = -Math.PI / 2 + swing * 1.5;
                this.rightArm.rotation.y = -swing * 1.15;
                this.rightArm.rotation.z = swing * 0.3;
                this.torso.rotation.y = swing * 0.25;
                return;
            }
        }

        this.rightArm.rotation.z = 0;
        this.torso.rotation.y = 0;

        if (!this.isGrounded) {
            this.leftArm.rotation.x = -0.85;
            this.rightArm.rotation.x = -0.85;
            this.leftLeg.rotation.x = 0.4;
            this.rightLeg.rotation.x = -0.35;
            this.headGroup.rotation.x = 0.1;
        } else if (moving) {
            const s = Math.sin(this.animTime);
            const s2 = Math.sin(this.animTime * 2);

            this.leftLeg.rotation.x = s * 0.7;
            this.rightLeg.rotation.x = -s * 0.7;
            this.leftArm.rotation.x = -s * 0.55;
            this.rightArm.rotation.x = s * 0.55;
            this.rightArm.rotation.y = 0;

            this.torso.position.y = 1.55 + Math.abs(s2) * 0.03;
            this.headGroup.position.y = 2.35 + Math.abs(s2) * 0.03;

            if (this.cape) {
                this.cape.rotation.x = 0.15 + Math.abs(s) * 0.12;
                this.cape.position.z = -0.45 - Math.abs(s) * 0.08;
            }
        } else {
            const breath = Math.sin(performance.now() * 0.0022) * 0.035;
            this.torso.position.y = 1.55 + breath;
            this.headGroup.position.y = 2.35 + breath * 0.6;
            this.headGroup.rotation.x = breath * 0.3;

            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = 0.08;
            this.rightArm.rotation.x = 0.08;
            this.rightArm.rotation.y = 0;

            if (this.cape) {
                this.cape.rotation.x = 0.12 + breath * 0.5;
                this.cape.position.z = -0.45;
            }
        }
    }

    // -------------------------------------------------------------------------
    // COMBATE / STATS
    // -------------------------------------------------------------------------
    attack() {
        // Mago não ataca corpo a corpo — só magias
        if (this.isMageSkin && this.isMageSkin()) return false;
        if (this.attackCooldown > 0) return false;
        this.isAttacking = true;
        this.attackCooldown = this.attackDuration;
        if (typeof Sound !== 'undefined') {
            Sound.playSwordSwing?.();
        }
        return true;
    }

    getAttackDamage() {
        let dmg = this.baseDamage + (Math.random() * 12 | 0) + this.level * 2;
        // Skill bonuses
        const sk = this._skillEffects();
        if (sk.damagePct) dmg *= (1 + sk.damagePct);
        if (sk.lowHpDmg && this.hp / this.maxHp < 0.4) dmg *= (1 + sk.lowHpDmg);
        // Crit
        const crit = this.critChance + (sk.critChance || 0);
        if (Math.random() < crit) {
            dmg *= 1.75;
            this._lastCrit = true;
        } else {
            this._lastCrit = false;
        }
        return Math.round(dmg);
    }

    _skillEffects() {
        if (!this.unlockedSkills) return {};
        const out = {};
        const tree = (typeof PROGRESSION !== 'undefined') ? PROGRESSION.skillTree : null;
        if (!tree) return out;
        for (const branch of Object.values(tree)) {
            for (const sk of branch.skills) {
                if (this.unlockedSkills[sk.id] && sk.effect) {
                    for (const [k, v] of Object.entries(sk.effect)) {
                        if (typeof v === 'number') out[k] = (out[k] || 0) + v;
                        else out[k] = v;
                    }
                }
            }
        }
        return out;
    }

    takeDamage(amount) {
        if (this.invuln > 0) return false;
        const sk = this._skillEffects();
        // Dodge
        if (sk.dodgeChance && Math.random() < sk.dodgeChance) {
            if (typeof Sound !== 'undefined') Sound.playHit?.();
            return false;
        }
        let def = Math.min(0.75, (this.defense || 0) + (sk.defensePct || 0));
        let mult = (1 - def) * (1 - (sk.dmgReduction || 0));
        if (this.shieldTimer > 0 && this.shieldReduction > 0) {
            mult *= (1 - this.shieldReduction);
        }
        const reduced = Math.max(1, Math.round(amount * mult));
        this.hp = Math.max(0, this.hp - reduced);
        this.invuln = this.invulnDuration;
        if (typeof Sound !== 'undefined') Sound.playHit?.();
        return true;
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    gainXP(amount, onLevelUp) {
        if (!amount || amount <= 0) return;
        const maxLvl = (typeof PROGRESSION !== 'undefined') ? PROGRESSION.maxLevel : 30;
        if (this.level >= maxLvl) {
            this.xp = this.xpNext;
            return;
        }
        this.xp += amount;
        this.totalXp = (this.totalXp || 0) + amount;
        let leveled = false;
        while (this.xp >= this.xpNext && this.level < maxLvl) {
            this.xp -= this.xpNext;
            const newLevel = this.level + 1;
            if (typeof applyLevelUp === 'function') {
                applyLevelUp(this, newLevel);
            } else {
                this.level = newLevel;
                this.maxHp += 20;
                this.baseDamage += 3;
                this.defense = Math.min(0.75, (this.defense || 0) + 0.02);
                this.maxStamina = Math.min(200, this.maxStamina + 8);
                this.maxMana = (this.maxMana || 80) + 12;
                this.skillPoints = (this.skillPoints || 0) + 1;
                this.hp = this.maxHp;
                this.stamina = this.maxStamina;
                this.mana = this.maxMana;
                this.xpNext = Math.floor(this.xpNext * 1.42);
            }
            leveled = true;
            if (typeof Sound !== 'undefined') Sound.playLevelUp?.();
            if (typeof onLevelUp === 'function') onLevelUp(this.level);
        }
        if (this.level >= maxLvl) this.xp = Math.min(this.xp, this.xpNext);
        return leveled;
    }

    /** Regenera mana e timers de spell */
    updateMagic(dt) {
        const sk = this._skillEffects();
        let regen = this.manaRegen * (1 + (sk.manaRegenPct || 0));
        this.mana = Math.min(this.maxMana, this.mana + regen * dt);
        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shieldTimer = 0;
                this.shieldReduction = 0;
            }
        }
        for (const id of Object.keys(this.spellCds)) {
            this.spellCds[id] = Math.max(0, this.spellCds[id] - dt);
        }
        // HP regen out of combat (skill)
        if (sk.hpRegen && this.invuln <= 0) {
            this.hp = Math.min(this.maxHp, this.hp + sk.hpRegen * dt);
        }
    }

    /** Magia só com skin Mago */
    isMageSkin() {
        return this.skinId === 'mago' || this.usesStaff === true;
    }

    canCast(spellId) {
        if (!this.isMageSkin()) return false;
        const spells = (typeof PROGRESSION !== 'undefined') ? PROGRESSION.spells : null;
        if (!spells || !spells[spellId]) return false;
        const sp = spells[spellId];
        if ((this.spellCds[spellId] || 0) > 0) return false;
        let cost = sp.manaCost;
        const sk = this._skillEffects();
        if (sk.manaCostPct) cost *= (1 + sk.manaCostPct);
        return this.mana >= cost;
    }

    /** Lista todos os inimigos vivos dos managers do jogo */
    _collectLivingEnemies(game) {
        const list = [];
        const pushFrom = (arr) => {
            if (!arr) return;
            for (let i = 0; i < arr.length; i++) {
                const e = arr[i];
                if (!e || e.alive === false || e.dead || (e.hp != null && e.hp <= 0)) continue;
                list.push(e);
            }
        };
        if (game) {
            pushFrom(game.enemyManager && game.enemyManager.enemies);
            pushFrom(game.banditManager && game.banditManager.enemies);
            if (game.bossManager && game.bossManager.boss) pushFrom([game.bossManager.boss]);
            if (game.bossManager && game.bossManager.enemies) pushFrom(game.bossManager.enemies);
        }
        return list;
    }

    /** Aplica dano mágico e mata o inimigo se HP <= 0 */
    _applySpellDamage(e, dmg, game) {
        if (!e || e.alive === false || e.dead) return false;
        dmg = Math.max(1, Math.round(dmg));
        e.hp = (e.hp != null ? e.hp : 1) - dmg;

        const pos = e.pos || e.position || (e.mesh && e.mesh.position);
        if (game && pos) {
            if (typeof game.showPopDamage === 'function') game.showPopDamage(pos, dmg);
            if (typeof game.spawnParticles === 'function') game.spawnParticles(pos, 0xa78bfa, 8);
        }
        if (typeof Sound !== 'undefined') Sound.playHit?.();

        if (e.hp <= 0) {
            e.hp = 0;
            this._killEnemyViaManager(e, game);
            return true;
        }
        // Atualiza barra de vida se existir
        try {
            if (e.barFg && e.maxHp) {
                const pct = Math.max(0, e.hp / e.maxHp);
                e.barFg.scale.x = pct;
                e.barFg.position.x = -0.55 * (1 - pct);
            }
        } catch (_) {}
        return false;
    }

    _killEnemyViaManager(e, game) {
        if (!game || !e) return;
        // EnemyManager
        if (game.enemyManager && typeof game.enemyManager._killEnemy === 'function'
            && Array.isArray(game.enemyManager.enemies)
            && game.enemyManager.enemies.includes(e)) {
            const rewards = game.enemyManager._killEnemy(e);
            if (rewards && typeof game.onEnemyKilled === 'function') game.onEnemyKilled(e, rewards);
            return;
        }
        // BanditManager
        if (game.banditManager && typeof game.banditManager._killEnemy === 'function'
            && Array.isArray(game.banditManager.enemies)
            && game.banditManager.enemies.includes(e)) {
            const rewards = game.banditManager._killEnemy(e);
            if (rewards && typeof game.onEnemyKilled === 'function') game.onEnemyKilled(e, rewards);
            return;
        }
        // BossManager
        if (game.bossManager) {
            if (game.bossManager.boss === e && typeof game.bossManager._killBoss === 'function') {
                game.bossManager._killBoss(e);
                return;
            }
            if (typeof game.bossManager._killEnemy === 'function'
                && Array.isArray(game.bossManager.enemies)
                && game.bossManager.enemies.includes(e)) {
                game.bossManager._killEnemy(e);
                return;
            }
        }
        // Fallback: remove mesh e marca morto
        e.alive = false;
        e.dead = true;
        if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
        else if (e.mesh && game.scene) game.scene.remove(e.mesh);
    }

    /** Inicia animação do cajado conforme a habilidade */
    playStaffCastAnim(spellId) {
        const styles = {
            fireball: { style: 'fireball', duration: 0.55 },
            lightning: { style: 'lightning', duration: 0.45 },
            heal: { style: 'heal', duration: 0.7 },
            shadow_explosion: { style: 'shadow_explosion', duration: 0.65 },
            magic_shield: { style: 'magic_shield', duration: 0.6 },
            summon_golem: { style: 'summon_golem', duration: 0.7 }
        };
        const cfg = styles[spellId] || { style: 'cast', duration: 0.5 };
        this._staffCastStyle = cfg.style;
        this._staffCastDuration = cfg.duration;
        this._staffCastTimer = cfg.duration;
    }

    castSpell(spellId, game) {
        // Só o Mago usa magia
        if (!this.isMageSkin()) {
            if (game && game.showToast) {
                game.showToast('Só o Mago pode usar magias. Equipe a skin Mago.', 'amber');
            }
            return false;
        }
        if (!this.canCast(spellId)) return false;
        const sp = PROGRESSION.spells[spellId];
        const sk = this._skillEffects();
        let cost = sp.manaCost;
        if (sk.manaCostPct) cost *= (1 + sk.manaCostPct);
        this.mana -= cost;
        this.spellCds[spellId] = sp.cooldown;
        // Animação do cajado para cada habilidade
        this.playStaffCastAnim(spellId);

        let power = 1 + (this.magicPower || 0) + (sk.magicPower || 0);
        if (spellId === 'fireball' && sk.fireDmgPct) power += sk.fireDmgPct;
        if (spellId === 'lightning' && sk.lightningDmgPct) power += sk.lightningDmgPct;

        if (typeof Sound !== 'undefined') {
            if (spellId === 'heal') Sound.playLevelUp?.();
            else if (spellId === 'magic_shield') Sound.playPickup?.();
            else Sound.playSwordSwing?.();
        }

        if (spellId === 'heal') {
            const amt = Math.round((sp.healAmount + (sp.healScale || 0) * (this.maxMana || 80)) * power);
            this.heal(amt);
            if (game && game.showToast) game.showToast(`+${amt} HP`, 'emerald');
            if (game && game.spawnHealEffect) game.spawnHealEffect(this.position);
            return true;
        }

        if (spellId === 'magic_shield') {
            this.shieldTimer = sp.duration;
            this.shieldReduction = sp.damageReduction;
            if (game && game.showToast) game.showToast('Escudo Mágico ativo!', 'sky');
            if (game && game.spawnShieldEffect) game.spawnShieldEffect(this.position);
            return true;
        }

        if (spellId === 'summon_golem') {
            if (game && game.golemManager && typeof game.golemManager.summon === 'function') {
                game.golemManager.summon(game);
            } else if (typeof GolemManager !== 'undefined' && game) {
                if (!game.golemManager) {
                    game.golemManager = new GolemManager(game.scene, game.world, this);
                }
                game.golemManager.summon(game);
            } else if (game && game.showToast) {
                game.showToast('Golem indisponível', 'red');
            }
            return true;
        }

        const enemies = this._collectLivingEnemies(game);
        let best = null;
        let bestD = sp.range || 20;
        const px = this.position.x, pz = this.position.z;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const ep = e.pos || e.position || (e.mesh && e.mesh.position);
            if (!ep) continue;
            const dx = ep.x - px, dz = ep.z - pz;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < bestD) { bestD = d; best = e; }
        }

        if (spellId === 'shadow_explosion') {
            const radius = sp.radius || 7;
            const dmgBase = sp.damage * power * (1 + (sp.damageScale || 0));
            let hits = 0;
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (!e || e.alive === false) continue;
                const ep = e.pos || e.position || (e.mesh && e.mesh.position);
                if (!ep) continue;
                const dx = ep.x - px, dz = ep.z - pz;
                if (dx * dx + dz * dz <= radius * radius) {
                    this._applySpellDamage(e, dmgBase, game);
                    hits++;
                }
            }
            if (game && game.showToast) {
                game.showToast(hits ? `Explosão Sombria! (${hits})` : 'Explosão Sombria!', 'violet');
            }
            if (game && game.spawnShadowExplosionEffect) game.spawnShadowExplosionEffect(this.position);
            return true;
        }

        const targetPos = best
            ? (best.pos || best.position || (best.mesh && best.mesh.position) || this.position)
            : { x: this.position.x + Math.sin(this.rotationY) * 8, y: this.position.y, z: this.position.z + Math.cos(this.rotationY) * 8 };

        if (spellId === 'fireball') {
            if (game && game.spawnFireballEffect) {
                game.spawnFireballEffect(this.position, targetPos);
            }
            if (best) {
                const dmg = Math.round(sp.damage * power * (1 + (sp.damageScale || 0)));
                const target = best;
                setTimeout(() => {
                    if (!target || target.alive === false || target.dead || (target.hp != null && target.hp <= 0)) return;
                    this._applySpellDamage(target, dmg, game);
                }, 280);
                if (game && game.showToast) game.showToast(`${sp.icon} ${dmg} dano`, 'amber');
            } else if (game && game.showToast) {
                game.showToast('Bola de Fogo!', 'amber');
            }
            return true;
        }

        if (spellId === 'lightning') {
            if (game && game.spawnLightningEffect) {
                game.spawnLightningEffect(this.position, targetPos);
            }
            if (best) {
                const dmg = Math.round(sp.damage * power * (1 + (sp.damageScale || 0)));
                this._applySpellDamage(best, dmg, game);
                if (game && game.showToast) game.showToast(`${sp.icon} ${dmg} dano`, 'sky');
            } else if (game && game.showToast) {
                game.showToast('Raio!', 'sky');
            }
            return true;
        }

        return true;
    }

    unlockSkill(skillId) {
        const tree = PROGRESSION && PROGRESSION.skillTree;
        if (!tree) return false;
        let skill = null;
        for (const branch of Object.values(tree)) {
            skill = branch.skills.find(s => s.id === skillId);
            if (skill) break;
        }
        if (!skill) return false;
        if (this.unlockedSkills[skillId]) return false;
        if (this.level < skill.levelReq) return false;
        if ((this.skillPoints || 0) < skill.cost) return false;
        if (skill.prereq && !this.unlockedSkills[skill.prereq]) return false;
        this.skillPoints -= skill.cost;
        this.unlockedSkills[skillId] = true;
        // Apply flat bonuses immediately
        if (skill.effect) {
            if (skill.effect.maxHpFlat) {
                this.maxHp += skill.effect.maxHpFlat;
                this.hp = Math.min(this.maxHp, this.hp + skill.effect.maxHpFlat);
            }
            if (skill.effect.maxManaFlat) {
                this.maxMana += skill.effect.maxManaFlat;
                this.mana = Math.min(this.maxMana, this.mana + skill.effect.maxManaFlat);
            }
            if (skill.effect.critChance) this.critChance = (this.critChance || 0.05) + skill.effect.critChance;
            if (skill.effect.magicPower) this.magicPower = (this.magicPower || 0) + skill.effect.magicPower;
            if (skill.effect.moveSpeedPct) this.moveSpeed *= (1 + skill.effect.moveSpeedPct);
            if (skill.effect.jumpForcePct) this.jumpForce *= (1 + skill.effect.jumpForcePct);
        }
        return true;
    }

    toSaveData() {
        return {
            level: this.level,
            xp: this.xp,
            xpNext: this.xpNext,
            totalXp: this.totalXp || 0,
            gold: this.gold,
            maxHp: this.maxHp,
            maxStamina: this.maxStamina,
            maxMana: this.maxMana,
            mana: this.mana,
            armorId: this.armorId || 'armor_cloth',
            skinId: this.skinId || 'guerreiro',
            defense: this.defense || 0,
            baseDamage: this.baseDamage || 22,
            weaponId: this.weaponId || 'sword_iron',
            attackRange: this.attackRange || 3.6,
            attackDuration: this.attackDuration || 0.38,
            skillPoints: this.skillPoints || 0,
            unlockedSkills: this.unlockedSkills || {},
            critChance: this.critChance || 0.05,
            magicPower: this.magicPower || 0
        };
    }

    fromSaveData(data) {
        if (!data) return;
        this.level = data.level ?? 1;
        this.xp = data.xp ?? 0;
        this.xpNext = data.xpNext ?? (typeof xpForLevel === 'function' ? xpForLevel(this.level) : 100);
        this.totalXp = data.totalXp ?? 0;
        this.gold = data.gold ?? 0;
        this.maxHp = data.maxHp ?? 100;
        this.hp = this.maxHp;
        this.maxStamina = data.maxStamina ?? 100;
        this.stamina = this.maxStamina;
        this.maxMana = data.maxMana ?? 80;
        this.mana = data.mana ?? this.maxMana;
        this.armorId = data.armorId || 'armor_cloth';
        this.skinId = data.skinId || 'guerreiro';
        this.defense = data.defense ?? 0;
        this.baseDamage = data.baseDamage ?? 22;
        this.weaponId = data.weaponId || 'sword_iron';
        this.attackRange = data.attackRange ?? 3.6;
        this.attackDuration = data.attackDuration ?? 0.38;
        this.skillPoints = data.skillPoints ?? 0;
        this.unlockedSkills = data.unlockedSkills || {};
        this.critChance = data.critChance ?? 0.05;
        this.magicPower = data.magicPower ?? 0;
        // Reaplica visual da armadura se a função existir
        if (typeof applyArmorToPlayer === 'function' && this.armorId) {
            applyArmorToPlayer(this, this.armorId);
        }
        // Reaplica skin (cores + acessórios)
        if (typeof applySkinToPlayer === 'function') {
            applySkinToPlayer(this, this.skinId);
        }
        // Reaplica arma equipada
        if (typeof applyWeaponToPlayer === 'function' && this.weaponId) {
            applyWeaponToPlayer(this, this.weaponId);
        }
    }

    respawn(x = 0, z = 8) {
        this.hp = this.maxHp;
        this.stamina = this.maxStamina;
        this.mana = this.maxMana;
        this.velocity.set(0, 0, 0);
        this.position.set(x, 2, z);
        this.invuln = 1.0;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.shieldTimer = 0;
        this.shieldReduction = 0;
    }

    /** Reinicia stats para uma nova jornada (nível 1, inventário base fica a cargo do Game) */
    resetNewGame(spawnX = 0, spawnZ = 8) {
        this.level = 1;
        this.xp = 0;
        this.xpNext = (typeof xpForLevel === 'function') ? xpForLevel(1) : 100;
        this.totalXp = 0;
        this.gold = 30;
        this.maxHp = 100;
        this.hp = 100;
        this.maxStamina = 100;
        this.stamina = 100;
        this.maxMana = 80;
        this.mana = 80;
        this.manaRegen = 6;
        this.skillPoints = 0;
        this.unlockedSkills = {};
        this.critChance = 0.05;
        this.magicPower = 0;
        this.defense = 0;
        this.baseDamage = 22;
        this.armorId = 'armor_cloth';
        this.weaponId = 'sword_iron';
        this.spellCds = {};
        this.shieldTimer = 0;
        this.shieldReduction = 0;
        this.moveSpeed = 9.5;
        this.sprintMult = 1.55;
        this.jumpForce = 11.5;
        this.attackRange = 3.6;
        this.velocity.set(0, 0, 0);
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.invuln = 0;
        this.rotationY = 0;
        // Spawn na vila
        const y = (this.world && typeof this.world.getTerrainHeight === 'function')
            ? this.world.getTerrainHeight(spawnX, spawnZ) + 0.1
            : 2;
        this.position.set(spawnX, y, spawnZ);
        if (this.group) this.group.position.copy(this.position);
        // Arma / armadura padrão
        if (typeof applyWeaponToPlayer === 'function') {
            applyWeaponToPlayer(this, 'sword_iron');
        }
        if (typeof applyArmorToPlayer === 'function') {
            applyArmorToPlayer(this, 'armor_cloth');
        }
    }

    dispose() {
        if (this.group && this.scene) {
            this.scene.remove(this.group);
        }
    }
}

if (typeof window !== 'undefined') {
    window.Player = Player;
}
