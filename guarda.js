/**
 * guarda.js — Capitão Roric, Guarda da Vila
 * Elmo, escudo, espada, armadura escura
 */
(function (global) {
    'use strict';

    global.NPC_MESH_CREATORS = global.NPC_MESH_CREATORS || {};

    global.NPC_MESH_CREATORS['guard'] = function createGuarda(def) {
        const s = def.scale || 1.05;
        const group = new THREE.Group();
        group.name = def.id;

        const skin = 0xc68642;
        const armor = 0x334155;
        const armorDark = 0x1e293b;
        const hairC = 0x1c1917;
        const metal = 0x94a3b8;
        const shieldC = 0x1e40af;

        const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
        const matArmor = new THREE.MeshStandardMaterial({ color: armor, roughness: 0.5, metalness: 0.4 });
        const matDark = new THREE.MeshStandardMaterial({ color: armorDark, roughness: 0.55, metalness: 0.35 });
        const matHair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.9 });
        const matMetal = new THREE.MeshStandardMaterial({ color: metal, metalness: 0.85, roughness: 0.25 });
        const matShield = new THREE.MeshStandardMaterial({ color: shieldC, metalness: 0.5, roughness: 0.4 });

        // ===== TORSO (armadura) =====
        const torso = new THREE.Group();
        torso.position.y = 1.28 * s;

        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 12, 10), matArmor);
        chest.scale.set(1.2, 1.15, 0.9);
        chest.castShadow = true;
        torso.add(chest);

        // Ombreiras (menores)
        const shGeo = new THREE.SphereGeometry(0.14 * s, 10, 8);
        const lSh = new THREE.Mesh(shGeo, matDark);
        lSh.position.set(-0.54 * s, 0.25 * s, 0);
        lSh.scale.set(1.1, 0.9, 1);
        lSh.castShadow = true;
        torso.add(lSh);
        const rSh = new THREE.Mesh(shGeo, matDark);
        rSh.position.set(0.54 * s, 0.25 * s, 0);
        rSh.scale.set(1.1, 0.9, 1);
        rSh.castShadow = true;
        torso.add(rSh);

        // Cinto
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.4 * s, 0.05 * s, 6, 14), matMetal);
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.38 * s;
        torso.add(belt);

        
        // Cintura / quadris
        const waist = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32 * s, 0.38 * s, 0.28 * s, 10),
            matArmor
        );
        waist.position.y = -0.42 * s;
        waist.castShadow = true;
        torso.add(waist);

        const hips = new THREE.Mesh(
            new THREE.SphereGeometry(0.34 * s, 10, 8),
            matDark
        );
        hips.position.y = -0.58 * s;
        hips.scale.set(1.2, 0.5, 1.0);
        hips.castShadow = true;
        torso.add(hips);

        group.add(torso);

        // ===== CABEÇA =====
        const headY = 2.08 * s;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 14, 12), matSkin);
        head.position.y = headY;
        head.castShadow = true;
        group.add(head);
        // Pescoço (mais longo, conecta cabeça ao torso)
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.11 * s, 0.14 * s, 0.32 * s, 8),
            matSkin
        );
        neck.position.y = headY - 0.28 * s;
        neck.castShadow = true;
        group.add(neck);

        // Base do pescoço / gola da armadura
        const collar = new THREE.Mesh(
            new THREE.SphereGeometry(0.18 * s, 10, 8),
            matArmor
        );
        collar.position.y = headY - 0.42 * s;
        collar.scale.set(1.3, 0.55, 1.15);
        collar.castShadow = true;
        group.add(collar);


        // Elmo
        const helm = new THREE.Mesh(
            new THREE.SphereGeometry(0.34 * s, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
            matMetal
        );
        helm.position.y = headY + 0.08 * s;
        group.add(helm);

        // Visor
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.09 * s, 0.12 * s), matMetal);
        visor.position.set(0, headY + 0.02 * s, 0.22 * s);
        group.add(visor);

        // Olhos (por baixo do elmo)
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const eyeIris = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        for (const sx of [-0.09, 0.09]) {
            const eyeG = new THREE.Group();
            const w = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 8, 6), eyeWhite);
            w.scale.set(1, 1, 0.7);
            eyeG.add(w);
            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.025 * s, 6, 5), eyeIris);
            iris.position.z = 0.03 * s;
            eyeG.add(iris);
            eyeG.position.set(sx * s, headY + 0.0 * s, 0.24 * s);
            group.add(eyeG);
        }

        // ===== BRAÇOS =====
        // Pivot real no ombro: braço e mão acompanham juntos durante a animação.
        const armLen = 0.68 * s;
        const armY = 1.10 * s;

        function makeNPCArm(side) {
            const arm = new THREE.Group();
            // O ponto de origem do grupo fica exatamente no centro do ombro.
            arm.position.set(side * 0.54 * s, armY + armLen * 0.5, 0.02 * s);

            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08 * s, 0.07 * s, armLen, 8),
                matArmor
            );
            upper.position.y = -armLen * 0.5;
            upper.castShadow = true;
            arm.add(upper);

            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(0.085 * s, 8, 6),
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
        const legLen = 0.75 * s;
        function makeNPCLeg(side) {
            const leg = new THREE.Group();
            leg.position.set(side * 0.16 * s, legLen, 0);

            const shin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.1 * s, 0.09 * s, legLen, 8),
                matDark
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
            nameLabel.position.y = 2.55 * s;
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
            torsoBaseY: 1.28 * s
        };
    };
})(typeof window !== 'undefined' ? window : globalThis);
