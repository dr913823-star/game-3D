/**
 * skins.js — Skins polidas: Guerreiro, Defensor, Explorador, Mago
 *
 * API:
 *   SKIN_CATALOG | getSkinById(id) | applySkinToPlayer(player, skinId) | listSkins()
 */
(function (global) {
    'use strict';

    const SKIN_CATALOG = [
        {
            id: 'guerreiro',
            name: 'Guerreiro',
            title: 'Valerius de Eldoria',
            desc: 'Herói clássico — aço dourado e capa carmesim.',
            icon: 'fa-shield-halved',
            colors: {
                skin: 0xf0c4a0,
                skinDark: 0xd4a07a,
                hair: 0x1c1210,
                eyeIris: 0x2563eb,
                armor: 0x475569,
                armorDark: 0x1e293b,
                gold: 0xf59e0b,
                cloth: 0xb45309,
                clothDark: 0x7c2d12,
                leather: 0x5c4033,
                cape: 0x991b1b,
                mouth: 0x9f1239
            },
            extras: 'guerreiro',
            accent: '#f59e0b'
        },
        {
            id: 'defensor',
            name: 'Defensor',
            title: 'Guardião de Aço',
            desc: 'Elmo fechado, placas azuis e escudo real.',
            icon: 'fa-shield-halved',
            colors: {
                skin: 0xe8b896,
                skinDark: 0xc9956c,
                hair: 0x0f172a,
                eyeIris: 0x7dd3fc,
                armor: 0x1e3a8a,
                armorDark: 0x0c1e3d,
                gold: 0xcbd5e1,
                cloth: 0x1d4ed8,
                clothDark: 0x1e3a8a,
                leather: 0x334155,
                cape: 0x172554,
                mouth: 0x7f1d1d
            },
            extras: 'defensor',
            accent: '#38bdf8'
        },
        {
            id: 'explorador',
            name: 'Explorador',
            title: 'Andarilho das Matas',
            desc: 'Capuz de couro, aljava e tons da floresta.',
            icon: 'fa-leaf',
            colors: {
                skin: 0xe0b080,
                skinDark: 0xc09060,
                hair: 0x3b2a1a,
                eyeIris: 0x4ade80,
                armor: 0x3f6212,
                armorDark: 0x1a2e05,
                gold: 0xd9f99d,
                cloth: 0x65a30d,
                clothDark: 0x3f6212,
                leather: 0x7c2d12,
                cape: 0x14532d,
                mouth: 0x9a3412
            },
            extras: 'explorador',
            accent: '#4ade80'
        },
        {
            id: 'mago',
            name: 'Mago',
            title: 'Arcano de Eldoria',
            desc: 'Chapéu místico, orbe brilhante e túnicas violeta.',
            icon: 'fa-hat-wizard',
            colors: {
                skin: 0xf0d0b8,
                skinDark: 0xd4b098,
                hair: 0x2e1065,
                eyeIris: 0xe9d5ff,
                armor: 0x5b21b6,
                armorDark: 0x2e1065,
                gold: 0xf0abfc,
                cloth: 0x7c3aed,
                clothDark: 0x4c1d95,
                leather: 0x312e81,
                cape: 0x4c1d95,
                mouth: 0x9f1239
            },
            extras: 'mago',
            accent: '#c084fc'
        }
    ];

    function getSkinById(id) {
        return SKIN_CATALOG.find(s => s.id === id) || SKIN_CATALOG[0];
    }

    function listSkins() {
        return SKIN_CATALOG.slice();
    }

    function _mat(opts) {
        return new THREE.MeshStandardMaterial(opts);
    }

    function _applyColors(player, colors) {
        if (!player || !player.mats || !colors) return;
        const m = player.mats;
        const set = (mat, hex) => {
            if (mat && mat.color && typeof hex === 'number') mat.color.setHex(hex);
        };
        set(m.skin, colors.skin);
        set(m.skinDark, colors.skinDark);
        set(m.hair, colors.hair);
        set(m.eyeIris, colors.eyeIris);
        set(m.armor, colors.armor);
        set(m.armorDark, colors.armorDark);
        set(m.gold, colors.gold);
        set(m.cloth, colors.cloth);
        set(m.clothDark, colors.clothDark);
        set(m.leather, colors.leather);
        set(m.cape, colors.cape);
        set(m.mouth, colors.mouth);
        // Brilho sutil na armadura por skin
        if (m.armor) {
            m.armor.metalness = colors.armorMetal != null ? colors.armorMetal : 0.55;
            m.armor.roughness = colors.armorRough != null ? colors.armorRough : 0.4;
        }
    }

    function _clearExtras(player) {
        if (!player || !player.group) return;
        const kill = [];
        for (let i = player.group.children.length - 1; i >= 0; i--) {
            const c = player.group.children[i];
            if (c.name === 'skin_extras') kill.push(c);
        }
        player.group.traverse(obj => {
            if (obj !== player.group && obj.name === 'skin_extras') kill.push(obj);
        });
        for (const obj of [...new Set(kill)]) {
            if (obj.parent) obj.parent.remove(obj);
            obj.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material && o.material.userData && o.material.userData._skinOwned) {
                    o.material.dispose();
                }
            });
        }
    }

    function _own(mat) {
        mat.userData = mat.userData || {};
        mat.userData._skinOwned = true;
        return mat;
    }

    function _shadow(mesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }

    // ─── GUERREIRO ───────────────────────────────────────────
    function _buildGuerreiroExtras(player) {
        const g = new THREE.Group();
        g.name = 'skin_extras';

        const steel = _own(_mat({ color: 0x94a3b8, metalness: 0.85, roughness: 0.28 }));
        const gold = _own(_mat({ color: 0xf59e0b, metalness: 0.8, roughness: 0.3 }));
        const dark = _own(_mat({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 }));

        // Ombreiras ornamentadas
        for (const side of [-1, 1]) {
            const pauldron = _shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI, 0, Math.PI),
                steel
            ));
            pauldron.scale.set(1.15, 0.75, 1.05);
            pauldron.position.set(side * 0.62, 1.85, 0.02);
            pauldron.rotation.z = side * 0.35;
            g.add(pauldron);

            const rim = _shadow(new THREE.Mesh(
                new THREE.TorusGeometry(0.2, 0.03, 6, 12),
                gold
            ));
            rim.position.set(side * 0.62, 1.85, 0.05);
            rim.rotation.y = side * 0.4;
            g.add(rim);
        }

        // Tiara / diadema sutil
        const band = _shadow(new THREE.Mesh(
            new THREE.TorusGeometry(0.36, 0.035, 6, 16),
            gold
        ));
        band.position.set(0, 2.55, 0.02);
        band.rotation.x = Math.PI / 2;
        band.scale.set(1, 1, 0.85);
        g.add(band);

        // Gem central na testa
        const gem = _shadow(new THREE.Mesh(
            new THREE.OctahedronGeometry(0.06, 0),
            gold
        ));
        gem.position.set(0, 2.55, 0.34);
        g.add(gem);

        // Broche na capa
        const brooch = _shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 10, 8),
            gold
        ));
        brooch.position.set(0, 1.95, -0.42);
        brooch.scale.set(1, 1, 0.5);
        g.add(brooch);

        // Cinto reforçado
        const beltPlate = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.35, 0.18, 0.08),
            dark
        ));
        beltPlate.position.set(0, 1.12, 0.42);
        g.add(beltPlate);
        const beltGem = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), gold);
        beltGem.position.set(0, 1.12, 0.48);
        g.add(beltGem);

        player.group.add(g);
    }

    // ─── DEFENSOR ────────────────────────────────────────────
    function _buildDefensorExtras(player) {
        const g = new THREE.Group();
        g.name = 'skin_extras';

        const steel = _own(_mat({ color: 0xb0bec8, metalness: 0.88, roughness: 0.22 }));
        const steelDark = _own(_mat({ color: 0x455a64, metalness: 0.8, roughness: 0.3 }));
        const azure = _own(_mat({ color: 0x1d4ed8, metalness: 0.45, roughness: 0.35, emissive: 0x1e3a8a, emissiveIntensity: 0.15 }));
        const silver = _own(_mat({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.18 }));

        // Elmo fechado (casco)
        const dome = _shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
            steel
        ));
        dome.position.set(0, 2.48, 0);
        g.add(dome);

        // Parte traseira do elmo
        const back = _shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 12, 10),
            steelDark
        ));
        back.position.set(0, 2.4, -0.08);
        back.scale.set(1.0, 0.95, 0.85);
        g.add(back);

        // Guarda-bochechas
        for (const side of [-1, 1]) {
            const cheek = _shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.16, 10, 8),
                steel
            ));
            cheek.scale.set(0.55, 1.1, 0.8);
            cheek.position.set(side * 0.32, 2.28, 0.12);
            g.add(cheek);
        }

        // Visor em T
        const visorBar = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.06, 0.12),
            steelDark
        ));
        visorBar.position.set(0, 2.4, 0.34);
        g.add(visorBar);
        const visorMid = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.22, 0.1),
            steelDark
        ));
        visorMid.position.set(0, 2.28, 0.34);
        g.add(visorMid);

        // Crista azul ondulada
        const crest = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.28, 0.55),
            azure
        ));
        crest.position.set(0, 2.78, -0.02);
        crest.rotation.x = -0.15;
        g.add(crest);
        // pontas da crista
        for (let i = 0; i < 5; i++) {
            const t = i / 4;
            const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.035, 0.14, 5),
                azure
            );
            spike.position.set(0, 2.9 + Math.sin(t * Math.PI) * 0.04, -0.22 + t * 0.4);
            spike.rotation.x = 0.5;
            g.add(spike);
        }

        // Ombreiras pesadas em placa
        for (const side of [-1, 1]) {
            const plate = _shadow(new THREE.Mesh(
                new THREE.BoxGeometry(0.38, 0.22, 0.42),
                steel
            ));
            plate.position.set(side * 0.58, 1.88, 0);
            plate.rotation.z = side * 0.25;
            g.add(plate);
            const edge = _shadow(new THREE.Mesh(
                new THREE.BoxGeometry(0.4, 0.05, 0.44),
                silver
            ));
            edge.position.set(side * 0.58, 1.98, 0);
            edge.rotation.z = side * 0.25;
            g.add(edge);
        }

        // Escudo heráldico nas costas
        const shieldG = new THREE.Group();
        shieldG.position.set(0.05, 1.5, -0.55);
        shieldG.rotation.y = 0.15;

        const board = _shadow(new THREE.Mesh(
            new THREE.CylinderGeometry(0.48, 0.42, 0.07, 6),
            steel
        ));
        board.rotation.x = Math.PI / 2;
        board.rotation.z = Math.PI / 6;
        shieldG.add(board);

        const rim = _shadow(new THREE.Mesh(
            new THREE.TorusGeometry(0.46, 0.035, 6, 6),
            silver
        ));
        rim.position.z = 0.02;
        shieldG.add(rim);

        const crossH = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.08, 0.04),
            azure
        ));
        crossH.position.z = 0.04;
        shieldG.add(crossH);
        const crossV = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.55, 0.04),
            azure
        ));
        crossV.position.z = 0.04;
        shieldG.add(crossV);

        const boss = _shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 10, 8),
            silver
        ));
        boss.position.z = 0.08;
        shieldG.add(boss);

        g.add(shieldG);

        // Peitoral reforçado (placas extras)
        const chestPlate = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 0.55, 0.18),
            steel
        ));
        chestPlate.position.set(0, 1.55, 0.38);
        g.add(chestPlate);
        const chestEdge = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.76, 0.06, 0.2),
            silver
        ));
        chestEdge.position.set(0, 1.8, 0.38);
        g.add(chestEdge);

        // Cinto protetor pesado
        const belt = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.78, 0.12, 0.22),
            steelDark
        ));
        belt.position.set(0, 1.15, 0.25);
        g.add(belt);
        const beltBuckle = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.1, 0.06),
            silver
        ));
        beltBuckle.position.set(0, 1.15, 0.38);
        g.add(beltBuckle);

        // Cotoveleiras / gauntlets
        for (const side of [-1, 1]) {
            const gaunt = _shadow(new THREE.Mesh(
                new THREE.BoxGeometry(0.16, 0.22, 0.14),
                steel
            ));
            gaunt.position.set(side * 0.58, 1.2, 0.1);
            g.add(gaunt);
        }

        // Botas pesadas (placas)
        for (const side of [-1, 1]) {
            const bootPlate = _shadow(new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.12, 0.28),
                steelDark
            ));
            bootPlate.position.set(side * 0.22, 0.18, 0.08);
            g.add(bootPlate);
        }

        // Capa defensiva curta
        const cape = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.9, 0.06),
            azure
        ));
        cape.position.set(0, 1.4, -0.5);
        cape.rotation.x = 0.15;
        g.add(cape);

        player.group.add(g);
    }

    // ─── EXPLORADOR ──────────────────────────────────────────
    function _buildExploradorExtras(player) {
        const g = new THREE.Group();
        g.name = 'skin_extras';

        const leather = _own(_mat({ color: 0x6b3f22, roughness: 0.88, metalness: 0.06 }));
        const leatherDark = _own(_mat({ color: 0x3d2414, roughness: 0.9, metalness: 0.04 }));
        const moss = _own(_mat({ color: 0x3f6212, roughness: 0.82, metalness: 0.05 }));
        const leaf = _own(_mat({ color: 0x4ade80, roughness: 0.65, metalness: 0.05 }));
        const bronze = _own(_mat({ color: 0xb45309, metalness: 0.55, roughness: 0.4 }));

        // Capuz (capa sobre a cabeça)
        const hood = _shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.46, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
            moss
        ));
        hood.position.set(0, 2.5, -0.04);
        hood.scale.set(1.05, 0.95, 1.1);
        g.add(hood);

        // Aba do capuz
        const hoodRim = _shadow(new THREE.Mesh(
            new THREE.TorusGeometry(0.4, 0.04, 6, 16, Math.PI * 1.2),
            leather
        ));
        hoodRim.position.set(0, 2.42, 0.12);
        hoodRim.rotation.x = 0.9;
        g.add(hoodRim);

        // Pena longa no lado
        const feather = _shadow(new THREE.Mesh(
            new THREE.ConeGeometry(0.035, 0.55, 6),
            leaf
        ));
        feather.position.set(0.32, 2.75, -0.05);
        feather.rotation.z = -0.55;
        feather.rotation.x = 0.25;
        g.add(feather);
        const feather2 = _shadow(new THREE.Mesh(
            new THREE.ConeGeometry(0.028, 0.4, 5),
            moss
        ));
        feather2.position.set(0.28, 2.7, 0.02);
        feather2.rotation.z = -0.4;
        g.add(feather2);

        // Aljava nas costas
        const quiver = _shadow(new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.12, 0.7, 8),
            leatherDark
        ));
        quiver.position.set(-0.35, 1.55, -0.42);
        quiver.rotation.z = 0.2;
        quiver.rotation.x = 0.15;
        g.add(quiver);

        // Flechas (topo da aljava)
        for (let i = 0; i < 3; i++) {
            const shaft = new THREE.Mesh(
                new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4),
                bronze
            );
            shaft.position.set(-0.32 + i * 0.04, 1.95, -0.4);
            shaft.rotation.z = 0.15;
            g.add(shaft);
            const tip = new THREE.Mesh(
                new THREE.ConeGeometry(0.02, 0.06, 4),
                leaf
            );
            tip.position.set(-0.32 + i * 0.04, 2.12, -0.4);
            tip.rotation.z = 0.15;
            g.add(tip);
        }

        // Bolsas no cinto
        for (const side of [-1, 1]) {
            const pouch = _shadow(new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 0.2, 0.14),
                leather
            ));
            pouch.position.set(side * 0.42, 1.12, 0.2);
            pouch.rotation.y = side * 0.3;
            g.add(pouch);
            // aba
            const flap = new THREE.Mesh(
                new THREE.BoxGeometry(0.24, 0.06, 0.15),
                leatherDark
            );
            flap.position.set(side * 0.42, 1.22, 0.2);
            g.add(flap);
        }

        // Bandoleira no peito
        const strap = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.9, 0.04),
            leather
        ));
        strap.position.set(0.15, 1.6, 0.4);
        strap.rotation.z = -0.5;
        g.add(strap);

        // Fivela
        const buckle = _shadow(new THREE.Mesh(
            new THREE.TorusGeometry(0.07, 0.02, 6, 10),
            bronze
        ));
        buckle.position.set(0, 1.15, 0.45);
        g.add(buckle);

        // Mochila de viagem (costas)
        const pack = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.48, 0.28),
            leather
        ));
        pack.position.set(0.05, 1.55, -0.55);
        g.add(pack);
        const packTop = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.44, 0.1, 0.3),
            leatherDark
        ));
        packTop.position.set(0.05, 1.82, -0.55);
        g.add(packTop);
        // Alças da mochila
        for (const side of [-1, 1]) {
            const strapP = _shadow(new THREE.Mesh(
                new THREE.BoxGeometry(0.06, 0.55, 0.03),
                leatherDark
            ));
            strapP.position.set(side * 0.18, 1.7, -0.28);
            strapP.rotation.x = 0.35;
            g.add(strapP);
        }

        // Cachecol leve
        const scarf = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.12, 0.08),
            moss
        ));
        scarf.position.set(0, 2.05, 0.35);
        g.add(scarf);
        const scarfEnd = _shadow(new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.35, 0.06),
            leaf
        ));
        scarfEnd.position.set(0.28, 1.85, 0.32);
        scarfEnd.rotation.z = 0.25;
        g.add(scarfEnd);

        // Luvas de explorador
        for (const side of [-1, 1]) {
            const glove = _shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.09, 8, 6),
                leather
            ));
            glove.scale.set(1.1, 0.7, 1.0);
            glove.position.set(side * 0.55, 1.05, 0.15);
            g.add(glove);
        }

        player.group.add(g);
    }

    // ─── MAGO ────────────────────────────────────────────────
    function _buildMagoExtras(player) {
        const g = new THREE.Group();
        g.name = 'skin_extras';

        const robe = _own(_mat({
            color: 0x6d28d9, roughness: 0.75, metalness: 0.12, side: THREE.DoubleSide
        }));
        const robeDark = _own(_mat({
            color: 0x3b0764, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide
        }));
        const crystal = _own(_mat({
            color: 0xe9d5ff, metalness: 0.55, roughness: 0.15,
            emissive: 0x7c3aed, emissiveIntensity: 0.45
        }));
        const gold = _own(_mat({ color: 0xf0abfc, metalness: 0.75, roughness: 0.25 }));
        const wood = _own(_mat({ color: 0x5c3d2e, roughness: 0.88, metalness: 0.05 }));

        // Chapéu pontudo
        const hat = _shadow(new THREE.Mesh(
            new THREE.ConeGeometry(0.38, 1.05, 12),
            robe
        ));
        hat.position.set(0, 3.05, -0.06);
        hat.rotation.x = -0.12;
        g.add(hat);

        const hatBand = _shadow(new THREE.Mesh(
            new THREE.CylinderGeometry(0.39, 0.39, 0.07, 12),
            gold
        ));
        hatBand.position.set(0, 2.58, -0.02);
        g.add(hatBand);

        const brim = _shadow(new THREE.Mesh(
            new THREE.CylinderGeometry(0.62, 0.58, 0.045, 16),
            robeDark
        ));
        brim.position.set(0, 2.52, 0);
        g.add(brim);

        const topGem = _shadow(new THREE.Mesh(
            new THREE.OctahedronGeometry(0.11, 0),
            crystal
        ));
        topGem.position.set(0, 3.55, -0.08);
        g.add(topGem);

        const gemRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.09, 0.018, 6, 12),
            gold
        );
        gemRing.position.set(0, 3.42, -0.08);
        gemRing.rotation.x = Math.PI / 2;
        g.add(gemRing);

        for (const side of [-1, 1]) {
            const shoulder = _shadow(new THREE.Mesh(
                new THREE.SphereGeometry(0.26, 10, 8),
                robeDark
            ));
            shoulder.scale.set(1.1, 0.7, 1.0);
            shoulder.position.set(side * 0.55, 1.9, -0.05);
            g.add(shoulder);
        }

        const chain = _shadow(new THREE.Mesh(
            new THREE.TorusGeometry(0.14, 0.015, 5, 12),
            gold
        ));
        chain.position.set(0, 1.85, 0.42);
        chain.rotation.x = 0.4;
        g.add(chain);
        const amulet = _shadow(new THREE.Mesh(
            new THREE.OctahedronGeometry(0.1, 0),
            crystal
        ));
        amulet.position.set(0, 1.68, 0.48);
        g.add(amulet);

        for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * Math.PI * 2;
            const rune = new THREE.Mesh(
                new THREE.TorusGeometry(0.06, 0.012, 4, 8),
                crystal
            );
            rune.position.set(
                Math.cos(ang) * 0.7,
                1.75 + Math.sin(ang * 2) * 0.1,
                Math.sin(ang) * 0.35
            );
            rune.rotation.y = ang;
            g.add(rune);
        }

        player.group.add(g);

        // Cajado na mão direita (substitui a espada)
        const staff = new THREE.Group();
        staff.name = 'mage_staff';

        const shaft = _shadow(new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.04, 1.85, 8),
            wood
        ));
        shaft.position.y = 0.55;
        staff.add(shaft);

        for (let i = 0; i < 4; i++) {
            const band = new THREE.Mesh(
                new THREE.TorusGeometry(0.048, 0.012, 5, 10),
                gold
            );
            band.position.y = 0.15 + i * 0.32;
            band.rotation.x = Math.PI / 2;
            staff.add(band);
        }

        const claw = _shadow(new THREE.Mesh(
            new THREE.ConeGeometry(0.09, 0.18, 5),
            gold
        ));
        claw.position.y = 1.38;
        claw.rotation.x = Math.PI;
        staff.add(claw);

        const orb = _shadow(new THREE.Mesh(
            new THREE.SphereGeometry(0.13, 14, 12),
            crystal
        ));
        orb.position.y = 1.52;
        staff.add(orb);

        const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.18, 0.014, 6, 16),
            _own(_mat({
                color: 0xc084fc, metalness: 0.3, roughness: 0.2,
                emissive: 0x7c3aed, emissiveIntensity: 0.55,
                transparent: true, opacity: 0.85
            }))
        );
        halo.position.y = 1.52;
        halo.rotation.x = Math.PI / 2.4;
        staff.add(halo);

        const butt = _shadow(new THREE.Mesh(
            new THREE.ConeGeometry(0.04, 0.12, 6),
            gold
        ));
        butt.position.y = -0.42;
        staff.add(butt);

        // Pose na mão direita — cajado vertical, ligeiramente para fora do corpo
        // (braço local: y≈-1.05 = mão; +x afasta do torso; +z à frente)
        const basePos = { x: 0.10, y: -1.00, z: 0.14 };
        const baseRot = { x: -0.08, y: 0.05, z: -0.18 };
        staff.position.set(basePos.x, basePos.y, basePos.z);
        staff.rotation.set(baseRot.x, baseRot.y, baseRot.z);
        staff.userData.basePos = basePos;
        staff.userData.baseRot = baseRot;
        // Guarda emissive base para animação de ataque
        staff.traverse(o => {
            if (o.material && o.material.emissiveIntensity != null) {
                o.material.userData = o.material.userData || {};
                o.material.userData._baseEmi = o.material.emissiveIntensity;
            }
        });

        if (player.rightArm) player.rightArm.add(staff);
        else g.add(staff);
        player._mageStaff = staff;
    }

    function _setSwordVisible(player, visible) {
        if (!player || !player.sword) return;
        player.sword.visible = !!visible;
        player.sword.traverse(o => { if (o.isMesh) o.visible = !!visible; });
    }

    function _removeMageStaff(player) {
        if (!player) return;
        if (player._mageStaff) {
            if (player._mageStaff.parent) player._mageStaff.parent.remove(player._mageStaff);
            player._mageStaff.traverse(o => {
                if (o.geometry) o.geometry.dispose();
            });
            player._mageStaff = null;
        }
        // Limpa staff órfão no braço
        if (player.rightArm) {
            const rm = [];
            player.rightArm.traverse(o => { if (o.name === 'mage_staff') rm.push(o); });
            for (const o of rm) {
                if (o.parent) o.parent.remove(o);
            }
        }
    }

    function _buildExtras(player, extrasId) {
        _clearExtras(player);
        if (!player || !player.group) return;
        switch (extrasId) {
            case 'guerreiro': _buildGuerreiroExtras(player); break;
            case 'defensor': _buildDefensorExtras(player); break;
            case 'explorador': _buildExploradorExtras(player); break;
            case 'mago': _buildMagoExtras(player); break;
            default: break;
        }
    }

    function applySkinToPlayer(player, skinId) {
        if (!player) return false;
        const skin = getSkinById(skinId);
        // Remove cajado anterior se houver
        _removeMageStaff(player);
        _applyColors(player, skin.colors);
        _buildExtras(player, skin.extras);
        player.skinId = skin.id;
        player.skinName = skin.name;
        // Mago: sem espada, só cajado + magia
        const isMage = skin.id === 'mago';
        _setSwordVisible(player, !isMage);
        player.usesStaff = isMage;
        try {
            document.querySelectorAll('.hud-name').forEach(el => { el.textContent = skin.name; });
            document.querySelectorAll('.hud-class').forEach(el => { el.textContent = skin.title; });
        } catch (_) {}
        return true;
    }

    global.SKIN_CATALOG = SKIN_CATALOG;
    global.getSkinById = getSkinById;
    global.listSkins = listSkins;
    global.applySkinToPlayer = applySkinToPlayer;
})(typeof window !== 'undefined' ? window : globalThis);
