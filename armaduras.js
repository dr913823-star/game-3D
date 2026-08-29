/**
 * armaduras.js — Catálogo de armaduras e aplicação no jogador
 *
 * API:
 *   ARMOR_CATALOG
 *   getArmorById(id)
 *   getShopArmors()
 *   applyArmorToPlayer(player, armorId)
 */
(function (global) {
    'use strict';

    const ARMOR_CATALOG = [
        {
            id: 'armor_cloth',
            name: 'Túnica de Pano',
            desc: 'Roupa leve de viajante. HP 100 · Defesa 0%.',
            icon: 'fa-shirt',
            price: 0,
            maxHp: 100,
            defense: 0,
            rarity: 'common',
            colors: { armor: 0x4a6fa5, armorDark: 0x2d4a6f, cloth: 0x2d4a6f }
        },
        {
            id: 'armor_leather',
            name: 'Couraça de Couro',
            desc: 'Couro curtido reforçado. HP 120 · Defesa 8%.',
            icon: 'fa-shirt',
            price: 70,
            maxHp: 120,
            defense: 0.08,
            rarity: 'common',
            colors: { armor: 0x8b5a2b, armorDark: 0x5c3d1e, cloth: 0x6b4423 }
        },
        {
            id: 'armor_studded',
            name: 'Couraça Cravejada',
            desc: 'Couro com tachas de ferro. HP 130 · Defesa 12%.',
            icon: 'fa-shield',
            price: 100,
            maxHp: 130,
            defense: 0.12,
            rarity: 'common',
            colors: { armor: 0x78716c, armorDark: 0x44403c, cloth: 0x57534e }
        },
        {
            id: 'armor_chain',
            name: 'Cota de Malha',
            desc: 'Anéis de ferro entrelaçados. HP 140 · Defesa 15%.',
            icon: 'fa-link',
            price: 130,
            maxHp: 140,
            defense: 0.15,
            rarity: 'uncommon',
            colors: { armor: 0x9ca3af, armorDark: 0x6b7280, cloth: 0x4b5563 }
        },
        {
            id: 'armor_iron',
            name: 'Armadura de Ferro',
            desc: 'Placas sólidas de ferro. HP 160 · Defesa 22%.',
            icon: 'fa-shield-halved',
            price: 200,
            maxHp: 160,
            defense: 0.22,
            rarity: 'uncommon',
            colors: { armor: 0xcbd5e1, armorDark: 0x64748b, cloth: 0x475569 }
        },
        {
            id: 'armor_scale',
            name: 'Armadura de Escamas',
            desc: 'Escamas de aço sobrepostas. HP 170 · Defesa 26%.',
            icon: 'fa-fish',
            price: 250,
            maxHp: 170,
            defense: 0.26,
            rarity: 'uncommon',
            colors: { armor: 0x64748b, armorDark: 0x334155, cloth: 0x1e293b, gold: 0x94a3b8 }
        },
        {
            id: 'armor_knight',
            name: 'Armadura de Cavaleiro',
            desc: 'Aço polido real. HP 185 · Defesa 30%.',
            icon: 'fa-shield',
            price: 300,
            maxHp: 185,
            defense: 0.30,
            rarity: 'rare',
            colors: { armor: 0xe2e8f0, armorDark: 0x94a3b8, cloth: 0x1e3a8a, gold: 0xfbbf24 }
        },
        {
            id: 'armor_ranger',
            name: 'Traje do Guardião',
            desc: 'Couro élfico leve e resistente. HP 175 · Defesa 28%.',
            icon: 'fa-leaf',
            price: 280,
            maxHp: 175,
            defense: 0.28,
            rarity: 'rare',
            colors: { armor: 0x166534, armorDark: 0x14532d, cloth: 0x3f6212, gold: 0xa3e635 }
        },
        {
            id: 'armor_dragon',
            name: 'Escama de Dragão',
            desc: 'Escamas rubras de dragão. HP 210 · Defesa 38%.',
            icon: 'fa-dragon',
            price: 420,
            maxHp: 210,
            defense: 0.38,
            rarity: 'epic',
            colors: { armor: 0xb91c1c, armorDark: 0x7f1d1d, cloth: 0x450a0a, gold: 0xf59e0b }
        },
        {
            id: 'armor_shadow',
            name: 'Manto das Sombras',
            desc: 'Tecido umbral e placas negras. HP 200 · Defesa 35%.',
            icon: 'fa-moon',
            price: 400,
            maxHp: 200,
            defense: 0.35,
            rarity: 'epic',
            colors: { armor: 0x312e81, armorDark: 0x1e1b4b, cloth: 0x0f172a, gold: 0x6366f1 }
        },
        {
            id: 'armor_frost',
            name: 'Couraça Gélida',
            desc: 'Placas de gelo eterno. HP 220 · Defesa 40%.',
            icon: 'fa-snowflake',
            price: 480,
            maxHp: 220,
            defense: 0.40,
            rarity: 'epic',
            colors: { armor: 0x7dd3fc, armorDark: 0x0284c7, cloth: 0x0c4a6e, gold: 0xe0f2fe }
        },
        {
            id: 'armor_crystal',
            name: 'Couraça de Cristal',
            desc: 'Cristal vivo que pulsa magia. HP 240 · Defesa 45%.',
            icon: 'fa-gem',
            price: 550,
            maxHp: 240,
            defense: 0.45,
            rarity: 'legendary',
            colors: { armor: 0x22d3ee, armorDark: 0x0891b2, cloth: 0x164e63, gold: 0xa78bfa }
        },
        {
            id: 'armor_phoenix',
            name: 'Armadura da Fênix',
            desc: 'Penas e placas flamejantes. HP 260 · Defesa 48%.',
            icon: 'fa-fire',
            price: 620,
            maxHp: 260,
            defense: 0.48,
            rarity: 'legendary',
            colors: { armor: 0xf97316, armorDark: 0x9a3412, cloth: 0x431407, gold: 0xfbbf24 }
        }
    ];

    const RARITY_COLOR = {
        common: '#94a3b8',
        uncommon: '#22c55e',
        rare: '#3b82f6',
        epic: '#a855f7',
        legendary: '#f59e0b'
    };

    function getArmorById(id) {
        return ARMOR_CATALOG.find(a => a.id === id) || ARMOR_CATALOG[0];
    }

    function getShopArmors() {
        return ARMOR_CATALOG.filter(a => a.price > 0).map(a => ({
            id: a.id,
            name: a.name,
            desc: a.desc,
            icon: a.icon,
            price: a.price,
            type: 'armor',
            armorId: a.id,
            maxHp: a.maxHp,
            defense: a.defense,
            rarity: a.rarity,
            rarityColor: RARITY_COLOR[a.rarity] || '#94a3b8'
        }));
    }

    /**
     * Aplica armadura: cores do mesh + maxHp + defesa
     */
    function applyArmorToPlayer(player, armorId) {
        if (!player) return null;
        const def = getArmorById(armorId);
        if (!def) return null;

        const c = def.colors || {};
        if (player.mats) {
            if (c.armor != null && player.mats.armor) player.mats.armor.color.setHex(c.armor);
            if (c.armorDark != null && player.mats.armorDark) player.mats.armorDark.color.setHex(c.armorDark);
            if (c.cloth != null && player.mats.cloth) player.mats.cloth.color.setHex(c.cloth);
            if (c.cloth != null && player.mats.clothDark) player.mats.clothDark.color.setHex(c.cloth);
            if (c.gold != null && player.mats.gold) player.mats.gold.color.setHex(c.gold);

            // Brilho em armaduras especiais
            if (def.rarity === 'legendary' || def.rarity === 'epic') {
                if (player.mats.armor) {
                    player.mats.armor.emissive.setHex(c.armor || 0x000000);
                    player.mats.armor.emissiveIntensity = 0.18;
                }
                if (player.mats.armorDark) {
                    player.mats.armorDark.emissive.setHex(c.armorDark || 0x000000);
                    player.mats.armorDark.emissiveIntensity = 0.10;
                }
            } else {
                if (player.mats.armor) {
                    player.mats.armor.emissive.setHex(0x000000);
                    player.mats.armor.emissiveIntensity = 0;
                }
                if (player.mats.armorDark) {
                    player.mats.armorDark.emissive.setHex(0x000000);
                    player.mats.armorDark.emissiveIntensity = 0;
                }
            }
        }

        // HP: mantém proporção atual
        const oldMax = player.maxHp || 100;
        const ratio = oldMax > 0 ? (player.hp || oldMax) / oldMax : 1;
        player.maxHp = def.maxHp;
        player.hp = Math.min(def.maxHp, Math.max(1, Math.round(def.maxHp * ratio)));
        player.defense = def.defense || 0;
        player.armorId = def.id;

        return def;
    }

    global.ARMOR_CATALOG = ARMOR_CATALOG;
    global.getArmorById = getArmorById;
    global.getShopArmors = getShopArmors;
    global.applyArmorToPlayer = applyArmorToPlayer;
    global.ARMOR_RARITY_COLOR = RARITY_COLOR;

})(typeof window !== 'undefined' ? window : globalThis);
