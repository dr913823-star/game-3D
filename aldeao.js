/**
 * aldeao.js — Aldeões genéricos da vila (visual melhorado)
 * Roupas em camadas, cabelo, rosto completo, acessórios por variante
 *
 * Uso: profession: 'villager'
 * Opcional em def: clothColor, accentColor, hairColor, skinColor
 */
(function (global) {
    'use strict';

    global.NPC_MESH_CREATORS = global.NPC_MESH_CREATORS || {};

    global.NPC_MESH_CREATORS['villager'] = function createAldeao(def) {
        const s = def.scale || 1.0;
        const group = new THREE.Group();
        group.name = def.id || 'aldeao';

        const skin = def.skinColor != null ? def.skinColor : 0xe8c4a0;
        const cloth = def.clothColor != null ? def.clothColor : 0x78716c;
        const accent = def.accentColor != null ? def.accentColor : 0x57534e;
        const hairC = def.hairColor != null ? def.hairColor : 0x44403c;
        const skinDark = 0xc4a882;
        const leather = 0x78350f;
        const linen = 0xd6d3d1;

        const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
        const matSkinDark = new THREE.MeshStandardMaterial({ color: skinDark, roughness: 0.8 });
        const matCloth = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.85 });
        const matAccent = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.85 });
        const matHair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.9 });
        const matMouth = new THREE.MeshStandardMaterial({ color: 0xb07a6a, roughness: 0.7 });
        const matLeather = new THREE.MeshStandardMaterial({ color: leather, roughness: 0.9 });
        const matLinen = new THREE.MeshStandardMaterial({ color: linen, roughness: 0.88 });

        // Variante visual estável a partir do id
        let variant = 0;
        if (def.id) {
            for (let i = 0; i < def.id.length; i++) variant = (variant + def.id.charCodeAt(i) * (i + 1)) % 3;
        }

        // ===== TORSO =====
        const torso = new THREE.Group();
        torso.position.y = 1.22 * s;

        // Camisa / túnica
        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.38 * s, 12, 10), matCloth);
        chest.scale.set(1.15, 1.2, 0.9);
        chest.castShadow = true;
        torso.add(chest);

        // Ombros (menores e alinhados com o peito)
        const shGeo = new THREE.SphereGeometry(0.13 * s, 10, 8);
        const lSh = new THREE.Mesh(shGeo, matCloth);
        lSh.position.set(-0.50 * s, 0.2 * s, 0);
        lSh.castShadow = true;
        torso.add(lSh);
        const rSh = new THREE.Mesh(shGeo, matCloth);
        rSh.position.set(0.50 * s, 0.2 * s, 0);
        rSh.castShadow = true;
        torso.add(rSh);

        // Colete / avental (varia)
        if (variant === 0) {
            const vest = new THREE.Mesh(
                new THREE.BoxGeometry(0.52 * s, 0.55 * s, 0.12 * s),
                matAccent
            );
            vest.position.set(0, -0.02 * s, 0.32 * s);
            vest.castShadow = true;
            torso.add(vest);
        } else if (variant === 1) {
            const apron = new THREE.Mesh(
                new THREE.BoxGeometry(0.48 * s, 0.7 * s, 0.08 * s),
                matLinen
            );
            apron.position.set(0, -0.2 * s, 0.34 * s);
            apron.castShadow = true;
            torso.add(apron);
            const strapL = new THREE.Mesh(
                new THREE.BoxGeometry(0.06 * s, 0.45 * s, 0.04 * s),
                matLinen
            );
            strapL.position.set(-0.16 * s, 0.15 * s, 0.34 * s);
            torso.add(strapL);
            const strapR = strapL.clone();
            strapR.position.x = 0.16 * s;
            torso.add(strapR);
        } else {
            // Faixa diagonal
            const sash = new THREE.Mesh(
                new THREE.BoxGeometry(0.12 * s, 0.7 * s, 0.06 * s),
                matAccent
            );
            sash.position.set(0.05 * s, 0.0, 0.36 * s);
            sash.rotation.z = -0.55;
            torso.add(sash);
        }

        // Cinto de couro
        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(0.34 * s, 0.04 * s, 6, 14),
            matLeather
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.3 * s;
        torso.add(belt);

        // Fivela
        const buckle = new THREE.Mesh(
            new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.05 * s),
            new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.7, roughness: 0.35 })
        );
        buckle.position.set(0, -0.3 * s, 0.36 * s);
        torso.add(buckle);

        // Calça / quadril
        const hips = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3 * s, 0.34 * s, 0.4 * s, 10),
            matAccent
        );
        hips.position.y = -0.48 * s;
        hips.castShadow = true;
        torso.add(hips);

        // Bolsa lateral (alguns)
        if (variant !== 1) {
            const bag = new THREE.Mesh(
                new THREE.SphereGeometry(0.12 * s, 8, 6),
                matLeather
            );
            bag.scale.set(0.85, 1.1, 0.7);
            bag.position.set(0.38 * s, -0.35 * s, 0.1 * s);
            bag.castShadow = true;
            torso.add(bag);
        }

        group.add(torso);

        // ===== CABEÇA =====
        const headY = 1.98 * s;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.29 * s, 14, 12), matSkin);
        head.position.y = headY;
        head.castShadow = true;
        group.add(head);

        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1 * s, 0.12 * s, 0.28 * s, 8),
            matSkin
        );
        neck.position.y = headY - 0.25 * s;
        neck.castShadow = true;
        group.add(neck);

        const collar = new THREE.Mesh(
            new THREE.SphereGeometry(0.15 * s, 10, 8),
            matCloth
        );
        collar.position.y = headY - 0.38 * s;
        collar.scale.set(1.3, 0.5, 1.1);
        group.add(collar);

        // Cabelo (hemisfério)
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.31 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
            matHair
        );
        hair.position.y = headY + 0.08 * s;
        hair.castShadow = true;
        group.add(hair);

        // Mechas laterais
        for (const side of [-1, 1]) {
            const lock = new THREE.Mesh(
                new THREE.SphereGeometry(0.08 * s, 6, 5),
                matHair
            );
            lock.scale.set(0.6, 1.3, 0.7);
            lock.position.set(side * 0.26 * s, headY - 0.05 * s, 0.0);
            group.add(lock);
        }

        // Olhos
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const eyeIris = new THREE.MeshStandardMaterial({ color: 0x3f3f46 });
        for (const sx of [-0.09, 0.09]) {
            const eyeG = new THREE.Group();
            const w = new THREE.Mesh(new THREE.SphereGeometry(0.048 * s, 8, 6), eyeWhite);
            w.scale.set(1, 1, 0.65);
            eyeG.add(w);
            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.026 * s, 6, 5), eyeIris);
            iris.position.z = 0.03 * s;
            eyeG.add(iris);
            const pupil = new THREE.Mesh(
                new THREE.SphereGeometry(0.012 * s, 5, 4),
                new THREE.MeshStandardMaterial({ color: 0x18181b })
            );
            pupil.position.z = 0.04 * s;
            eyeG.add(pupil);
            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.007 * s, 4, 3),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            shine.position.set(0.01 * s, 0.01 * s, 0.048 * s);
            eyeG.add(shine);
            eyeG.position.set(sx * s, headY + 0.02 * s, 0.27 * s);
            group.add(eyeG);
        }

        // Sobrancelhas
        for (const sx of [-0.09, 0.09]) {
            const brow = new THREE.Mesh(
                new THREE.SphereGeometry(0.04 * s, 5, 4),
                matHair
            );
            brow.scale.set(1.2, 0.3, 0.4);
            brow.position.set(sx * s, headY + 0.1 * s, 0.27 * s);
            brow.rotation.z = sx > 0 ? -0.1 : 0.1;
            group.add(brow);
        }

        // Nariz
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035 * s, 6, 5), matSkinDark);
        nose.scale.set(0.7, 0.85, 0.9);
        nose.position.set(0, headY - 0.02 * s, 0.29 * s);
        group.add(nose);

        // Boca
        const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 6, 5), matMouth);
        mouth.scale.set(1.1, 0.3, 0.35);
        mouth.position.set(0, headY - 0.12 * s, 0.27 * s);
        group.add(mouth);

        // Orelhas
        for (const sx of [-1, 1]) {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.065 * s, 6, 5), matSkin);
            ear.scale.set(0.45, 0.9, 0.6);
            ear.position.set(sx * 0.29 * s, headY, 0.0);
            group.add(ear);
        }

        // Gorro / lenço (variante)
        if (variant === 2) {
            const cap = new THREE.Mesh(
                new THREE.SphereGeometry(0.28 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
                matAccent
            );
            cap.position.y = headY + 0.12 * s;
            group.add(cap);
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
                matCloth
            );
            upper.position.y = -armLen * 0.5;
            upper.castShadow = true;
            arm.add(upper);

            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(0.07 * s, 8, 6),
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
            nameLabel.position.y = 2.48 * s;
            group.add(nameLabel);
        }

        return {
            group,
            torso,
            head,
            leftArm,
            rightArm,
            leftLeg,
            rightLeg,
            nameLabel,
            scale: s,
            headBaseY: headY,
            torsoBaseY: 1.22 * s
        };
    };
})(typeof window !== 'undefined' ? window : globalThis);
