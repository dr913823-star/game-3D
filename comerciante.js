/**
 * comerciante.js — Vessa, a Comerciante
 * Turbante, bolsa, roupas quentes/douradas
 */
(function (global) {
    'use strict';

    global.NPC_MESH_CREATORS = global.NPC_MESH_CREATORS || {};

    global.NPC_MESH_CREATORS['merchant'] = function createComerciante(def) {
        const s = def.scale || 0.98;
        const group = new THREE.Group();
        group.name = def.id;

        const skin = 0xe8b898;
        const cloth = 0xb45309;
        const accent = 0x92400e;
        const hairC = 0x78350f;
        const red = 0xdc2626;
        const leather = 0x78350f;

        const matSkin = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
        const matCloth = new THREE.MeshStandardMaterial({ color: cloth, roughness: 0.8 });
        const matAccent = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.8 });
        const matHair = new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.9 });
        const matRed = new THREE.MeshStandardMaterial({ color: red, roughness: 0.75 });
        const matLeather = new THREE.MeshStandardMaterial({ color: leather, roughness: 0.9 });

        // ===== TORSO =====
        const torso = new THREE.Group();
        torso.position.y = 1.2 * s;

        const chest = new THREE.Mesh(new THREE.SphereGeometry(0.4 * s, 12, 10), matCloth);
        chest.scale.set(1.18, 1.18, 0.88);
        chest.castShadow = true;
        torso.add(chest);

        // Faixa decorativa
        const sash = new THREE.Mesh(new THREE.BoxGeometry(0.65 * s, 0.12 * s, 0.08 * s), matRed);
        sash.position.set(0, -0.15 * s, 0.28 * s);
        torso.add(sash);

        const shGeo = new THREE.SphereGeometry(0.18 * s, 10, 8);
        const lSh = new THREE.Mesh(shGeo, matAccent);
        lSh.position.set(-0.45 * s, 0.2 * s, 0);
        lSh.castShadow = true;
        torso.add(lSh);
        const rSh = new THREE.Mesh(shGeo, matAccent);
        rSh.position.set(0.45 * s, 0.2 * s, 0);
        rSh.castShadow = true;
        torso.add(rSh);

        
        // Cintura / quadris
        const waist = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3 * s, 0.36 * s, 0.25 * s, 10),
            matCloth
        );
        waist.position.y = -0.4 * s;
        waist.castShadow = true;
        torso.add(waist);

        const hips = new THREE.Mesh(
            new THREE.SphereGeometry(0.32 * s, 10, 8),
            matCloth
        );
        hips.position.y = -0.55 * s;
        hips.scale.set(1.15, 0.5, 0.95);
        hips.castShadow = true;
        torso.add(hips);

        // Cinto
        const belt = new THREE.Mesh(
            new THREE.TorusGeometry(0.34 * s, 0.04 * s, 6, 14),
            matAccent
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = -0.35 * s;
        torso.add(belt);

        group.add(torso);

        // ===== CABEÇA =====
        const headY = 1.98 * s;
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
            new THREE.SphereGeometry(0.16 * s, 10, 8),
            matCloth
        );
        collar.position.y = headY - 0.4 * s;
        collar.scale.set(1.3, 0.55, 1.15);
        collar.castShadow = true;
        group.add(collar);


        // Cabelo
        const hair = new THREE.Mesh(
            new THREE.SphereGeometry(0.32 * s, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
            matHair
        );
        hair.position.y = headY + 0.08 * s;
        group.add(hair);

        // Turbante
        const turban = new THREE.Mesh(
            new THREE.TorusGeometry(0.22 * s, 0.11 * s, 8, 14),
            matRed
        );
        turban.position.y = headY + 0.16 * s;
        turban.rotation.x = Math.PI / 2;
        group.add(turban);
        const turbanTop = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 10, 8), matRed);
        turbanTop.position.y = headY + 0.22 * s;
        turbanTop.scale.set(1, 0.7, 1);
        group.add(turbanTop);

        // Olhos
        const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
        const eyeIris = new THREE.MeshStandardMaterial({ color: 0x78350f });
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
        const armLen = 0.68 * s;
        const armY = 1.3 * s;
        const leftArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085 * s, 0.07 * s, armLen, 8),
            matCloth
        );
        leftArm.position.set(-0.48 * s, armY, 0);
        leftArm.castShadow = true;
        group.add(leftArm);

        const rightArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085 * s, 0.07 * s, armLen, 8),
            matCloth
        );
        rightArm.position.set(0.48 * s, armY, 0);
        rightArm.castShadow = true;
        group.add(rightArm);

        const handGeo = new THREE.SphereGeometry(0.075 * s, 8, 6);
        const lHand = new THREE.Mesh(handGeo, matSkin);
        lHand.position.set(-0.48 * s, armY - armLen * 0.55, 0);
        group.add(lHand);
        const rHand = new THREE.Mesh(handGeo, matSkin);
        rHand.position.set(0.48 * s, armY - armLen * 0.55, 0);
        group.add(rHand);

        // Bolsa (lado esquerdo)
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.2 * s, 10, 8), matLeather);
        bag.position.set(-0.5 * s, 0.95 * s, 0.15 * s);
        bag.scale.set(0.85, 1.1, 0.75);
        bag.castShadow = true;
        group.add(bag);

        // ===== PERNAS =====
        const legLen = 0.7 * s;
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
        const lShoe = new THREE.Mesh(shoeGeo, matLeather);
        lShoe.position.set(-0.14 * s, 0.06 * s, 0.03 * s);
        group.add(lShoe);
        const rShoe = new THREE.Mesh(shoeGeo, matLeather);
        rShoe.position.set(0.14 * s, 0.06 * s, 0.03 * s);
        group.add(rShoe);

        const nameLabel = global.createNPCNameSprite
            ? global.createNPCNameSprite(def.name, def.title)
            : null;
        if (nameLabel) {
            nameLabel.position.y = 2.4 * s;
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
