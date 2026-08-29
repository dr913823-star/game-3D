/**
 * anciao_marcus.js — Ancião Marcus, Guardião da Vila
 * Vestes azuis, cabelo branco, barba, cajado com orbe
 */
(function (global) {
    'use strict';

    global.NPC_MESH_CREATORS = global.NPC_MESH_CREATORS || {};

    global.NPC_MESH_CREATORS['elder'] = function createAnciaoMarcus(def) {
        const s = def.scale || 1.0;
        const group = new THREE.Group();
        group.name = def.id;

        const skin = 0xe0b090;
        const robe = 0x3b5bdb;
        const accent = 0x1e3a8a;
        const hairC = 0xd1d5db;
        const wood = 0x5c3d2e;
        const gold = 0xd97706;

        const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75 });
        const matRobe = new THREE.MeshStandardMaterial({ color: robe, roughness: 0.8 });
        const matAccent = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 });
        const matHair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.85 });
        const matWood = new THREE.MeshStandardMaterial({ color: wood, roughness: 0.85 });
        const matGold = new THREE.MeshStandardMaterial({ color: gold, metalness: 0.7, roughness: 0.3 });

        // ===== TORSO =====
        const torso = new THREE.Group();
        torso.position.y = 1.22 * s;

        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s, 12, 10), matRobe);
        chest.scale.set(1.2, 1.2, 0.88);
        chest.castShadow = true;
        torso.add(chest);

        // Manto / saia longa
        const cloak = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42 * s, 0.55 * s, 0.85 * s, 10),
            matRobe
        );
        cloak.position.y = -0.55 * s;
        cloak.castShadow = true;
        torso.add(cloak);

        const shGeo = new THREE.SphereGeometry(0.18 * s, 10, 8);
        const lSh = new THREE.Mesh(shGeo, matAccent);
        lSh.position.set(-0.45 * s, 0.22 * s, 0);
        lSh.castShadow = true;
        torso.add(lSh);
        const rSh = new THREE.Mesh(shGeo, matAccent);
        rSh.position.set(0.45 * s, 0.22 * s, 0);
        rSh.castShadow = true;
        torso.add(rSh);

        // Cinto dourado
        const belt = new THREE.Mesh(new THREE.TorusGeometry(0.38 * s, 0.04 * s, 6, 14), matGold);
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.25 * s;
        torso.add(belt);

        
        // Cintura (estreitamento entre peito e manto)
        const waist = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3 * s, 0.36 * s, 0.2 * s, 10),
            matRobe
        );
        waist.position.y = -0.3 * s;
        waist.castShadow = true;
        torso.add(waist);

        group.add(torso);

        // ===== CABEÇA =====
        const headY = 2.02 * s;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 14, 12), matSkin);
        head.position.y = headY;
        head.castShadow = true;
        group.add(head);
        // Pescoço (mais longo, conecta cabeça ao torso)
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1 * s, 0.13 * s, 0.3 * s, 8),
            matSkin
        );
        neck.position.y = headY - 0.26 * s;
        neck.castShadow = true;
        group.add(neck);

        // Base do pescoço / gola
        const collar = new THREE.Mesh(
            new THREE.SphereGeometry(0.17 * s, 10, 8),
            matRobe
        );
        collar.position.y = headY - 0.4 * s;
        collar.scale.set(1.3, 0.55, 1.15);
        collar.castShadow = true;
        group.add(collar);


        // Cabelo branco
        const hairTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.33 * s, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
            matHair
        );
        hairTop.position.y = headY + 0.1 * s;
        group.add(hairTop);

        // Barba
        const beard = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 10, 8), matHair);
        beard.position.set(0, headY - 0.22 * s, 0.18 * s);
        beard.scale.set(0.95, 1.3, 0.8);
        group.add(beard);

        // Olhos
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const eyeIris = new THREE.MeshStandardMaterial({ color: 0x1e3a8a });
        for (const sx of [-0.09, 0.09]) {
            const eyeG = new THREE.Group();
            const w = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 8, 6), eyeWhite);
            w.scale.set(1, 1, 0.7);
            eyeG.add(w);
            const iris = new THREE.Mesh(new THREE.SphereGeometry(0.028 * s, 6, 5), eyeIris);
            iris.position.z = 0.032 * s;
            eyeG.add(iris);
            eyeG.position.set(sx * s, headY + 0.02 * s, 0.25 * s);
            group.add(eyeG);
        }

        // ===== BRAÇOS =====
        const armLen = 0.7 * s;
        const armY = 1.32 * s;
        const leftArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085 * s, 0.07 * s, armLen, 8),
            matRobe
        );
        leftArm.position.set(-0.5 * s, armY, 0);
        leftArm.castShadow = true;
        group.add(leftArm);

        const rightArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085 * s, 0.07 * s, armLen, 8),
            matRobe
        );
        rightArm.position.set(0.5 * s, armY, 0);
        rightArm.castShadow = true;
        group.add(rightArm);

        const handGeo = new THREE.SphereGeometry(0.075 * s, 8, 6);
        const lHand = new THREE.Mesh(handGeo, matSkin);
        lHand.position.set(-0.5 * s, armY - armLen * 0.55, 0);
        group.add(lHand);
        const rHand = new THREE.Mesh(handGeo, matSkin);
        rHand.position.set(0.5 * s, armY - armLen * 0.55, 0);
        group.add(rHand);

        // Cajado
        const staff = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035 * s, 0.04 * s, 2.3 * s, 8),
            matWood
        );
        staff.position.set(0.55 * s, 1.15 * s, 0.1 * s);
        staff.castShadow = true;
        group.add(staff);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 10, 8), matGold);
        orb.position.set(0.55 * s, 2.35 * s, 0.1 * s);
        orb.castShadow = true;
        group.add(orb);
        // Brilho no orbe
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(0.08 * s, 8, 6),
            new THREE.MeshStandardMaterial({
                color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.6,
                transparent: true, opacity: 0.7
            })
        );
        glow.position.set(0.55 * s, 2.35 * s, 0.1 * s);
        group.add(glow);

        // ===== PERNAS =====
        const legLen = 0.72 * s;
        const leftLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1 * s, 0.09 * s, legLen, 8),
            matAccent
        );
        leftLeg.position.set(-0.14 * s, legLen * 0.5, 0);
        leftLeg.castShadow = true;
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1 * s, 0.09 * s, legLen, 8),
            matAccent
        );
        rightLeg.position.set(0.14 * s, legLen * 0.5, 0);
        rightLeg.castShadow = true;
        group.add(rightLeg);

        const shoeGeo = new THREE.BoxGeometry(0.15 * s, 0.1 * s, 0.24 * s);
        const lShoe = new THREE.Mesh(shoeGeo, matAccent);
        lShoe.position.set(-0.14 * s, 0.06 * s, 0.03 * s);
        group.add(lShoe);
        const rShoe = new THREE.Mesh(shoeGeo, matAccent);
        rShoe.position.set(0.14 * s, 0.06 * s, 0.03 * s);
        group.add(rShoe);

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
            torsoBaseY: 1.22 * s
        };
    };
})(typeof window !== 'undefined' ? window : globalThis);
