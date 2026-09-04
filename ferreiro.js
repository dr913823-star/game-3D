/**
 * ferreiro.js — Borin, o Ferreiro
 * Corpo robusto, avental de couro, martelo
 */
(function (global) {
    'use strict';

    global.NPC_MESH_CREATORS = global.NPC_MESH_CREATORS || {};

    global.NPC_MESH_CREATORS['blacksmith'] = function createFerreiro(def) {
        const s = def.scale || 1.08;
        const group = new THREE.Group();
        group.name = def.id;

        const skin = 0xb45309;
        const cloth = 0x44403c;
        const leather = 0x78350f;
        const hairC = 0x1c1917;
        const metal = 0x94a3b8;
        const wood = 0x5c3d2e;

        const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
        const matCloth = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.85 });
        const matLeather = new THREE.MeshStandardMaterial({ color: leather, roughness: 0.9 });
        const matHair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.9 });
        const matMetal = new THREE.MeshStandardMaterial({ color: metal, metalness: 0.8, roughness: 0.3 });
        const matWood = new THREE.MeshStandardMaterial({ color: wood, roughness: 0.85 });

        // ===== TORSO (robusto) =====
        const torso = new THREE.Group();
        torso.position.y = 1.25 * s;

        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42 * s, 12, 10), matCloth);
        chest.scale.set(1.25, 1.15, 0.9);
        chest.castShadow = true;
        torso.add(chest);

        // Ombros (reduzidos)
        const shGeo = new THREE.SphereGeometry(0.14 * s, 10, 8);
        const lSh = new THREE.Mesh(shGeo, matCloth);
        lSh.position.set(-0.52 * s, 0.22 * s, 0);
        lSh.scale.set(1.1, 0.9, 1);
        lSh.castShadow = true;
        torso.add(lSh);
        const rSh = new THREE.Mesh(shGeo, matCloth);
        rSh.position.set(0.52 * s, 0.22 * s, 0);
        rSh.scale.set(1.1, 0.9, 1);
        rSh.castShadow = true;
        torso.add(rSh);

        // Avental
        const apron = new THREE.Mesh(new THREE.BoxGeometry(0.7 * s, 0.85 * s, 0.1 * s), matLeather);
        apron.position.set(0, -0.25 * s, 0.32 * s);
        apron.castShadow = true;
        torso.add(apron);

        // Cinto
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.4 * s, 0.05 * s, 6, 14), matLeather);
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.35 * s;
        torso.add(belt);

        
        // Cintura / quadris
        const waist = new THREE.Mesh(
            new THREE.CylinderGeometry(0.32 * s, 0.38 * s, 0.28 * s, 10),
            matCloth
        );
        waist.position.y = -0.42 * s;
        waist.castShadow = true;
        torso.add(waist);

        const hips = new THREE.Mesh(
            new THREE.SphereGeometry(0.34 * s, 10, 8),
            matCloth
        );
        hips.position.y = -0.58 * s;
        hips.scale.set(1.2, 0.5, 1.0);
        hips.castShadow = true;
        torso.add(hips);

        group.add(torso);

        // ===== CABEÇA =====
        const headY = 2.05 * s;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 14, 12), matSkin);
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

        // Base do pescoço / gola (preenche espaço com o peito)
        const collar = new THREE.Mesh(
            new THREE.SphereGeometry(0.18 * s, 10, 8),
            matCloth
        );
        collar.position.y = headY - 0.42 * s;
        collar.scale.set(1.3, 0.55, 1.15);
        collar.castShadow = true;
        group.add(collar);


        // Cabelo curto + barba
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.34 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
            matHair
        );
        hair.position.y = headY + 0.1 * s;
        group.add(hair);

        const beard = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 8, 6), matHair);
        beard.position.set(0, headY - 0.2 * s, 0.2 * s);
        beard.scale.set(0.95, 1.2, 0.75);
        group.add(beard);

        // Olhos
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const eyeIris = new THREE.MeshStandardMaterial({ color: 0x1e293b });
        for (const sx of [-0.1, 0.1]) {
            const eyeG = new THREE.Group();
            const w = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 8, 6), eyeWhite);
            w.scale.set(1, 1, 0.7);
            eyeG.add(w);
            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 6, 5), eyeIris);
            iris.position.z = 0.035 * s;
            eyeG.add(iris);
            eyeG.position.set(sx * s, headY + 0.02 * s, 0.26 * s);
            group.add(eyeG);
        }

        // ===== BRAÇOS =====
        // Pivot real no ombro: braço e mão acompanham juntos durante a animação.
        const armLen = 0.68 * s;
        const armY = 1.10 * s;

        function makeNPCArm(side) {
            const arm = new THREE.Group();
            // O ponto de origem do grupo fica exatamente no centro do ombro.
            arm.position.set(side * 0.52 * s, armY + armLen * 0.5, 0.02 * s);

            const upper = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08 * s, 0.07 * s, armLen, 8),
                matCloth
            );
            upper.position.y = -armLen * 0.5;
            upper.castShadow = true;
            arm.add(upper);

            const hand = new THREE.Mesh(
                new THREE.SphereGeometry(0.09 * s, 8, 6),
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
                matCloth
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
            nameLabel.position.y = 2.45 * s;
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
            torsoBaseY: 1.25 * s
        };
    };
})(typeof window !== 'undefined' ? window : globalThis);
