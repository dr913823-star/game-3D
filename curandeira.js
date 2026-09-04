/**
 * curandeira.js — Elara, a Curandeira
 * Vestes roxas, capuz aberto, frasco de poção, cabelo longo prateado, rosto visível
 */
(function (global) {
    'use strict';

    global.NPC_MESH_CREATORS = global.NPC_MESH_CREATORS || {};

    global.NPC_MESH_CREATORS['healer'] = function createCurandeira(def) {
        const s = def.scale || 0.95;
        const group = new THREE.Group();
        group.name = def.id;

        const skin = 0xf0d0b0;
        const skinDark = 0xd4a574;
        const robe = 0x5b21b6;
        const accent = 0x4c1d95;
        const hairC = 0xe7e5e4;
        const hairDark = 0xd4d4d8;

        const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
        const matSkinDark = new THREE.MeshStandardMaterial({ color: skinDark, roughness: 0.75 });
        const matRobe = new THREE.MeshStandardMaterial({ color: robe, roughness: 0.8 });
        const matAccent = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 });
        const matHair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.85 });
        const matHairDark = new THREE.MeshStandardMaterial({ color: hairDark, roughness: 0.9 });
        const matMouth = new THREE.MeshStandardMaterial({ color: 0xc08498, roughness: 0.65 });

        // ===== TORSO =====
        const torso = new THREE.Group();
        torso.position.y = 1.2 * s;

        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 12, 10), matRobe);
        chest.scale.set(1.15, 1.2, 0.85);
        chest.castShadow = true;
        torso.add(chest);

        const skirt = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45 * s, 0.55 * s, 0.7 * s, 10),
            matRobe
        );
        skirt.position.y = -0.55 * s;
        skirt.castShadow = true;
        torso.add(skirt);

        const shGeo = new THREE.SphereGeometry(0.13 * s, 10, 8);
        const lSh = new THREE.Mesh(shGeo, matAccent);
        lSh.position.set(-0.50 * s, 0.2 * s, 0);
        lSh.castShadow = true;
        torso.add(lSh);
        const rSh = new THREE.Mesh(shGeo, matAccent);
        rSh.position.set(0.50 * s, 0.2 * s, 0);
        rSh.castShadow = true;
        torso.add(rSh);

        const waist = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28 * s, 0.34 * s, 0.22 * s, 10),
            matRobe
        );
        waist.position.y = -0.32 * s;
        waist.castShadow = true;
        torso.add(waist);

        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(0.32 * s, 0.04 * s, 6, 14),
            matAccent
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.28 * s;
        torso.add(belt);

        group.add(torso);

        // ===== CABEÇA =====
        const headY = 1.98 * s;
        const headR = 0.3 * s;
        const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 14, 12), matSkin);
        head.position.y = headY;
        head.castShadow = true;
        group.add(head);

        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 0.3 * s, 8),
            matSkin
        );
        neck.position.y = headY - 0.26 * s;
        neck.castShadow = true;
        group.add(neck);

        const collar = new THREE.Mesh(
            new THREE.SphereGeometry(0.16 * s, 10, 8),
            matRobe
        );
        collar.position.y = headY - 0.4 * s;
        collar.scale.set(1.35, 0.55, 1.15);
        collar.castShadow = true;
        group.add(collar);

        // ===== CABELO (só topo + laterais + costas — rosto livre) =====
        // Topo: hemisfério curto (não desce até os olhos)
        const hairTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.32 * s, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
            matHair
        );
        hairTop.position.y = headY + 0.08 * s;
        hairTop.castShadow = true;
        group.add(hairTop);

        // Mechas laterais (atrás da linha dos olhos)
        for (const side of [-1, 1]) {
            const sideLock = new THREE.Mesh(
                new THREE.SphereGeometry(0.11 * s, 8, 6),
                matHair
            );
            sideLock.scale.set(0.65, 1.7, 0.7);
            sideLock.position.set(side * 0.3 * s, headY - 0.1 * s, -0.02 * s);
            sideLock.castShadow = true;
            group.add(sideLock);

            const longLock = new THREE.Mesh(
                new THREE.CylinderGeometry(0.065 * s, 0.045 * s, 0.55 * s, 6),
                matHairDark
            );
            longLock.position.set(side * 0.32 * s, headY - 0.4 * s, -0.08 * s);
            longLock.rotation.z = side * 0.1;
            longLock.castShadow = true;
            group.add(longLock);
        }

        // Cabelo nas costas
        const hairBack = new THREE.Mesh(
            new THREE.SphereGeometry(0.2 * s, 10, 8),
            matHair
        );
        hairBack.scale.set(1.25, 1.85, 0.65);
        hairBack.position.set(0, headY - 0.22 * s, -0.24 * s);
        hairBack.castShadow = true;
        group.add(hairBack);

        // Franja bem alta (acima da testa)
        const fringe = new THREE.Mesh(
            new THREE.SphereGeometry(0.14 * s, 8, 6),
            matHair
        );
        fringe.scale.set(1.4, 0.4, 0.5);
        fringe.position.set(0, headY + 0.16 * s, 0.18 * s);
        group.add(fringe);

        // Capuz: só o topo da cabeça (phi bem curto) — rosto totalmente aberto
        const hood = new THREE.Mesh(
            new THREE.SphereGeometry(0.36 * s, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.38),
            matAccent
        );
        hood.position.y = headY + 0.14 * s;
        group.add(hood);

        // Laterais do capuz (atrás)
        for (const side of [-1, 1]) {
            const hoodSide = new THREE.Mesh(
                new THREE.SphereGeometry(0.12 * s, 8, 6),
                matAccent
            );
            hoodSide.scale.set(0.55, 1.0, 0.85);
            hoodSide.position.set(side * 0.3 * s, headY + 0.02 * s, -0.12 * s);
            group.add(hoodSide);
        }

        // ===== ROSTO (na frente de tudo) =====
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const eyeIris = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.35 });
        const eyePupil = new THREE.MeshStandardMaterial({ color: 0x1e1b4b });

        // Olhos bem na superfície frontal da cabeça
        for (const sx of [-0.1, 0.1]) {
            const eyeG = new THREE.Group();

            const w = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 8, 6), eyeWhite);
            w.scale.set(1.05, 1.0, 0.65);
            eyeG.add(w);

            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.032 * s, 8, 6), eyeIris);
            iris.position.z = 0.03 * s;
            eyeG.add(iris);

            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 6, 5), eyePupil);
            pupil.position.z = 0.045 * s;
            eyeG.add(pupil);

            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.009 * s, 5, 4),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            shine.position.set(0.012 * s, 0.012 * s, 0.055 * s);
            eyeG.add(shine);

            // z um pouco além da superfície da cabeça (0.3) para garantir visibilidade
            eyeG.position.set(sx * s, headY + 0.02 * s, 0.28 * s);
            group.add(eyeG);
        }

        // Sobrancelhas
        for (const sx of [-0.1, 0.1]) {
            const brow = new THREE.Mesh(
                new THREE.SphereGeometry(0.048 * s, 6, 4),
                matHairDark
            );
            brow.scale.set(1.35, 0.32, 0.4);
            brow.position.set(sx * s, headY + 0.11 * s, 0.28 * s);
            brow.rotation.z = sx > 0 ? -0.12 : 0.12;
            group.add(brow);
        }

        // Nariz
        const nose = new THREE.Mesh(
            new THREE.SphereGeometry(0.042 * s, 8, 6),
            matSkinDark
        );
        nose.scale.set(0.65, 0.85, 0.95);
        nose.position.set(0, headY - 0.02 * s, 0.3 * s);
        group.add(nose);

        // Boca
        const mouth = new THREE.Mesh(
            new THREE.SphereGeometry(0.055 * s, 8, 6),
            matMouth
        );
        mouth.scale.set(1.15, 0.32, 0.4);
        mouth.position.set(0, headY - 0.13 * s, 0.28 * s);
        group.add(mouth);

        // Orelhas
        for (const sx of [-1, 1]) {
            const ear = new THREE.Mesh(
                new THREE.SphereGeometry(0.07 * s, 8, 6),
                matSkin
            );
            ear.scale.set(0.5, 0.95, 0.65);
            ear.position.set(sx * 0.3 * s, headY, 0.0);
            group.add(ear);
        }

        // ===== BRAÇOS =====
        // Pivot real no ombro: braço e mão acompanham juntos durante a animação.
        const armLen = 0.68 * s;
        const armY = 1.10 * s;

        function makeNPCArm(side) {
            const arm = new THREE.Group();
            // O ponto de origem do grupo fica exatamente no centro do ombro.
            arm.position.set(side * 0.50 * s, armY + armLen * 0.5, 0.02 * s);

            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08 * s, 0.07 * s, armLen, 8),
                matRobe
            );
            upper.position.y = -armLen * 0.5;
            upper.castShadow = true;
            arm.add(upper);

            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(0.075 * s, 8, 6),
                matSkin
            );
            hand.position.y = -armLen;
            hand.castShadow = true;
            arm.add(hand);

            arm.rotation.z = side < 0 ? 0.06 : -0.06;
            return arm;
        }

        const leftArm = makeNPCArm(-1);
        const rightArm = makeNPCArm(1);
        group.add(leftArm, rightArm);

        // ===== PERNAS =====
        // Pivot no quadril: a perna gira a partir do topo, nunca pelo centro.
        const legLen = 0.7 * s;
        function makeNPCLeg(side) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.14 * s, legLen, 0);

            const shin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1 * s, 0.09 * s, legLen, 8),
                matAccent
            );
            shin.position.y = -legLen * 0.5;
            shin.castShadow = true;
            leg.add(shin);

            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(0.15 * s, 0.12 * s, 0.26 * s),
                new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 })
            );
            foot.position.set(0, -legLen, 0.04 * s);
            leg.add(foot);
            return leg;
        }

        const leftLeg = makeNPCLeg(-1);
        const rightLeg = makeNPCLeg(1);
        group.add(leftLeg, rightLeg);

        const nameLabel = global.createNPCNameSprite
            ? global.createNPCNameSprite(def.name, def.title)
            : null;
        if (nameLabel) {
            nameLabel.position.y = 2.72 * s;
            group.add(nameLabel);
        }

        return {
            group,
            torso: torso,
            head,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            nameLabel,
            scale: s,
            headBaseY: headY,
            torsoBaseY: 1.2 * s
        };
    };
})(typeof window !== 'undefined' ? window : globalThis);
