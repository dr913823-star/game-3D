/**
 * inimigos.js — Sistema de inimigos profissional
 * Mesh com cabeça, braços e pernas + animações de caminhada e ataque
 *
 * Depende de: THREE (global)
 * API pública:
 *   const enemies = new EnemyManager(scene, world, player, options);
 *   await enemies.spawn(onProgress);
 *   enemies.update(dt);
 *   enemies.checkPlayerAttack(playerPos, playerRot, range);
 *   enemies.dispose();
 */

(function (global) {
    'use strict';

    // -------------------------------------------------------------------------
    // DEFINIÇÕES DE TIPOS DE INIMIGO
    // -------------------------------------------------------------------------
    const ENEMY_TYPES = {
        goblin: {
            label: 'Goblin',
            hp: 45,
            speed: 4.2,
            damage: 10,
            color: 0x2e7d32,
            accent: 0x14532d,
            skin: 0x4ade80,
            scale: 1.0,
            xp: 25,
            goldMin: 8,
            goldMax: 18,
            aggroRange: 16,
            attackRange: 2.4,
            attackCooldown: 1.15,
            eyeColor: 0xfbbf24
        },
        skeleton: {
            label: 'Esqueleto',
            hp: 75,
            speed: 5.2,
            damage: 16,
            color: 0xe5e7eb,
            accent: 0x9ca3af,
            skin: 0xf3f4f6,
            scale: 1.05,
            xp: 35,
            goldMin: 12,
            goldMax: 22,
            aggroRange: 18,
            attackRange: 2.5,
            attackCooldown: 1.1,
            eyeColor: 0x22d3ee
        },
        shadow: {
            label: 'Besta das Sombras',
            hp: 130,
            speed: 6.0,
            damage: 22,
            color: 0x7f1d1d,
            accent: 0x450a0a,
            skin: 0x991b1b,
            scale: 1.25,
            xp: 60,
            goldMin: 20,
            goldMax: 40,
            aggroRange: 20,
            attackRange: 2.6,
            attackCooldown: 1.0,
            eyeColor: 0xf87171
        },
        orc: {
            label: 'Orc',
            hp: 160,
            speed: 3.8,
            damage: 28,
            color: 0x3f6212,
            accent: 0x1a2e05,
            skin: 0x65a30d,
            scale: 1.35,
            xp: 90,
            goldMin: 25,
            goldMax: 50,
            aggroRange: 18,
            attackRange: 2.8,
            attackCooldown: 1.35,
            eyeColor: 0xfbbf24
        },
        wolf: {
            label: 'Lobo',
            hp: 55,
            speed: 7.5,
            damage: 14,
            color: 0x57534e,
            accent: 0x292524,
            skin: 0x78716c,
            scale: 0.95,
            xp: 30,
            goldMin: 5,
            goldMax: 14,
            aggroRange: 22,
            attackRange: 2.2,
            attackCooldown: 0.9,
            eyeColor: 0xfbbf24
        },
        spider: {
            label: 'Aranha Gigante',
            hp: 70,
            speed: 5.8,
            damage: 18,
            color: 0x1e1b4b,
            accent: 0x0f172a,
            skin: 0x312e81,
            scale: 0.9,
            xp: 45,
            goldMin: 10,
            goldMax: 22,
            aggroRange: 15,
            attackRange: 2.3,
            attackCooldown: 1.05,
            eyeColor: 0xef4444
        },
        dark_mage: {
            label: 'Mago Sombrio',
            hp: 95,
            speed: 4.0,
            damage: 30,
            color: 0x4c1d95,
            accent: 0x2e1065,
            skin: 0x7c3aed,
            scale: 1.1,
            xp: 120,
            goldMin: 30,
            goldMax: 55,
            aggroRange: 24,
            attackRange: 3.2,
            attackCooldown: 1.6,
            eyeColor: 0xa78bfa
        },
        troll: {
            label: 'Troll',
            hp: 280,
            speed: 3.2,
            damage: 38,
            color: 0x365314,
            accent: 0x1a2e05,
            skin: 0x84cc16,
            scale: 1.6,
            xp: 200,
            goldMin: 40,
            goldMax: 80,
            aggroRange: 16,
            attackRange: 3.0,
            attackCooldown: 1.8,
            eyeColor: 0xfbbf24
        }
    };

    // Override XP from central PROGRESSION if available
    if (typeof PROGRESSION !== 'undefined' && PROGRESSION.enemyXp) {
        for (const [k, v] of Object.entries(PROGRESSION.enemyXp)) {
            if (ENEMY_TYPES[k]) ENEMY_TYPES[k].xp = v;
        }
    }

    // Spawns em terra firme (longe do riacho diagonal do mapa2)
    const DEFAULT_SPAWNS = [
        { x: 35, z: -45, type: 'goblin' },
        { x: 55, z: -30, type: 'goblin' },
        { x: 25, z: -60, type: 'goblin' },
        { x: -75, z: -25, type: 'skeleton' },
        { x: -90, z: -40, type: 'skeleton' },
        { x: 20, z: 55, type: 'shadow' },
        { x: -35, z: 50, type: 'goblin' },
        { x: 80, z: -15, type: 'skeleton' },
        { x: -50, z: 45, type: 'goblin' },
        { x: 65, z: 35, type: 'wolf' },
        { x: 85, z: 25, type: 'wolf' },
        { x: -70, z: 20, type: 'spider' },
        { x: 95, z: -35, type: 'orc' },
        { x: -95, z: 55, type: 'dark_mage' },
        { x: 40, z: 75, type: 'troll' }
    ];

    const _tmpV = new THREE.Vector3();
    const _tmpFwd = new THREE.Vector3();

    // -------------------------------------------------------------------------
    // MATERIALS TEXTURIZADOS (com fallback para cor sólida)
    // -------------------------------------------------------------------------
    function texMat(kind, baseHex, extra) {
        extra = extra || {};
        if (typeof EnemyTex !== 'undefined' && EnemyTex.material) {
            return EnemyTex.material(kind, baseHex, Object.assign({
                roughness: 0.82,
                metalness: 0.05,
                bump: 0.35,
                repeatX: 2,
                repeatY: 2
            }, extra));
        }
        return new THREE.MeshStandardMaterial({
            color: baseHex,
            roughness: extra.roughness != null ? extra.roughness : 0.8,
            metalness: extra.metalness != null ? extra.metalness : 0.05
        });
    }

    const ENEMY_TEX = {
        goblin: { body: 'scales', skin: 'scales', accent: 'leather' },
        skeleton: { body: 'bones', skin: 'bones', accent: 'bones' },
        shadow: { body: 'smoke', skin: 'smoke', accent: 'smoke' },
        orc: { body: 'hide', skin: 'scales', accent: 'leather' },
        wolf: { body: 'fur', skin: 'fur', accent: 'leather' },
        spider: { body: 'chitin', skin: 'chitin', accent: 'chitin' },
        dark_mage: { body: 'robe', skin: 'robe', accent: 'robe' },
        troll: { body: 'moss', skin: 'scales', accent: 'stone' }
    };

    // -------------------------------------------------------------------------
    // FACTORY DE MESH (corpo articulado)
    // -------------------------------------------------------------------------
    function createEnemyMesh(def, typeKey) {
        const s = def.scale;
        const group = new THREE.Group();
        const isGoblin = typeKey === 'goblin';
        const isSkel = typeKey === 'skeleton';
        const isShadow = typeKey === 'shadow';
        const isWolf = typeKey === 'wolf';
        const isSpider = typeKey === 'spider';
        const isMage = typeKey === 'dark_mage';

        const texSel = ENEMY_TEX[typeKey] || ENEMY_TEX.goblin;
        const matBody = texMat(texSel.body, def.color, { roughness: 0.78, metalness: 0.06 });
        const matAccent = texMat(texSel.accent, def.accent, { roughness: 0.85, metalness: 0.04 });
        const matSkin = texMat(texSel.skin, def.skin, { roughness: 0.8, metalness: 0.04 });
        const matEye = new THREE.MeshStandardMaterial({
            color: def.eyeColor, emissive: def.eyeColor, emissiveIntensity: 0.7, roughness: 0.25
        });
        const matClaw = new THREE.MeshStandardMaterial({
            color: isSkel ? 0xf8fafc : 0x1c1917, roughness: 0.4, metalness: 0.35
        });
        const matGlow = new THREE.MeshStandardMaterial({
            color: def.eyeColor, emissive: def.eyeColor, emissiveIntensity: 0.55, roughness: 0.3
        });

        // Corcunda / tronco monstruoso (mais largo, baixo)
        const torsoH = isShadow ? 1.0 : 0.75;
        const torso = new THREE.Mesh(
            new THREE.SphereGeometry((isShadow ? 0.55 : 0.42) * s, 10, 8),
            matBody
        );
        torso.position.y = (isShadow ? 1.05 : 1.0) * s;
        torso.scale.set(1.15, isShadow ? 1.1 : 0.95, 0.9);
        torso.castShadow = true;
        group.add(torso);

        // Barriga / volume extra
        const belly = new THREE.Mesh(
            new THREE.SphereGeometry(0.32 * s, 8, 6),
            matAccent
        );
        belly.position.set(0, 0.75 * s, 0.12 * s);
        belly.scale.set(1.1, 0.85, 0.95);
        group.add(belly);

        // Espinhos nas costas
        const spikeCount = isShadow ? 5 : 3;
        for (let i = 0; i < spikeCount; i++) {
            const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.08 * s, (0.35 + i * 0.08) * s, 5),
                matAccent
            );
            spike.position.set(
                (i - (spikeCount - 1) / 2) * 0.12 * s,
                (1.15 + i * 0.08) * s,
                -0.35 * s
            );
            spike.rotation.x = -0.7;
            spike.castShadow = true;
            group.add(spike);
        }

        // --- Cabeça monstruosa (grande, alongada) ---
        const head = new THREE.Group();
        head.position.y = (isShadow ? 1.75 : 1.65) * s;

        const skull = new THREE.Mesh(
            new THREE.SphereGeometry((isGoblin ? 0.38 : 0.32) * s, 10, 8),
            matSkin
        );
        skull.scale.set(1.05, isGoblin ? 1.15 : 1.0, 1.15);
        skull.castShadow = true;
        head.add(skull);

        // Focinho / mandíbula
        const snout = new THREE.Mesh(
            new THREE.SphereGeometry(0.18 * s, 8, 6),
            matAccent
        );
        snout.position.set(0, -0.08 * s, 0.28 * s);
        snout.scale.set(0.9, 0.7, 1.1);
        head.add(snout);

        // Presas
        for (const sx of [-0.08, 0.08]) {
            const fang = new THREE.Mesh(
                new THREE.ConeGeometry(0.035 * s, 0.16 * s, 5),
                matClaw
            );
            fang.position.set(sx * s, -0.18 * s, 0.35 * s);
            fang.rotation.x = Math.PI;
            head.add(fang);
        }

        // Olhos grandes/ brilhantes
        for (const sx of [-0.12, 0.12]) {
            const eyeWhite = new THREE.Mesh(
                new THREE.SphereGeometry(0.09 * s, 6, 5),
                new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })
            );
            eyeWhite.position.set(sx * s, 0.06 * s, 0.28 * s);
            head.add(eyeWhite);

            const iris = new THREE.Mesh(
                new THREE.SphereGeometry(0.05 * s, 6, 5),
                matEye
            );
            iris.position.set(sx * s, 0.06 * s, 0.34 * s);
            head.add(iris);
        }

        // Chifres
        const hornGeo = new THREE.ConeGeometry(0.07 * s, (isShadow ? 0.55 : 0.35) * s, 6);
        for (const sx of [-1, 1]) {
            const horn = new THREE.Mesh(hornGeo, matClaw);
            horn.position.set(sx * 0.2 * s, 0.28 * s, -0.05 * s);
            horn.rotation.z = sx * (isShadow ? 0.55 : 0.35);
            horn.rotation.x = -0.25;
            horn.castShadow = true;
            head.add(horn);
        }

        // Orelhas pontudas (goblin)
        if (isGoblin) {
            for (const sx of [-1, 1]) {
                const ear = new THREE.Mesh(
                    new THREE.ConeGeometry(0.1 * s, 0.32 * s, 5),
                    matSkin
                );
                ear.position.set(sx * 0.32 * s, 0.1 * s, 0);
                ear.rotation.z = sx * 0.9;
                head.add(ear);
            }
        }

        // Lobo: orelhas eretas + focinho alongado + nariz escuro
        if (isWolf) {
            snout.position.set(0, -0.12 * s, 0.34 * s);
            snout.scale.set(0.85, 0.55, 1.5);
            for (const sx of [-1, 1]) {
                const ear = new THREE.Mesh(
                    new THREE.ConeGeometry(0.09 * s, 0.3 * s, 5),
                    matSkin
                );
                ear.position.set(sx * 0.2 * s, 0.3 * s, 0);
                ear.rotation.z = sx * 0.28;
                ear.castShadow = true;
                head.add(ear);

                const inner = new THREE.Mesh(
                    new THREE.ConeGeometry(0.05 * s, 0.15 * s, 5),
                    matAccent
                );
                inner.position.set(sx * 0.2 * s, 0.35 * s, -0.02 * s);
                inner.rotation.z = sx * 0.28;
                head.add(inner);
            }
            const nose = new THREE.Mesh(
                new THREE.SphereGeometry(0.07 * s, 6, 5),
                matClaw
            );
            nose.position.set(0, -0.06 * s, 0.46 * s);
            nose.scale.set(1.2, 0.9, 1.1);
            head.add(nose);
        }

        group.add(head);

        // --- Braços longos de monstro ---
        function makeArm(side) {
            const arm = new THREE.Group();
            // Ombros mais baixos e abertos
            arm.position.set(side * 0.5 * s, 1.25 * s, 0);

            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.12 * s, 0.1 * s, 0.55 * s, 6),
                matBody
            );
            upper.position.y = -0.25 * s;
            upper.castShadow = true;
            arm.add(upper);

            // Nódulo no cotovelo
            const joint = new THREE.Mesh(
                new THREE.SphereGeometry(0.11 * s, 6, 5),
                matAccent
            );
            joint.position.y = -0.52 * s;
            arm.add(joint);

            const lower = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.5 * s, 6),
                matSkin
            );
            lower.position.y = -0.78 * s;
            lower.castShadow = true;
            arm.add(lower);

            // Mão com garras
            const hand = new THREE.Group();
            hand.position.y = -1.05 * s;
            const palm = new THREE.Mesh(
                new THREE.SphereGeometry(0.12 * s, 6, 5),
                matSkin
            );
            palm.scale.set(1.1, 0.8, 0.9);
            hand.add(palm);

            for (let c = 0; c < 3; c++) {
                const claw = new THREE.Mesh(
                    new THREE.ConeGeometry(0.03 * s, 0.22 * s, 4),
                    matClaw
                );
                claw.position.set((c - 1) * 0.07 * s, -0.18 * s, 0.08 * s);
                claw.rotation.x = Math.PI + 0.2;
                hand.add(claw);
            }
            arm.add(hand);

            // Cajado do Mago Sombrio (mão direita)
            if (isMage && side === 1) {
                const staff = new THREE.Group();
                staff.position.set(0.05 * s, -1.15 * s, 0.05 * s);
                staff.rotation.z = 0.12;

                const rod = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.03 * s, 0.045 * s, 0.95 * s, 6),
                    matClaw
                );
                rod.position.y = 0.3 * s;
                staff.add(rod);

                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(0.08 * s, 0.02 * s, 6, 12),
                    matEye
                );
                ring.position.y = 0.82 * s;
                ring.rotation.x = Math.PI / 2;
                staff.add(ring);

                const orb = new THREE.Mesh(
                    new THREE.SphereGeometry(0.09 * s, 8, 6),
                    matEye
                );
                orb.position.y = 0.86 * s;
                staff.add(orb);

                const glow = new THREE.Mesh(
                    new THREE.SphereGeometry(0.16 * s, 6, 5),
                    new THREE.MeshStandardMaterial({
                        color: def.eyeColor,
                        emissive: def.eyeColor,
                        emissiveIntensity: 0.3,
                        transparent: true,
                        opacity: 0.22
                    })
                );
                glow.position.y = 0.86 * s;
                staff.add(glow);

                arm.add(staff);
            }

            // Braços mais longos: rotação inicial aberta
            arm.rotation.z = side * 0.25;
            return { arm, hand };
        }

        const left = makeArm(-1);
        const right = makeArm(1);
        group.add(left.arm, right.arm);

        // --- Pernas curtas / patas ---
        function makeLeg(side) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.22 * s, 0.55 * s, 0);

            const thigh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.14 * s, 0.12 * s, 0.35 * s, 6),
                matAccent
            );
            thigh.position.y = -0.12 * s;
            thigh.castShadow = true;
            leg.add(thigh);

            const shin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1 * s, 0.12 * s, 0.32 * s, 6),
                matBody
            );
            shin.position.y = -0.42 * s;
            shin.castShadow = true;
            leg.add(shin);

            // Pata larga com garras
            const foot = new THREE.Mesh(
                new THREE.SphereGeometry(0.14 * s, 6, 5),
                matAccent
            );
            foot.position.set(0, -0.6 * s, 0.08 * s);
            foot.scale.set(1.2, 0.55, 1.5);
            foot.castShadow = true;
            leg.add(foot);

            for (const fx of [-0.08, 0, 0.08]) {
                const toe = new THREE.Mesh(
                    new THREE.ConeGeometry(0.025 * s, 0.14 * s, 4),
                    matClaw
                );
                toe.position.set(fx * s, -0.62 * s, 0.22 * s);
                toe.rotation.x = Math.PI / 2;
                leg.add(toe);
            }

            return leg;
        }

        const leftLeg = makeLeg(-1);
        const rightLeg = makeLeg(1);
        group.add(leftLeg, rightLeg);

        // Aranha Gigante: abdômen + par extra de pernas traseiras
        if (isSpider) {
            const abdomen = new THREE.Mesh(
                new THREE.SphereGeometry(0.4 * s, 10, 8),
                matAccent
            );
            abdomen.scale.set(1.15, 0.9, 1.25);
            abdomen.position.set(0, 0.95 * s, -0.45 * s);
            abdomen.castShadow = true;
            group.add(abdomen);

            const spinneret = new THREE.Mesh(
                new THREE.ConeGeometry(0.06 * s, 0.2 * s, 5),
                matClaw
            );
            spinneret.position.set(0, 0.82 * s, -0.8 * s);
            spinneret.rotation.x = Math.PI / 2;
            group.add(spinneret);

            for (const sx of [-1, 1]) {
                const rLeg = new THREE.Group();
                rLeg.position.set(sx * 0.3 * s, 0.8 * s, -0.35 * s);
                const seg1 = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.055 * s, 0.045 * s, 0.5 * s, 5),
                    matBody
                );
                seg1.position.set(sx * 0.2 * s, -0.2 * s, 0);
                seg1.rotation.z = -sx * 0.7;
                rLeg.add(seg1);
                const seg2 = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.045 * s, 0.035 * s, 0.5 * s, 5),
                    matAccent
                );
                seg2.position.set(sx * 0.42 * s, -0.45 * s, 0);
                seg2.rotation.z = -sx * 1.0;
                rLeg.add(seg2);
                const tip = new THREE.Mesh(
                    new THREE.ConeGeometry(0.025 * s, 0.16 * s, 4),
                    matClaw
                );
                tip.position.set(sx * 0.68 * s, -0.6 * s, 0);
                tip.rotation.z = -sx * 0.6;
                rLeg.add(tip);
                group.add(rLeg);
            }
        }

        // Cauda (sombra / goblin)
        let tail = null;
        if (!isSkel) {
            tail = new THREE.Group();
            tail.position.set(0, 0.7 * s, -0.35 * s);
            const tailSeg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08 * s, 0.04 * s, 0.7 * s, 5),
                matAccent
            );
            tailSeg.rotation.x = Math.PI / 2.5;
            tailSeg.position.z = -0.25 * s;
            tailSeg.castShadow = true;
            tail.add(tailSeg);
            const tailTip = new THREE.Mesh(
                new THREE.ConeGeometry(0.06 * s, 0.25 * s, 5),
                matClaw
            );
            tailTip.position.set(0, -0.05 * s, -0.6 * s);
            tailTip.rotation.x = Math.PI / 2;
            tail.add(tailTip);
            group.add(tail);
        }

        // Aura / runas na besta das sombras
        if (isShadow) {
            const aura = new THREE.Mesh(
                new THREE.SphereGeometry(0.7 * s, 8, 6),
                new THREE.MeshStandardMaterial({
                    color: 0x450a0a,
                    emissive: 0x7f1d1d,
                    emissiveIntensity: 0.25,
                    transparent: true,
                    opacity: 0.25,
                    roughness: 1
                })
            );
            aura.position.y = 1.1 * s;
            group.add(aura);
        }

        // Sombra falsa no chão (grounding visual)
        if (typeof EnemyTex !== 'undefined' && EnemyTex.groundShadow) {
            const blob = EnemyTex.groundShadow((isShadow ? 1.1 : isSpider ? 0.95 : 0.8) * s);
            blob.position.y = 0.04;
            group.add(blob);
        }

        // Barra de vida
        const barY = (isShadow ? 2.55 : 2.4) * s;
        const barBg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 0.12),
            new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide })
        );
        barBg.position.y = barY;
        group.add(barBg);

        const barFg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.15, 0.08),
            new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
        );
        barFg.position.y = barY;
        barFg.position.z = 0.02;
        group.add(barFg);

        // Nome do monstro (label billboard)
        const nameLabel = createNameLabel(def.label || typeKey);
        nameLabel.position.y = barY + 0.18 * s;
        group.add(nameLabel);

        return {
            group,
            torso,
            head,
            leftArm: left.arm,
            rightArm: right.arm,
            leftLeg,
            rightLeg,
            tail,
            barBg,
            barFg,
            nameLabel,
            scale: s
        };
    }

    /** Cria um plane com o nome do monstro via canvas texture */
    function createNameLabel(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fundo semi-transparente arredondado
        const padX = 12;
        const padY = 8;
        ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
        const metrics = ctx.measureText(text);
        const tw = Math.min(metrics.width + padX * 2, canvas.width - 8);
        const th = 36;
        const x = (canvas.width - tw) / 2;
        const y = (canvas.height - th) / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        roundRect(ctx, x, y, tw, th, 8);
        ctx.fill();

        // Texto com sombra
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;

        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), mat);
        mesh.renderOrder = 10;
        return mesh;
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

    // -------------------------------------------------------------------------
    // ANIMAÇÕES
    // -------------------------------------------------------------------------
    function animateEnemy(e, dt) {
        if (!e.parts) return;
        const p = e.parts;
        e.animTime = (e.animTime || 0) + dt;

        if (e.state === 'ATTACK' || e.attackAnim > 0) {
            // Animação de ataque (braço direito)
            if (e.attackAnim == null) e.attackAnim = 0;
            e.attackAnim = Math.max(0, e.attackAnim - dt);
            const t = 1 - (e.attackAnim / 0.35);
            const swing = Math.sin(Math.min(1, t) * Math.PI);

            p.rightArm.rotation.x = -0.3 - swing * 1.6;
            p.rightArm.rotation.z = swing * 0.4;
            p.leftArm.rotation.x = -0.4;
            p.torso.rotation.y = swing * 0.25;
            p.leftLeg.rotation.x = 0.15;
            p.rightLeg.rotation.x = -0.1;
            return;
        }

        // Reset torso yaw
        p.torso.rotation.y = 0;
        p.rightArm.rotation.z = 0;

        if (e.state === 'CHASE' || e.state === 'PATROL') {
            const speed = e.state === 'CHASE' ? 10 : 7;
            e.animTime += dt * (speed - 1);
            const s = Math.sin(e.animTime);

            p.leftLeg.rotation.x = s * 0.7;
            p.rightLeg.rotation.x = -s * 0.7;
            p.leftArm.rotation.x = -s * 0.55;
            p.rightArm.rotation.x = s * 0.55;

            // Bob vertical
            const bob = Math.abs(Math.sin(e.animTime * 2)) * 0.04 * p.scale;
            p.torso.position.y = 1.0 * p.scale + bob;
            p.head.position.y = 1.65 * p.scale + bob;
            if (p.tail) p.tail.rotation.y = s * 0.35;
        } else {
            // IDLE — respiração
            const breath = Math.sin(e.animTime * 2.2) * 0.03;
            p.leftLeg.rotation.x = 0;
            p.rightLeg.rotation.x = 0;
            p.leftArm.rotation.x = 0.25;
            p.rightArm.rotation.x = 0.25;
            p.leftArm.rotation.z = -0.2;
            p.rightArm.rotation.z = 0.2;
            p.torso.position.y = 1.0 * p.scale + breath;
            p.head.position.y = 1.65 * p.scale + breath * 0.6;
            if (p.tail) p.tail.rotation.y = Math.sin(e.animTime) * 0.15;
        }
    }

    // -------------------------------------------------------------------------
    // ENEMY MANAGER
    // -------------------------------------------------------------------------
    class EnemyManager {
        constructor(scene, world, player, options = {}) {
            if (!scene) throw new Error('[EnemyManager] scene é obrigatória');
            if (!world) throw new Error('[EnemyManager] world é obrigatório');
            if (!player) throw new Error('[EnemyManager] player é obrigatório');

            this.scene = scene;
            this.world = world;
            this.player = player;

            this.spawns = options.spawns || DEFAULT_SPAWNS.slice();
            this.cullDistance = options.cullDistance ?? 55;
            this.onEnemyDeath = options.onEnemyDeath || null;
            this.onPlayerHit = options.onPlayerHit || null;
            this.respawnTime = options.respawnTime ?? 25; // segundos para respawn

            this.enemies = [];
            this._idCounter = 0;
            this._pendingRespawns = []; // { x, z, type, timer }
        }

        async spawn(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(82, 'Inicializando inimigos articulados...');

            for (let i = 0; i < this.spawns.length; i++) {
                const sp = this.spawns[i];
                this._spawnOne(sp.x, sp.z, sp.type || 'goblin');
            }

            await progress(88, `${this.enemies.length} inimigos prontos`);
        }

        spawnAt(x, z, typeKey = 'goblin') {
            return this._spawnOne(x, z, typeKey);
        }

        /**
         * Ajusta (x,z) para terreno seco acima da água.
         */
        _findDryLand(x, z) {
            const wl = (this.world.cfg && this.world.cfg.waterLevel != null)
                ? this.world.cfg.waterLevel
                : 0.35;
            const minH = wl + 0.85;
            const h0 = this.world.getTerrainHeight ? this.world.getTerrainHeight(x, z) : 99;
            if (h0 >= minH) return { x, z };

            for (let r = 4; r <= 48; r += 4) {
                for (let a = 0; a < 16; a++) {
                    const ang = (a / 16) * Math.PI * 2;
                    const nx = x + Math.cos(ang) * r;
                    const nz = z + Math.sin(ang) * r;
                    const h = this.world.getTerrainHeight(nx, nz);
                    if (h >= minH) return { x: nx, z: nz };
                }
            }
            return { x, z };
        }

        _spawnOne(x, z, typeKey) {
            const dry = this._findDryLand(x, z);
            x = dry.x; z = dry.z;
            const def = ENEMY_TYPES[typeKey] || ENEMY_TYPES.goblin;
            const y = this.world.getTerrainHeight(x, z);

            const parts = createEnemyMesh(def, typeKey);
            parts.group.position.set(x, y, z);
            parts.group.name = `enemy_${typeKey}_${this._idCounter}`;
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
            const camPos = (typeof Game !== 'undefined' && Game.camera)
                ? Game.camera.position
                : null;

            // Processa respawns pendentes
            for (let i = this._pendingRespawns.length - 1; i >= 0; i--) {
                const pr = this._pendingRespawns[i];
                pr.timer -= dt;
                if (pr.timer <= 0) {
                    this._spawnOne(pr.x, pr.z, pr.type);
                    this._pendingRespawns.splice(i, 1);
                }
            }

            for (let i = 0; i < this.enemies.length; i++) {
                const e = this.enemies[i];
                if (!e.alive) continue;

                const dist = e.pos.distanceTo(playerPos);

                if (dist > this.cullDistance) {
                    e.state = 'IDLE';
                    animateEnemy(e, dt);
                    continue;
                }

                if (e.atkCd > 0) e.atkCd -= dt;

                const def = e.def;
                if (dist < def.aggroRange) {
                    e.state = dist < def.attackRange ? 'ATTACK' : 'CHASE';
                } else if (dist > def.aggroRange + 10) {
                    e.state = 'PATROL';
                } else if (e.state === 'CHASE') {
                    e.state = 'IDLE';
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

                animateEnemy(e, dt);
                this._updateHealthBar(e, camPos);
            }
        }

        _doChase(e, playerPos, dt) {
            _tmpV.subVectors(playerPos, e.pos).normalize();
            e.pos.x += _tmpV.x * e.speed * dt;
            e.pos.z += _tmpV.z * e.speed * dt;
            if (this.world && typeof this.world.resolveRadius === 'function') {
                const r = this.world.resolveRadius(e.pos.x, e.pos.z, 0.7);
                e.pos.x = r.x;
                e.pos.z = r.z;
            }
            e.pos.y = this.world.getTerrainHeight(e.pos.x, e.pos.z);
            e.mesh.position.copy(e.pos);
            e.mesh.rotation.y = Math.atan2(_tmpV.x, _tmpV.z);
        }

        _doAttack(e, playerPos, dt) {
            // Olha para o jogador
            const dx = playerPos.x - e.pos.x;
            const dz = playerPos.z - e.pos.z;
            e.mesh.rotation.y = Math.atan2(dx, dz);

            if (e.atkCd <= 0) {
                e.attackAnim = 0.35;
                const applied = this.player.takeDamage(e.damage);
                if (applied && typeof this.onPlayerHit === 'function') {
                    this.onPlayerHit(e.damage);
                }
                e.atkCd = e.def.attackCooldown;
            }
        }

        _doPatrol(e, dt) {
            e.patrolT += dt;
            const angle = e.patrolT * 0.4;
            const px = e.home.x + Math.cos(angle) * 6;
            const pz = e.home.z + Math.sin(angle) * 6;

            _tmpV.set(px - e.pos.x, 0, pz - e.pos.z);
            if (_tmpV.lengthSq() > 0.1) {
                _tmpV.normalize();
                e.pos.x += _tmpV.x * e.speed * 0.4 * dt;
                e.pos.z += _tmpV.z * e.speed * 0.4 * dt;
                if (this.world && typeof this.world.resolveRadius === 'function') {
                    const r = this.world.resolveRadius(e.pos.x, e.pos.z, 0.7);
                    e.pos.x = r.x;
                    e.pos.z = r.z;
                }
                e.pos.y = this.world.getTerrainHeight(e.pos.x, e.pos.z);
                e.mesh.position.copy(e.pos);
                e.mesh.rotation.y = Math.atan2(_tmpV.x, _tmpV.z);
            }
        }

        _updateHealthBar(e, camPos) {
            const pct = Math.max(0, e.hp / e.maxHp);
            e.barFg.scale.x = pct;
            e.barFg.position.x = -0.55 * (1 - pct);

            if (camPos) {
                e.barFg.lookAt(camPos);
                e.barBg.lookAt(camPos);
                if (e.nameLabel) e.nameLabel.lookAt(camPos);
            }
        }

        checkPlayerAttack(playerPos, playerRot, range) {
            _tmpFwd.set(Math.sin(playerRot), 0, Math.cos(playerRot));
            let hit = false;
            const kills = [];

            for (let i = 0; i < this.enemies.length; i++) {
                const e = this.enemies[i];
                if (!e.alive) continue;

                _tmpV.subVectors(e.pos, playerPos);
                const dist = _tmpV.length();
                if (dist >= range) continue;

                _tmpV.normalize();
                if (_tmpFwd.dot(_tmpV) < 0.25) continue;

                const dmg = typeof this.player.getAttackDamage === 'function'
                    ? this.player.getAttackDamage()
                    : 25;

                e.hp -= dmg;
                hit = true;

                e.pos.x += _tmpV.x * 1.8;
                e.pos.z += _tmpV.z * 1.8;
                e.mesh.position.copy(e.pos);

                if (typeof Game !== 'undefined') {
                    Game.showPopDamage?.(e.pos, dmg);
                    Game.spawnParticles?.(e.pos, 0xef4444, 6);
                }
                if (typeof Sound !== 'undefined') Sound.playHit?.();

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

            // Agenda respawn no ponto de origem (home)
            if (this.respawnTime > 0 && e.home) {
                this._pendingRespawns.push({
                    x: e.home.x,
                    z: e.home.z,
                    type: e.type,
                    timer: this.respawnTime + Math.random() * 8
                });
            }

            const def = e.def;
            const xp = def.xp;
            let gold = def.goldMin + (Math.random() * (def.goldMax - def.goldMin + 1) | 0);
            if (this.player.goldBonusPct) gold = Math.round(gold * (1 + this.player.goldBonusPct));

            if (typeof this.player.gainXP === 'function') {
                this.player.gainXP(xp, (lvl) => {
                    if (typeof Game !== 'undefined') {
                        const sp = this.player.skillPoints || 0;
                        Game.showToast?.(`LEVEL UP! Nível ${lvl} · +1 Skill Point (${sp})`, 'amber');
                        Game.spawnParticles?.(this.player.position, 0xf59e0b, 18);
                        Game.syncHUD?.();
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

    EnemyManager.TYPES = ENEMY_TYPES;
    EnemyManager.DEFAULT_SPAWNS = DEFAULT_SPAWNS;

    global.EnemyManager = EnemyManager;

})(typeof window !== 'undefined' ? window : globalThis);
