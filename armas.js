/**
 * armas.js — Catálogo de armas, categorias e meshes 3D
 *
 * API:
 *   WEAPON_CATALOG          — lista completa de armas
 *   getWeaponById(id)
 *   createWeaponMesh(def)   — Group THREE da arma (eixo principal +Y)
 *   applyWeaponToPlayer(player, weaponId)
 *   getShopWeapons()
 *   WEAPON_CATEGORIES
 *   WEAPON_RARITY_COLOR
 */
(function (global) {
    'use strict';

    const RARITY_COLOR = {
        common: '#94a3b8',
        uncommon: '#22c55e',
        rare: '#3b82f6',
        epic: '#a855f7',
        legendary: '#f59e0b'
    };

    /** Categorias com defaults de combate e pose */
    const WEAPON_CATEGORIES = {
        sword: {
            label: 'Espada',
            icon: 'fa-khanda',
            defaultDuration: 0.38,
            defaultRange: 3.7,
            hold: { pos: [0.05, -1.0, 0.12], rot: [Math.PI / 2.8, 0, -0.15], scale: 1 }
        },
        greatsword: {
            label: 'Espada Grande',
            icon: 'fa-khanda',
            defaultDuration: 0.52,
            defaultRange: 4.4,
            hold: { pos: [0.06, -1.15, 0.14], rot: [Math.PI / 2.6, 0, -0.12], scale: 1.15 }
        },
        axe: {
            label: 'Machado',
            icon: 'fa-axe',
            defaultDuration: 0.48,
            defaultRange: 3.5,
            hold: { pos: [0.04, -0.95, 0.10], rot: [Math.PI / 2.5, 0.1, -0.2], scale: 1 }
        },
        hammer: {
            label: 'Martelo',
            icon: 'fa-hammer',
            defaultDuration: 0.58,
            defaultRange: 3.3,
            hold: { pos: [0.05, -0.9, 0.08], rot: [Math.PI / 2.4, 0, -0.1], scale: 1 }
        },
        mace: {
            label: 'Maça',
            icon: 'fa-gavel',
            defaultDuration: 0.45,
            defaultRange: 3.4,
            hold: { pos: [0.05, -0.92, 0.10], rot: [Math.PI / 2.5, 0, -0.12], scale: 1 }
        },
        spear: {
            label: 'Lança',
            icon: 'fa-staff',
            defaultDuration: 0.36,
            defaultRange: 4.8,
            hold: { pos: [0.02, -0.7, 0.05], rot: [Math.PI / 2.2, 0, 0], scale: 1 }
        },
        dagger: {
            label: 'Adaga',
            icon: 'fa-knife',
            defaultDuration: 0.22,
            defaultRange: 2.6,
            hold: { pos: [0.06, -0.55, 0.14], rot: [Math.PI / 2.5, 0, -0.25], scale: 0.85 }
        },
        magical: {
            label: 'Arma Mágica',
            icon: 'fa-wand-magic-sparkles',
            defaultDuration: 0.40,
            defaultRange: 4.0,
            hold: { pos: [0.05, -1.0, 0.12], rot: [Math.PI / 2.8, 0, -0.15], scale: 1 }
        }
    };

    /**
     * Catálogo completo. IDs existentes preservados.
     * category, attackDuration, type extras são novos e opcionais.
     */
    const WEAPON_CATALOG = [
        // ── ESPADAS BÁSICAS / PROGRESSÃO (IDs legados mantidos) ──
        {
            id: 'sword_iron',
            name: 'Espada de Ferro',
            desc: 'Lâmina básica e resistente. Tipo: Espada · Dano 22 · Alcance médio · Velocidade média.',
            icon: 'fa-khanda',
            price: 0,
            damage: 22,
            range: 3.6,
            attackDuration: 0.38,
            rarity: 'common',
            category: 'sword',
            style: 'iron'
        },
        {
            id: 'sword_steel',
            name: 'Espada de Aço',
            desc: 'Aço temperado. Tipo: Espada · Dano 32 · Alcance médio · Velocidade média.',
            icon: 'fa-khanda',
            price: 90,
            damage: 32,
            range: 3.8,
            attackDuration: 0.37,
            rarity: 'uncommon',
            category: 'sword',
            style: 'steel'
        },
        {
            id: 'sword_knight',
            name: 'Espada do Cavaleiro',
            desc: 'Lâmina longa de elite. Tipo: Espada · Dano 42 · Alcance médio-longo · Velocidade média.',
            icon: 'fa-chess-knight',
            price: 160,
            damage: 42,
            range: 4.0,
            attackDuration: 0.39,
            rarity: 'rare',
            category: 'sword',
            style: 'knight'
        },
        {
            id: 'sword_flame',
            name: 'Lâmina Flamejante',
            desc: 'Fogo na borda. Tipo: Espada Mágica · Dano 55 · Alcance médio-longo · Velocidade média.',
            icon: 'fa-fire',
            price: 260,
            damage: 55,
            range: 4.1,
            attackDuration: 0.40,
            rarity: 'epic',
            category: 'magical',
            style: 'flame'
        },
        {
            id: 'sword_shadow',
            name: 'Gume das Sombras',
            desc: 'Aço negro. Tipo: Espada · Dano 68 · Alcance longo · Velocidade média.',
            icon: 'fa-moon',
            price: 380,
            damage: 68,
            range: 4.3,
            attackDuration: 0.38,
            rarity: 'legendary',
            category: 'sword',
            style: 'shadow'
        },
        {
            id: 'sword_crystal',
            name: 'Espada de Cristal',
            desc: 'Cristal místico. Tipo: Espada Mágica · Dano 80 · Alcance longo · Velocidade média.',
            icon: 'fa-gem',
            price: 520,
            damage: 80,
            range: 4.5,
            attackDuration: 0.40,
            rarity: 'legendary',
            category: 'magical',
            style: 'crystal'
        },

        // ── ESPADAS ADICIONAIS ──
        {
            id: 'sword_rusty',
            name: 'Espada Enferrujada',
            desc: 'Velha e desgastada, mas ainda corta. Tipo: Espada · Dano 16 · Alcance curto-médio.',
            icon: 'fa-khanda',
            price: 15,
            damage: 16,
            range: 3.4,
            attackDuration: 0.40,
            rarity: 'common',
            category: 'sword',
            style: 'rusty'
        },
        {
            id: 'sword_reinforced',
            name: 'Espada de Aço Reforçado',
            desc: 'Aço reforçado com nervuras. Tipo: Espada · Dano 48 · Alcance médio.',
            icon: 'fa-khanda',
            price: 210,
            damage: 48,
            range: 3.9,
            attackDuration: 0.38,
            rarity: 'rare',
            category: 'sword',
            style: 'steel'
        },
        {
            id: 'sword_elite_knight',
            name: 'Espada do Cavaleiro de Elite',
            desc: 'Forjada para a guarda real. Tipo: Espada · Dano 58 · Alcance médio-longo.',
            icon: 'fa-chess-knight',
            price: 320,
            damage: 58,
            range: 4.15,
            attackDuration: 0.37,
            rarity: 'epic',
            category: 'sword',
            style: 'knight'
        },
        {
            id: 'sword_royal',
            name: 'Espada da Guarda Real',
            desc: 'Símbolo de autoridade e poder. Tipo: Espada · Dano 72 · Alcance longo.',
            icon: 'fa-crown',
            price: 450,
            damage: 72,
            range: 4.35,
            attackDuration: 0.36,
            rarity: 'legendary',
            category: 'sword',
            style: 'royal'
        },

        // ── GREATSWORDS ──
        {
            id: 'greatsword_iron',
            name: 'Espada Grande de Ferro',
            desc: 'Duas mãos. Alto dano, mais lenta. Tipo: Espada Grande · Dano 38 · Alcance longo · Lenta.',
            icon: 'fa-khanda',
            price: 140,
            damage: 38,
            range: 4.3,
            attackDuration: 0.55,
            rarity: 'uncommon',
            category: 'greatsword',
            style: 'iron'
        },
        {
            id: 'greatsword_steel',
            name: 'Espada Grande de Aço',
            desc: 'Lâmina massiva de aço. Tipo: Espada Grande · Dano 52 · Alcance longo · Lenta.',
            icon: 'fa-khanda',
            price: 240,
            damage: 52,
            range: 4.5,
            attackDuration: 0.52,
            rarity: 'rare',
            category: 'greatsword',
            style: 'steel'
        },
        {
            id: 'greatsword_crystal',
            name: 'Espada Grande de Cristal',
            desc: 'Lâmina cristalina lendária. Tipo: Espada Grande · Dano 88 · Alcance muito longo · Lenta.',
            icon: 'fa-gem',
            price: 580,
            damage: 88,
            range: 4.9,
            attackDuration: 0.54,
            rarity: 'legendary',
            category: 'greatsword',
            style: 'crystal'
        },

        // ── MACHADOS ──
        {
            id: 'axe_woodcutter',
            name: 'Machado de Lenhador',
            desc: 'Ferramenta adaptada ao combate. Tipo: Machado · Dano 20 · Alcance médio · Médio-lento.',
            icon: 'fa-axe',
            price: 35,
            damage: 20,
            range: 3.3,
            attackDuration: 0.46,
            rarity: 'common',
            category: 'axe',
            style: 'wood'
        },
        {
            id: 'axe_iron',
            name: 'Machado de Ferro',
            desc: 'Cabeça pesada de ferro. Tipo: Machado · Dano 30 · Alcance médio · Médio-lento.',
            icon: 'fa-axe',
            price: 85,
            damage: 30,
            range: 3.5,
            attackDuration: 0.48,
            rarity: 'common',
            category: 'axe',
            style: 'iron'
        },
        {
            id: 'axe_steel',
            name: 'Machado de Batalha de Aço',
            desc: 'Machado de guerra temperado. Tipo: Machado · Dano 45 · Alcance médio · Médio-lento.',
            icon: 'fa-axe',
            price: 175,
            damage: 45,
            range: 3.6,
            attackDuration: 0.47,
            rarity: 'uncommon',
            category: 'axe',
            style: 'steel'
        },
        {
            id: 'axe_reinforced',
            name: 'Machado de Batalha Reforçado',
            desc: 'Reforçado para impacto brutal. Tipo: Machado · Dano 58 · Alcance médio.',
            icon: 'fa-axe',
            price: 280,
            damage: 58,
            range: 3.7,
            attackDuration: 0.50,
            rarity: 'rare',
            category: 'axe',
            style: 'steel'
        },
        {
            id: 'axe_berserker',
            name: 'Machado do Berserker',
            desc: 'Fúria em forma de lâmina. Tipo: Machado · Dano 70 · Alcance médio · Lento.',
            icon: 'fa-axe',
            price: 390,
            damage: 70,
            range: 3.8,
            attackDuration: 0.52,
            rarity: 'epic',
            category: 'axe',
            style: 'berserker'
        },
        {
            id: 'axe_flame',
            name: 'Machado Flamejante',
            desc: 'Fogo e aço unidos. Tipo: Machado Mágico · Dano 78 · Alcance médio.',
            icon: 'fa-fire',
            price: 480,
            damage: 78,
            range: 3.9,
            attackDuration: 0.50,
            rarity: 'legendary',
            category: 'axe',
            style: 'flame'
        },
        {
            id: 'axe_inferno',
            name: 'Machado Infernal Lendário',
            desc: 'Chamas eternas. Tipo: Machado Lendário · Dano 92 · Alcance médio-longo.',
            icon: 'fa-fire',
            price: 620,
            damage: 92,
            range: 4.1,
            attackDuration: 0.53,
            rarity: 'legendary',
            category: 'axe',
            style: 'inferno'
        },

        // ── MARTELOS ──
        {
            id: 'hammer_training',
            name: 'Martelo de Treino',
            desc: 'Pesado e lento, ideal para aprender. Tipo: Martelo · Dano 24 · Alcance curto-médio · Muito lento.',
            icon: 'fa-hammer',
            price: 40,
            damage: 24,
            range: 3.1,
            attackDuration: 0.58,
            rarity: 'common',
            category: 'hammer',
            style: 'wood'
        },
        {
            id: 'hammer_iron',
            name: 'Martelo de Guerra de Ferro',
            desc: 'Impacto devastador. Tipo: Martelo · Dano 40 · Alcance médio · Muito lento.',
            icon: 'fa-hammer',
            price: 120,
            damage: 40,
            range: 3.3,
            attackDuration: 0.60,
            rarity: 'uncommon',
            category: 'hammer',
            style: 'iron'
        },
        {
            id: 'hammer_steel',
            name: 'Martelo de Guerra de Aço',
            desc: 'Aço maciço. Tipo: Martelo · Dano 55 · Alcance médio · Muito lento.',
            icon: 'fa-hammer',
            price: 220,
            damage: 55,
            range: 3.4,
            attackDuration: 0.58,
            rarity: 'rare',
            category: 'hammer',
            style: 'steel'
        },
        {
            id: 'hammer_reinforced',
            name: 'Martelo de Guerra Reforçado',
            desc: 'Reforçado com placas. Tipo: Martelo · Dano 68 · Alcance médio.',
            icon: 'fa-hammer',
            price: 340,
            damage: 68,
            range: 3.5,
            attackDuration: 0.60,
            rarity: 'epic',
            category: 'hammer',
            style: 'steel'
        },
        {
            id: 'hammer_thunder',
            name: 'Martelo do Trovão',
            desc: 'Relâmpago no impacto. Tipo: Martelo Mágico · Dano 85 · Alcance médio · Muito lento.',
            icon: 'fa-bolt',
            price: 520,
            damage: 85,
            range: 3.6,
            attackDuration: 0.62,
            rarity: 'legendary',
            category: 'hammer',
            style: 'thunder'
        },
        {
            id: 'hammer_titan',
            name: 'Martelo Titã',
            desc: 'Força dos gigantes. Tipo: Martelo Lendário · Dano 98 · Alcance médio-longo.',
            icon: 'fa-hammer',
            price: 680,
            damage: 98,
            range: 3.8,
            attackDuration: 0.65,
            rarity: 'legendary',
            category: 'hammer',
            style: 'titan'
        },

        // ── MAÇAS ──
        {
            id: 'mace_iron',
            name: 'Maça de Ferro',
            desc: 'Cabeça redonda de ferro. Tipo: Maça · Dano 28 · Alcance médio · Médio.',
            icon: 'fa-gavel',
            price: 70,
            damage: 28,
            range: 3.3,
            attackDuration: 0.44,
            rarity: 'common',
            category: 'mace',
            style: 'iron'
        },
        {
            id: 'mace_spiked',
            name: 'Maça Espinhada',
            desc: 'Espinhos para perfurar. Tipo: Maça · Dano 38 · Alcance médio.',
            icon: 'fa-gavel',
            price: 130,
            damage: 38,
            range: 3.4,
            attackDuration: 0.45,
            rarity: 'uncommon',
            category: 'mace',
            style: 'spiked'
        },
        {
            id: 'mace_heavy',
            name: 'Maça Pesada Espinhada',
            desc: 'Impacto e perfuração. Tipo: Maça · Dano 52 · Alcance médio.',
            icon: 'fa-gavel',
            price: 250,
            damage: 52,
            range: 3.5,
            attackDuration: 0.48,
            rarity: 'rare',
            category: 'mace',
            style: 'spiked'
        },
        {
            id: 'mace_guardian',
            name: 'Maça do Guardião',
            desc: 'Arma defensiva e ofensiva. Tipo: Maça · Dano 64 · Alcance médio.',
            icon: 'fa-shield-halved',
            price: 360,
            damage: 64,
            range: 3.6,
            attackDuration: 0.46,
            rarity: 'epic',
            category: 'mace',
            style: 'guardian'
        },
        {
            id: 'mace_enchanted',
            name: 'Maça Encantada',
            desc: 'Energia mágica pulsante. Tipo: Maça Mágica · Dano 76 · Alcance médio.',
            icon: 'fa-wand-magic-sparkles',
            price: 470,
            damage: 76,
            range: 3.7,
            attackDuration: 0.45,
            rarity: 'legendary',
            category: 'mace',
            style: 'enchanted'
        },
        {
            id: 'mace_crystal',
            name: 'Maça de Cristal',
            desc: 'Cristal brilhante e duro. Tipo: Maça Lendária · Dano 90 · Alcance médio-longo.',
            icon: 'fa-gem',
            price: 600,
            damage: 90,
            range: 3.9,
            attackDuration: 0.47,
            rarity: 'legendary',
            category: 'mace',
            style: 'crystal'
        },

        // ── LANÇAS ──
        {
            id: 'spear_wooden',
            name: 'Lança de Madeira',
            desc: 'Haste longa e ponta afiada. Tipo: Lança · Dano 18 · Alcance longo · Rápida.',
            icon: 'fa-staff',
            price: 30,
            damage: 18,
            range: 4.5,
            attackDuration: 0.34,
            rarity: 'common',
            category: 'spear',
            style: 'wood'
        },
        {
            id: 'spear_iron',
            name: 'Lança de Ferro',
            desc: 'Ponta de ferro resistente. Tipo: Lança · Dano 28 · Alcance longo · Rápida.',
            icon: 'fa-staff',
            price: 80,
            damage: 28,
            range: 4.7,
            attackDuration: 0.35,
            rarity: 'common',
            category: 'spear',
            style: 'iron'
        },
        {
            id: 'spear_steel',
            name: 'Lança de Aço',
            desc: 'Haste metálica e ponta afiada. Tipo: Lança · Dano 40 · Alcance muito longo.',
            icon: 'fa-staff',
            price: 160,
            damage: 40,
            range: 5.0,
            attackDuration: 0.36,
            rarity: 'uncommon',
            category: 'spear',
            style: 'steel'
        },
        {
            id: 'spear_elite',
            name: 'Lança do Cavaleiro de Elite',
            desc: 'Lança de formação real. Tipo: Lança · Dano 54 · Alcance muito longo.',
            icon: 'fa-staff',
            price: 290,
            damage: 54,
            range: 5.2,
            attackDuration: 0.35,
            rarity: 'rare',
            category: 'spear',
            style: 'knight'
        },
        {
            id: 'spear_crystal',
            name: 'Lança de Cristal',
            desc: 'Ponta cristalina brilhante. Tipo: Lança Mágica · Dano 68 · Alcance extremo.',
            icon: 'fa-gem',
            price: 420,
            damage: 68,
            range: 5.4,
            attackDuration: 0.36,
            rarity: 'epic',
            category: 'spear',
            style: 'crystal'
        },
        {
            id: 'spear_dragon',
            name: 'Lança do Dragão',
            desc: 'Inspirada em dragões antigos. Tipo: Lança Lendária · Dano 84 · Alcance extremo.',
            icon: 'fa-dragon',
            price: 560,
            damage: 84,
            range: 5.6,
            attackDuration: 0.38,
            rarity: 'legendary',
            category: 'spear',
            style: 'dragon'
        },

        // ── ADAGAS ──
        {
            id: 'dagger_iron',
            name: 'Adaga de Ferro',
            desc: 'Pequena e rápida. Tipo: Adaga · Dano 14 · Alcance curto · Muito rápida.',
            icon: 'fa-knife',
            price: 25,
            damage: 14,
            range: 2.5,
            attackDuration: 0.22,
            rarity: 'common',
            category: 'dagger',
            style: 'iron'
        },
        {
            id: 'dagger_hunter',
            name: 'Adaga do Caçador',
            desc: 'Perfeita para golpes rápidos. Tipo: Adaga · Dano 20 · Alcance curto · Muito rápida.',
            icon: 'fa-knife',
            price: 65,
            damage: 20,
            range: 2.6,
            attackDuration: 0.20,
            rarity: 'common',
            category: 'dagger',
            style: 'steel'
        },
        {
            id: 'dagger_assassin',
            name: 'Adaga do Assassino',
            desc: 'Silenciosa e letal. Tipo: Adaga · Dano 30 · Alcance curto · Extremamente rápida.',
            icon: 'fa-knife',
            price: 145,
            damage: 30,
            range: 2.7,
            attackDuration: 0.18,
            rarity: 'uncommon',
            category: 'dagger',
            style: 'shadow'
        },
        {
            id: 'dagger_elite',
            name: 'Adaga de Elite do Assassino',
            desc: 'Aço negro afiado. Tipo: Adaga · Dano 42 · Alcance curto · Extremamente rápida.',
            icon: 'fa-knife',
            price: 270,
            damage: 42,
            range: 2.8,
            attackDuration: 0.17,
            rarity: 'rare',
            category: 'dagger',
            style: 'shadow'
        },
        {
            id: 'dagger_shadow',
            name: 'Adaga das Sombras',
            desc: 'Energia sombria. Tipo: Adaga Mágica · Dano 55 · Alcance curto · Extremamente rápida.',
            icon: 'fa-moon',
            price: 400,
            damage: 55,
            range: 2.9,
            attackDuration: 0.16,
            rarity: 'epic',
            category: 'dagger',
            style: 'shadow'
        },
        {
            id: 'dagger_phantom',
            name: 'Lâmina Fantasma',
            desc: 'Quase invisível no golpe. Tipo: Adaga Lendária · Dano 68 · Alcance curto · Instantânea.',
            icon: 'fa-ghost',
            price: 540,
            damage: 68,
            range: 3.0,
            attackDuration: 0.15,
            rarity: 'legendary',
            category: 'dagger',
            style: 'phantom'
        },
        {
            id: 'dagger_crystal',
            name: 'Adaga de Cristal',
            desc: 'Cristal cortante e brilhante. Tipo: Adaga Lendária · Dano 62 · Alcance curto · Muito rápida.',
            icon: 'fa-gem',
            price: 500,
            damage: 62,
            range: 2.85,
            attackDuration: 0.17,
            rarity: 'legendary',
            category: 'dagger',
            style: 'crystal'
        },

        // ── EXPLORADOR (exclusivas / temáticas) ──
        {
            id: 'explorer_short_sword',
            name: 'Espada Curta do Explorador',
            desc: 'Leve e equilibrada para aventuras. Tipo: Espada · Dano 34 · Alcance médio · Rápida. (Explorador)',
            icon: 'fa-compass',
            price: 150,
            damage: 34,
            range: 3.5,
            attackDuration: 0.32,
            rarity: 'uncommon',
            category: 'sword',
            style: 'explorer',
            skinBonus: 'explorador'
        },
        {
            id: 'explorer_hunter_spear',
            name: 'Lança do Caçador',
            desc: 'Longa e ágil para exploração. Tipo: Lança · Dano 36 · Alcance muito longo · Rápida. (Explorador)',
            icon: 'fa-compass',
            price: 185,
            damage: 36,
            range: 5.1,
            attackDuration: 0.32,
            rarity: 'uncommon',
            category: 'spear',
            style: 'explorer',
            skinBonus: 'explorador'
        },
        {
            id: 'explorer_survival_axe',
            name: 'Machado de Sobrevivência',
            desc: 'Prático e balanceado. Tipo: Machado · Dano 42 · Alcance médio. (Explorador)',
            icon: 'fa-compass',
            price: 195,
            damage: 42,
            range: 3.5,
            attackDuration: 0.42,
            rarity: 'rare',
            category: 'axe',
            style: 'explorer',
            skinBonus: 'explorador'
        },
        {
            id: 'explorer_dagger',
            name: 'Adaga do Explorador',
            desc: 'Rápida e leve. Tipo: Adaga · Dano 26 · Alcance curto · Extremamente rápida. (Explorador)',
            icon: 'fa-compass',
            price: 120,
            damage: 26,
            range: 2.55,
            attackDuration: 0.18,
            rarity: 'uncommon',
            category: 'dagger',
            style: 'explorer',
            skinBonus: 'explorador'
        },
        {
            id: 'explorer_compass_blade',
            name: 'Lâmina da Bússola Ancestral',
            desc: 'Arma mágica de aventureiros lendários. Tipo: Espada Mágica · Dano 66 · Alcance médio · Rápida. (Explorador)',
            icon: 'fa-compass',
            price: 480,
            damage: 66,
            range: 3.9,
            attackDuration: 0.30,
            rarity: 'legendary',
            category: 'magical',
            style: 'compass',
            skinBonus: 'explorador'
        },

        // ── DEFENSOR (exclusivas / temáticas) ──
        {
            id: 'defender_sword',
            name: 'Espada do Defensor',
            desc: 'Forte e confiável. Tipo: Espada · Dano 40 · Alcance médio. (Defensor)',
            icon: 'fa-shield-halved',
            price: 170,
            damage: 40,
            range: 3.8,
            attackDuration: 0.40,
            rarity: 'uncommon',
            category: 'sword',
            style: 'defender',
            skinBonus: 'defensor'
        },
        {
            id: 'defender_mace',
            name: 'Maça do Guardião',
            desc: 'Contundente e defensiva. Tipo: Maça · Dano 48 · Alcance médio. (Defensor)',
            icon: 'fa-shield-halved',
            price: 200,
            damage: 48,
            range: 3.5,
            attackDuration: 0.46,
            rarity: 'rare',
            category: 'mace',
            style: 'defender',
            skinBonus: 'defensor'
        },
        {
            id: 'defender_war_hammer',
            name: 'Martelo de Guerra Pesado',
            desc: 'Lento mas devastador. Tipo: Martelo · Dano 62 · Alcance médio · Muito lento. (Defensor)',
            icon: 'fa-shield-halved',
            price: 310,
            damage: 62,
            range: 3.4,
            attackDuration: 0.58,
            rarity: 'rare',
            category: 'hammer',
            style: 'defender',
            skinBonus: 'defensor'
        },
        {
            id: 'defender_fortress_axe',
            name: 'Machado da Fortaleza',
            desc: 'Grande machado defensivo. Tipo: Machado · Dano 66 · Alcance médio. (Defensor)',
            icon: 'fa-shield-halved',
            price: 350,
            damage: 66,
            range: 3.7,
            attackDuration: 0.50,
            rarity: 'epic',
            category: 'axe',
            style: 'defender',
            skinBonus: 'defensor'
        },
        {
            id: 'defender_royal_greatsword',
            name: 'Espada Grande Real do Defensor',
            desc: 'Arma premium de combate poderoso. Tipo: Espada Grande · Dano 82 · Alcance longo · Lenta. (Defensor)',
            icon: 'fa-crown',
            price: 550,
            damage: 82,
            range: 4.6,
            attackDuration: 0.55,
            rarity: 'legendary',
            category: 'greatsword',
            style: 'royal',
            skinBonus: 'defensor'
        }
    ];

    function getWeaponById(id) {
        if (!id) return WEAPON_CATALOG[0];
        return WEAPON_CATALOG.find(w => w.id === id) || WEAPON_CATALOG[0];
    }

    function _mats(style) {
        const presets = {
            iron: { blade: 0xc0c8d0, guard: 0xd97706, hilt: 0x5c4033, emissive: 0x000000, emi: 0 },
            steel: { blade: 0xe2e8f0, guard: 0x94a3b8, hilt: 0x44403c, emissive: 0x000000, emi: 0 },
            knight: { blade: 0xf8fafc, guard: 0xfbbf24, hilt: 0x1e3a8a, emissive: 0x000000, emi: 0 },
            flame: { blade: 0xf97316, guard: 0x7c2d12, hilt: 0x292524, emissive: 0xff4500, emi: 0.45 },
            shadow: { blade: 0x1e1b4b, guard: 0x4c1d95, hilt: 0x0f172a, emissive: 0x6366f1, emi: 0.35 },
            crystal: { blade: 0x67e8f9, guard: 0xa78bfa, hilt: 0x312e81, emissive: 0x22d3ee, emi: 0.55 },
            rusty: { blade: 0xa16207, guard: 0x78350f, hilt: 0x44403c, emissive: 0x000000, emi: 0 },
            royal: { blade: 0xfef3c7, guard: 0xf59e0b, hilt: 0x1e3a8a, emissive: 0xfbbf24, emi: 0.2 },
            wood: { blade: 0x78716c, guard: 0x5c4033, hilt: 0x44403c, emissive: 0x000000, emi: 0 },
            berserker: { blade: 0xef4444, guard: 0x7f1d1d, hilt: 0x292524, emissive: 0xdc2626, emi: 0.25 },
            inferno: { blade: 0xff4500, guard: 0x7c2d12, hilt: 0x1c1917, emissive: 0xff6600, emi: 0.6 },
            thunder: { blade: 0x38bdf8, guard: 0x1e3a8a, hilt: 0x0f172a, emissive: 0x0ea5e9, emi: 0.5 },
            titan: { blade: 0xcbd5e1, guard: 0x64748b, hilt: 0x334155, emissive: 0x94a3b8, emi: 0.15 },
            spiked: { blade: 0xa1a1aa, guard: 0x52525b, hilt: 0x3f3f46, emissive: 0x000000, emi: 0 },
            guardian: { blade: 0x93c5fd, guard: 0x1d4ed8, hilt: 0x1e3a8a, emissive: 0x3b82f6, emi: 0.2 },
            enchanted: { blade: 0xc084fc, guard: 0x6b21a8, hilt: 0x3b0764, emissive: 0xa855f7, emi: 0.4 },
            dragon: { blade: 0xf97316, guard: 0x9a3412, hilt: 0x431407, emissive: 0xea580c, emi: 0.35 },
            phantom: { blade: 0xe0e7ff, guard: 0x6366f1, hilt: 0x312e81, emissive: 0xa5b4fc, emi: 0.45 },
            explorer: { blade: 0xd4a574, guard: 0x4ade80, hilt: 0x3f6212, emissive: 0x22c55e, emi: 0.12 },
            defender: { blade: 0xb0bec8, guard: 0x1d4ed8, hilt: 0x1e3a8a, emissive: 0x3b82f6, emi: 0.15 },
            compass: { blade: 0xfbbf24, guard: 0x065f46, hilt: 0x3f6212, emissive: 0xf59e0b, emi: 0.4 }
        };
        return presets[style] || presets.iron;
    }

    function _stdMats(c) {
        return {
            blade: new THREE.MeshStandardMaterial({
                color: c.blade, metalness: 0.85, roughness: 0.22,
                emissive: c.emissive, emissiveIntensity: c.emi
            }),
            guard: new THREE.MeshStandardMaterial({
                color: c.guard, metalness: 0.7, roughness: 0.35
            }),
            hilt: new THREE.MeshStandardMaterial({
                color: c.hilt, roughness: 0.85, metalness: 0.1
            })
        };
    }

    // ─── MESH BUILDERS ───────────────────────────────────────

    function _buildSwordMesh(def, c) {
        const mats = _stdMats(c);
        const group = new THREE.Group();
        const isGreat = def.category === 'greatsword';
        const bladeLen = isGreat ? 2.35 : (def.style === 'knight' || def.style === 'crystal' || def.style === 'royal' ? 1.95 : 1.7);
        const bladeW = isGreat ? 0.11 : 0.07;
        const bladeD = isGreat ? 0.28 : 0.2;

        const blade = new THREE.Mesh(new THREE.BoxGeometry(bladeW, bladeLen, bladeD), mats.blade);
        blade.position.y = 0.15 + bladeLen * 0.5;
        blade.castShadow = true;
        group.add(blade);

        const fuller = new THREE.Mesh(
            new THREE.BoxGeometry(bladeW * 0.3, bladeLen * 0.85, bladeD + 0.02),
            new THREE.MeshStandardMaterial({
                color: c.blade, metalness: 0.95, roughness: 0.15,
                emissive: c.emissive, emissiveIntensity: c.emi * 0.5
            })
        );
        fuller.position.y = blade.position.y;
        group.add(fuller);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(bladeD * 0.5, 0.32, 4), mats.blade);
        tip.position.y = 0.15 + bladeLen + 0.12;
        tip.rotation.y = Math.PI / 4;
        tip.castShadow = true;
        group.add(tip);

        const guardW = (def.style === 'shadow' || def.style === 'flame' || isGreat) ? 0.58 : 0.48;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(guardW, 0.09, 0.16), mats.guard);
        guard.position.y = 0.12;
        guard.castShadow = true;
        group.add(guard);

        for (const sx of [-1, 1]) {
            const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), mats.guard);
            wing.position.set(sx * guardW * 0.45, 0.14, 0);
            wing.rotation.z = sx * 0.4;
            group.add(wing);
        }

        const hiltH = isGreat ? 0.48 : 0.38;
        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, hiltH, 8), mats.hilt);
        hilt.position.y = -hiltH * 0.25;
        group.add(hilt);

        for (const yy of [-0.02, -0.14, -0.24]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 12), mats.guard);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = yy;
            group.add(ring);
        }

        const pommel = new THREE.Mesh(new THREE.SphereGeometry(isGreat ? 0.1 : 0.08, 10, 8), mats.guard);
        pommel.position.y = isGreat ? -0.4 : -0.32;
        group.add(pommel);

        if (c.emi > 0) {
            const aura = new THREE.Mesh(
                new THREE.BoxGeometry(bladeW + 0.05, bladeLen * 0.9, 0.05),
                new THREE.MeshStandardMaterial({
                    color: c.emissive, emissive: c.emissive, emissiveIntensity: 0.8,
                    transparent: true, opacity: 0.35, depthWrite: false
                })
            );
            aura.position.y = blade.position.y;
            group.add(aura);
            group.userData.aura = aura;
        }
        return group;
    }

    function _buildAxeMesh(def, c) {
        const mats = _stdMats(c);
        const group = new THREE.Group();
        const shaftLen = 1.55;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, shaftLen, 8), mats.hilt);
        shaft.position.y = shaftLen * 0.35;
        shaft.castShadow = true;
        group.add(shaft);

        // Axe head
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.35, 0.12),
            mats.blade
        );
        head.position.set(0.22, shaftLen * 0.85, 0);
        head.castShadow = true;
        group.add(head);

        // Blade curve (wedge)
        const blade = new THREE.Mesh(
            new THREE.ConeGeometry(0.22, 0.4, 4),
            mats.blade
        );
        blade.rotation.z = Math.PI / 2;
        blade.position.set(0.48, shaftLen * 0.85, 0);
        blade.castShadow = true;
        group.add(blade);

        // Spike opposite
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), mats.guard);
        spike.rotation.z = -Math.PI / 2;
        spike.position.set(-0.12, shaftLen * 0.85, 0);
        group.add(spike);

        // Top spike
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), mats.guard);
        top.position.set(0.05, shaftLen * 0.85 + 0.22, 0);
        group.add(top);

        // Pommel
        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.guard);
        pommel.position.y = -0.15;
        group.add(pommel);

        if (c.emi > 0) {
            const aura = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.3, 0.04),
                new THREE.MeshStandardMaterial({
                    color: c.emissive, emissive: c.emissive, emissiveIntensity: 0.7,
                    transparent: true, opacity: 0.3, depthWrite: false
                })
            );
            aura.position.copy(head.position);
            group.add(aura);
        }
        return group;
    }

    function _buildHammerMesh(def, c) {
        const mats = _stdMats(c);
        const group = new THREE.Group();
        const shaftLen = 1.4;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, shaftLen, 8), mats.hilt);
        shaft.position.y = shaftLen * 0.3;
        shaft.castShadow = true;
        group.add(shaft);

        // Heavy head
        const headW = def.style === 'titan' || def.style === 'thunder' ? 0.55 : 0.42;
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(headW, 0.32, 0.32),
            mats.blade
        );
        head.position.set(0, shaftLen * 0.85, 0);
        head.castShadow = true;
        group.add(head);

        // Faces
        for (const sx of [-1, 1]) {
            const face = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.28, 0.28),
                mats.guard
            );
            face.position.set(sx * (headW * 0.5 + 0.02), head.position.y, 0);
            group.add(face);
        }

        // Top spike / decorative
        if (def.style === 'thunder' || def.style === 'titan') {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 6), mats.guard);
            spike.position.set(0, head.position.y + 0.25, 0);
            group.add(spike);
        }

        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mats.guard);
        pommel.position.y = -0.18;
        group.add(pommel);

        if (c.emi > 0) {
            const aura = new THREE.Mesh(
                new THREE.BoxGeometry(headW * 0.9, 0.28, 0.04),
                new THREE.MeshStandardMaterial({
                    color: c.emissive, emissive: c.emissive, emissiveIntensity: 0.75,
                    transparent: true, opacity: 0.35, depthWrite: false
                })
            );
            aura.position.copy(head.position);
            group.add(aura);
        }
        return group;
    }

    function _buildMaceMesh(def, c) {
        const mats = _stdMats(c);
        const group = new THREE.Group();
        const shaftLen = 1.35;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, shaftLen, 8), mats.hilt);
        shaft.position.y = shaftLen * 0.3;
        shaft.castShadow = true;
        group.add(shaft);

        // Rounded head
        const headR = def.style === 'crystal' || def.style === 'enchanted' ? 0.22 : 0.18;
        const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), mats.blade);
        head.position.y = shaftLen * 0.85;
        head.castShadow = true;
        group.add(head);

        // Spikes
        if (def.style === 'spiked' || def.style === 'heavy' || def.id === 'mace_spiked' || def.id === 'mace_heavy') {
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const sp = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 5), mats.guard);
                sp.position.set(Math.cos(a) * headR * 0.85, head.position.y + Math.sin(a) * headR * 0.3, Math.sin(a) * headR * 0.85);
                sp.lookAt(head.position);
                group.add(sp);
            }
        }

        // Bands
        const band = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.95, 0.025, 6, 16), mats.guard);
        band.rotation.x = Math.PI / 2;
        band.position.y = head.position.y;
        group.add(band);

        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mats.guard);
        pommel.position.y = -0.16;
        group.add(pommel);

        if (c.emi > 0) {
            const aura = new THREE.Mesh(
                new THREE.SphereGeometry(headR * 1.15, 10, 8),
                new THREE.MeshStandardMaterial({
                    color: c.emissive, emissive: c.emissive, emissiveIntensity: 0.6,
                    transparent: true, opacity: 0.25, depthWrite: false
                })
            );
            aura.position.copy(head.position);
            group.add(aura);
        }
        return group;
    }

    function _buildSpearMesh(def, c) {
        const mats = _stdMats(c);
        const group = new THREE.Group();
        const shaftLen = 2.6;
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, shaftLen, 8), mats.hilt);
        shaft.position.y = shaftLen * 0.4;
        shaft.castShadow = true;
        group.add(shaft);

        // Tip
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 6), mats.blade);
        tip.position.y = shaftLen * 0.4 + shaftLen * 0.5 + 0.15;
        tip.castShadow = true;
        group.add(tip);

        // Crossguard near tip
        const cross = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.05), mats.guard);
        cross.position.y = tip.position.y - 0.28;
        group.add(cross);

        // Decorative bands
        for (const yy of [0.2, 0.5, 0.9]) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 10), mats.guard);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = yy;
            group.add(ring);
        }

        // Butt
        const butt = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), mats.guard);
        butt.rotation.x = Math.PI;
        butt.position.y = -0.1;
        group.add(butt);

        if (c.emi > 0) {
            const aura = new THREE.Mesh(
                new THREE.ConeGeometry(0.09, 0.4, 6),
                new THREE.MeshStandardMaterial({
                    color: c.emissive, emissive: c.emissive, emissiveIntensity: 0.7,
                    transparent: true, opacity: 0.35, depthWrite: false
                })
            );
            aura.position.copy(tip.position);
            group.add(aura);
        }
        return group;
    }

    function _buildDaggerMesh(def, c) {
        const mats = _stdMats(c);
        const group = new THREE.Group();
        const bladeLen = 0.75;

        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, bladeLen, 0.12), mats.blade);
        blade.position.y = 0.1 + bladeLen * 0.5;
        blade.castShadow = true;
        group.add(blade);

        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), mats.blade);
        tip.position.y = 0.1 + bladeLen + 0.06;
        tip.rotation.y = Math.PI / 4;
        group.add(tip);

        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.1), mats.guard);
        guard.position.y = 0.08;
        group.add(guard);

        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.28, 8), mats.hilt);
        hilt.position.y = -0.08;
        group.add(hilt);

        const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mats.guard);
        pommel.position.y = -0.24;
        group.add(pommel);

        if (c.emi > 0) {
            const aura = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, bladeLen * 0.85, 0.03),
                new THREE.MeshStandardMaterial({
                    color: c.emissive, emissive: c.emissive, emissiveIntensity: 0.7,
                    transparent: true, opacity: 0.35, depthWrite: false
                })
            );
            aura.position.y = blade.position.y;
            group.add(aura);
        }
        return group;
    }

    /**
     * Cria mesh da arma (grupo). Eixo principal ao longo de +Y.
     */
    function createWeaponMesh(defOrId) {
        const def = typeof defOrId === 'string' ? getWeaponById(defOrId) : (defOrId || getWeaponById('sword_iron'));
        const c = _mats(def.style || 'iron');
        let group;

        switch (def.category) {
            case 'axe':
                group = _buildAxeMesh(def, c);
                break;
            case 'hammer':
                group = _buildHammerMesh(def, c);
                break;
            case 'mace':
                group = _buildMaceMesh(def, c);
                break;
            case 'spear':
                group = _buildSpearMesh(def, c);
                break;
            case 'dagger':
                group = _buildDaggerMesh(def, c);
                break;
            case 'greatsword':
            case 'sword':
            case 'magical':
            default:
                group = _buildSwordMesh(def, c);
                break;
        }

        group.name = 'weapon_' + def.id;
        group.userData.weaponId = def.id;
        group.userData.weaponDef = def;
        return group;
    }

    /**
     * Equipa arma no jogador (troca mesh + stats).
     */
    function applyWeaponToPlayer(player, weaponId) {
        if (!player || typeof THREE === 'undefined') return null;
        const def = getWeaponById(weaponId);
        if (!def) return null;

        if (player.sword) {
            if (player.sword.parent) player.sword.parent.remove(player.sword);
            player.sword.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
                    else o.material.dispose();
                }
            });
        }

        const mesh = createWeaponMesh(def);
        const cat = WEAPON_CATEGORIES[def.category] || WEAPON_CATEGORIES.sword;
        const hold = cat.hold || WEAPON_CATEGORIES.sword.hold;

        mesh.position.set(hold.pos[0], hold.pos[1], hold.pos[2]);
        mesh.rotation.x = hold.rot[0];
        mesh.rotation.y = hold.rot[1] || 0;
        mesh.rotation.z = hold.rot[2];
        if (hold.scale && hold.scale !== 1) {
            mesh.scale.setScalar(hold.scale);
        }

        if (player.rightArm) player.rightArm.add(mesh);
        player.sword = mesh;
        player.weaponId = def.id;
        player.baseDamage = def.damage;
        player.attackRange = def.range != null ? def.range : (cat.defaultRange || 3.6);
        player.attackDuration = def.attackDuration != null ? def.attackDuration : (cat.defaultDuration || 0.38);

        if (player.usesStaff || player.skinId === 'mago') {
            mesh.visible = false;
            mesh.traverse(o => { if (o.isMesh) o.visible = false; });
        }

        return def;
    }

    /** Itens de arma para a loja do ferreiro (exceto a básica grátis) */
    function getShopWeapons() {
        return WEAPON_CATALOG.filter(w => w.price > 0).map(w => {
            const cat = WEAPON_CATEGORIES[w.category] || WEAPON_CATEGORIES.sword;
            return {
                id: w.id,
                name: w.name,
                desc: w.desc,
                icon: w.icon || cat.icon || 'fa-khanda',
                price: w.price,
                type: 'weapon',
                weaponId: w.id,
                damage: w.damage,
                range: w.range,
                attackDuration: w.attackDuration,
                rarity: w.rarity,
                rarityColor: RARITY_COLOR[w.rarity] || '#94a3b8',
                category: w.category,
                categoryLabel: cat.label
            };
        });
    }

    global.WEAPON_CATALOG = WEAPON_CATALOG;
    global.getWeaponById = getWeaponById;
    global.createWeaponMesh = createWeaponMesh;
    global.applyWeaponToPlayer = applyWeaponToPlayer;
    global.getShopWeapons = getShopWeapons;
    global.WEAPON_RARITY_COLOR = RARITY_COLOR;
    global.WEAPON_CATEGORIES = WEAPON_CATEGORIES;

})(typeof window !== 'undefined' ? window : globalThis);
