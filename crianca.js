/**
 * crianca.js — Lila, Criança da Vila
 * Corpo menor, laço no cabelo, roupa azul
 */
(function (global) {
    'use strict';

    global.NPC_MESH_CREATORS = global.NPC_MESH_CREATORS || {};

    global.NPC_MESH_CREATORS['child'] = function createCrianca(def) {
        const s = def.scale || 0.72;
        const group = new THREE.Group();
        group.name = def.id;

        const skin = 0xf5d0c5;
        const cloth = 0x2563eb;
        const accent = 0x1d4ed8;
        const hairC = 0xf59e0b;
        const pink = 0xec4899;

        const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
        const matCloth = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.8 });
        const matAccent = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 });
        const matHair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.85 });
        const matPink = new THREE.MeshStandardMaterial({ color: pink, roughness: 0.7 });

        // ===== TORSO (menor) =====
        const torso = new THREE.Group();
        torso.position.y = 0.95 * s;

        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 12, 10), matCloth);
        chest.scale.set(1.15, 1.1, 0.9);
        chest.castShadow = true;
        torso.add(chest);

        // Saia curta
        const skirt = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35 * s, 0.42 * s, 0.35 * s, 10),
            matAccent
        );
        skirt.position.y = -0.35 * s;
        skirt.castShadow = true;
        torso.add(skirt);

        const shGeo = new THREE.SphereGeometry(0.11 * s, 8, 6);
        const lSh = new THREE.Mesh(shGeo, matCloth);
        lSh.position.set(-0.40 * s, 0.15 * s, 0);
        torso.add(lSh);
        const rSh = new THREE.Mesh(shGeo, matCloth);
        rSh.position.set(0.40 * s, 0.15 * s, 0);
        torso.add(rSh);

        
        // Cintura (estreitamento entre peito e saia)
        const waist = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.16 * s, 10),
            matCloth
        );
        waist.position.y = -0.22 * s;
        waist.castShadow = true;
        torso.add(waist);

        // Faixa
        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(0.26 * s, 0.03 * s, 6, 12),
            matAccent
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.2 * s;
        torso.add(belt);

        group.add(torso);

        // ===== CABEÇA (proporcionalmente maior) =====
        const headY = 1.58 * s;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28 * s, 14, 12), matSkin);
        head.position.y = headY;
        head.castShadow = true;
        group.add(head);
        // Pescoço (mais longo, conecta cabeça ao torso)
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09 * s, 0.11 * s, 0.22 * s, 8),
            matSkin
        );
        neck.position.y = headY - 0.22 * s;
        neck.castShadow = true;
        group.add(neck);

        // Base do pescoço / gola
        const collar = new THREE.Mesh(
            new THREE.SphereGeometry(0.14 * s, 10, 8),
            matCloth
        );
        collar.position.y = headY - 0.32 * s;
        collar.scale.set(1.25, 0.5, 1.1);
        collar.castShadow = true;
        group.add(collar);


        // Cabelo
        const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 12, 10), matHair);
        hair.position.y = headY + 0.06 * s;
        hair.scale.set(1.1, 1.0, 1.05);
        hair.castShadow = true;
        group.add(hair);

        // Laço
        const bow = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), matPink);
        bow.position.set(0.14 * s, headY + 0.18 * s, 0.05 * s);
        bow.scale.set(1.2, 0.7, 0.8);
        group.add(bow);
        const bow2 = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 6, 5), matPink);
        bow2.position.set(0.2 * s, headY + 0.15 * s, 0.05 * s);
        group.add(bow2);

        // Olhos grandes
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const eyeIris = new THREE.MeshStandardMaterial({ color: 0x1d4ed8 });
        for (const sx of [-0.09, 0.09]) {
            const eyeG = new THREE.Group();
            const w = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 8, 6), eyeWhite);
            w.scale.set(1, 1.1, 0.7);
            eyeG.add(w);
            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.032 * s, 6, 5), eyeIris);
            iris.position.z = 0.035 * s;
            eyeG.add(iris);
            const shine = new THREE.Mesh(
                new THREE.SphereGeometry(0.012 * s, 5, 4),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            shine.position.set(0.01 * s, 0.01 * s, 0.05 * s);
            eyeG.add(shine);
            eyeG.position.set(sx * s, headY + 0.02 * s, 0.23 * s);
            group.add(eyeG);
        }

        // ===== BRAÇOS =====
        // Pivot real no ombro: braço e mão acompanham juntos durante a animação.
        const armLen = 0.55 * s;
        const armY = 0.88 * s;

        function makeNPCArm(side) {
            const arm = new THREE.Group();
            // O ponto de origem do grupo fica exatamente no centro do ombro.
            arm.position.set(side * 0.40 * s, armY + armLen * 0.5, 0.02 * s);

            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08 * s, 0.07 * s, armLen, 8),
                matCloth
            );
            upper.position.y = -armLen * 0.5;
            upper.castShadow = true;
            arm.add(upper);

            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(0.065 * s, 8, 6),
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
        const legLen = 0.52 * s;
        function makeNPCLeg(side) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.12 * s, legLen, 0);

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
            nameLabel.position.y = 1.95 * s;
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
            torsoBaseY: 0.95 * s
        };
    };
})(typeof window !== 'undefined' ? window : globalThis);
