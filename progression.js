/**
 * progression.js — Sistema centralizado de progressão RPG
 * Level, XP, atributos, skill points, mana, skill tree data, spells.
 * Integra com Player existente sem duplicar estado.
 */
(function (global) {
    'use strict';

    const PROGRESSION = {
        maxLevel: 30,
        /** XP base para nível 2; depois multiplica por xpScale */
        baseXp: 100,
        xpScale: 1.42,

        /** Ganhos por nível (configurável) */
        levelGains: {
            maxHp: 20,
            damage: 3,
            defense: 0.02, // +2% (defense is 0-0.75 fraction)
            maxStamina: 8,
            maxMana: 12,
            skillPoints: 1,
            healOnLevel: true, // restaura HP/stamina/mana
            healPercent: 1.0
        },

        /** Tabela XP de inimigos (centralizada) */
        enemyXp: {
            goblin: 25,
            skeleton: 35,
            shadow: 60,
            orc: 90,
            dark_mage: 120,
            troll: 200,
            spider: 45,
            wolf: 30,
            bandit_archer: 40,
            bandit_swordsman: 50,
            cursed_knight: 350,
            mini_boss: 500,
            boss: 1000,
            dragon: 1500,
            sovereign: 2500
        },

        /** XP de missões por tipo */
        questXp: {
            simple: 100,
            exploration: 200,
            combat: 300,
            story: 500,
            boss: 1000
        },

        /** Raridades */
        rarities: {
            common:    { id: 'common',    label: 'Comum',      color: '#9ca3af', mult: 1.0,  chance: 0.55 },
            uncommon:  { id: 'uncommon',  label: 'Incomum',    color: '#22c55e', mult: 1.15, chance: 0.25 },
            rare:      { id: 'rare',      label: 'Raro',       color: '#3b82f6', mult: 1.35, chance: 0.12 },
            epic:      { id: 'epic',      label: 'Épico',      color: '#a855f7', mult: 1.6,  chance: 0.05 },
            legendary: { id: 'legendary', label: 'Lendário',   color: '#f59e0b', mult: 2.0,  chance: 0.025 },
            mythic:    { id: 'mythic',    label: 'Mítico',     color: '#ef4444', mult: 2.6,  chance: 0.005 }
        },

        /** Spells */
        spells: {
            fireball: {
                id: 'fireball',
                name: 'Bola de Fogo',
                icon: '🔥',
                key: 'Digit1',
                manaCost: 22,
                cooldown: 2.2,
                damage: 48,
                damageScale: 0.35, // +% magic power
                range: 28,
                desc: 'Lança um projétil de fogo no alvo.'
            },
            lightning: {
                id: 'lightning',
                name: 'Raio',
                icon: '⚡',
                key: 'Digit2',
                manaCost: 32,
                cooldown: 3.5,
                damage: 75,
                damageScale: 0.45,
                range: 22,
                desc: 'Raio instantâneo de alto dano.'
            },
            heal: {
                id: 'heal',
                name: 'Cura',
                icon: '❤️',
                key: 'Digit3',
                manaCost: 28,
                cooldown: 6.0,
                healAmount: 55,
                healScale: 0.4,
                desc: 'Restaura pontos de vida.'
            },
            shadow_explosion: {
                id: 'shadow_explosion',
                name: 'Explosão Sombria',
                icon: '🌑',
                key: 'Digit4',
                manaCost: 40,
                cooldown: 8.0,
                damage: 40,
                damageScale: 0.3,
                radius: 7,
                desc: 'Dano em área com partículas sombrias.'
            },
            magic_shield: {
                id: 'magic_shield',
                name: 'Escudo Mágico',
                icon: '🛡️',
                key: 'Digit5',
                manaCost: 30,
                cooldown: 12.0,
                duration: 6.0,
                damageReduction: 0.4,
                desc: 'Reduz dano recebido temporariamente.'
            },
            summon_golem: {
                id: 'summon_golem',
                name: 'Invocar Golem',
                icon: '🪨',
                key: 'Digit6',
                manaCost: 45,
                cooldown: 20.0,
                duration: 45,
                desc: 'Invoca um golem de pedra que luta ao seu lado.'
            }
        },

        /** Skill tree — 4 ramos */
        skillTree: {
            warrior: {
                id: 'warrior',
                name: 'Guerreiro',
                icon: '⚔️',
                skills: [
                    { id: 'w_dmg1', name: '+5% Dano', levelReq: 2, cost: 1, prereq: null, effect: { damagePct: 0.05 }, desc: 'Aumenta dano físico em 5%.' },
                    { id: 'w_crit1', name: '+5% Crítico', levelReq: 3, cost: 1, prereq: 'w_dmg1', effect: { critChance: 0.05 }, desc: 'Chance de acerto crítico +5%.' },
                    { id: 'w_heavy', name: 'Ataque Pesado', levelReq: 5, cost: 2, prereq: 'w_crit1', effect: { heavyAttack: true, damagePct: 0.08 }, desc: 'Ataques ocasionais causam +30% dano.' },
                    { id: 'w_armorbreak', name: 'Quebra-Armadura', levelReq: 8, cost: 2, prereq: 'w_heavy', effect: { armorBreak: 0.15 }, desc: 'Ignora 15% da defesa inimiga.' },
                    { id: 'w_berserker', name: 'Berserker', levelReq: 12, cost: 3, prereq: 'w_armorbreak', effect: { lowHpDmg: 0.25 }, desc: 'Abaixo de 40% HP: +25% dano.' },
                    { id: 'w_ultimate', name: 'Guerreiro Supremo', levelReq: 18, cost: 4, prereq: 'w_berserker', effect: { damagePct: 0.15, attackSpeed: 0.1 }, desc: '+15% dano e +10% velocidade de ataque.' }
                ]
            },
            defender: {
                id: 'defender',
                name: 'Defensor',
                icon: '🛡️',
                skills: [
                    { id: 'd_def1', name: '+5% Defesa', levelReq: 2, cost: 1, prereq: null, effect: { defensePct: 0.05 }, desc: 'Defesa +5%.' },
                    { id: 'd_hp1', name: '+Max HP', levelReq: 3, cost: 1, prereq: 'd_def1', effect: { maxHpFlat: 40 }, desc: '+40 HP máximo.' },
                    { id: 'd_reduce', name: 'Redução de Dano', levelReq: 5, cost: 2, prereq: 'd_hp1', effect: { dmgReduction: 0.08 }, desc: 'Reduz todo dano em 8%.' },
                    { id: 'd_shield', name: 'Maestria de Escudo', levelReq: 8, cost: 2, prereq: 'd_reduce', effect: { defensePct: 0.1 }, desc: '+10% defesa adicional.' },
                    { id: 'd_regen', name: 'Regeneração', levelReq: 12, cost: 3, prereq: 'd_shield', effect: { hpRegen: 2.5 }, desc: 'Regenera 2.5 HP/s fora de combate.' },
                    { id: 'd_guardian', name: 'Guardião', levelReq: 18, cost: 4, prereq: 'd_regen', effect: { maxHpFlat: 80, dmgReduction: 0.1 }, desc: '+80 HP e +10% redução de dano.' }
                ]
            },
            explorer: {
                id: 'explorer',
                name: 'Explorador',
                icon: '🏃',
                skills: [
                    { id: 'e_speed1', name: '+Velocidade', levelReq: 2, cost: 1, prereq: null, effect: { moveSpeedPct: 0.06 }, desc: '+6% velocidade de movimento.' },
                    { id: 'e_stamina1', name: 'Eficiência de Sprint', levelReq: 3, cost: 1, prereq: 'e_speed1', effect: { staminaCostPct: -0.15 }, desc: 'Sprint consome 15% menos stamina.' },
                    { id: 'e_regen', name: 'Regen Stamina', levelReq: 5, cost: 2, prereq: 'e_stamina1', effect: { staminaRegenPct: 0.2 }, desc: '+20% regeneração de stamina.' },
                    { id: 'e_jump', name: 'Salto Melhorado', levelReq: 7, cost: 2, prereq: 'e_regen', effect: { jumpForcePct: 0.12 }, desc: '+12% força de salto.' },
                    { id: 'e_dodge', name: 'Esquiva', levelReq: 10, cost: 2, prereq: 'e_jump', effect: { dodgeChance: 0.08 }, desc: '8% chance de esquivar ataques.' },
                    { id: 'e_instinct', name: 'Instinto do Explorador', levelReq: 16, cost: 3, prereq: 'e_dodge', effect: { moveSpeedPct: 0.1, staminaRegenPct: 0.15 }, desc: '+10% speed e +15% regen stamina.' }
                ]
            },
            mage: {
                id: 'mage',
                name: 'Mago',
                icon: '🔥',
                skills: [
                    { id: 'm_mana1', name: '+Mana Máxima', levelReq: 2, cost: 1, prereq: null, effect: { maxManaFlat: 30 }, desc: '+30 mana máxima.' },
                    { id: 'm_regen', name: 'Regen Mana', levelReq: 3, cost: 1, prereq: 'm_mana1', effect: { manaRegenPct: 0.25 }, desc: '+25% regeneração de mana.' },
                    { id: 'm_fire', name: 'Dano de Fogo', levelReq: 5, cost: 2, prereq: 'm_regen', effect: { fireDmgPct: 0.15 }, desc: 'Spells de fogo +15% dano.' },
                    { id: 'm_lightning', name: 'Dano de Raio', levelReq: 7, cost: 2, prereq: 'm_fire', effect: { lightningDmgPct: 0.15 }, desc: 'Spells de raio +15% dano.' },
                    { id: 'm_efficiency', name: 'Eficiência Arcana', levelReq: 10, cost: 2, prereq: 'm_lightning', effect: { manaCostPct: -0.15 }, desc: 'Spells custam 15% menos mana.' },
                    { id: 'm_mastery', name: 'Maestria Arcana', levelReq: 16, cost: 4, prereq: 'm_efficiency', effect: { magicPower: 0.25, maxManaFlat: 50 }, desc: '+25% poder mágico e +50 mana.' }
                ]
            }
        }
    };

    /** Calcula XP necessário para o próximo nível */
    function xpForLevel(level) {
        if (level >= PROGRESSION.maxLevel) return 999999;
        let xp = PROGRESSION.baseXp;
        for (let i = 1; i < level; i++) {
            xp = Math.floor(xp * PROGRESSION.xpScale);
        }
        return xp;
    }

    /** Aplica ganhos de level-up no player */
    function applyLevelUp(player, newLevel) {
        const g = PROGRESSION.levelGains;
        player.maxHp = (player.maxHp || 100) + g.maxHp;
        player.baseDamage = (player.baseDamage || 22) + g.damage;
        player.defense = Math.min(0.75, (player.defense || 0) + g.defense);
        player.maxStamina = Math.min(200, (player.maxStamina || 100) + g.maxStamina);
        player.maxMana = (player.maxMana || 80) + g.maxMana;
        player.skillPoints = (player.skillPoints || 0) + g.skillPoints;

        if (g.healOnLevel) {
            const pct = g.healPercent ?? 1;
            player.hp = Math.min(player.maxHp, Math.floor(player.maxHp * pct));
            player.stamina = player.maxStamina;
            player.mana = player.maxMana;
        }

        player.level = newLevel;
        player.xpNext = xpForLevel(newLevel);
    }

    /** Rola raridade com pesos */
    function rollRarity() {
        const r = Math.random();
        let acc = 0;
        const order = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
        for (const id of order) {
            acc += PROGRESSION.rarities[id].chance;
            if (r <= acc) return PROGRESSION.rarities[id];
        }
        return PROGRESSION.rarities.common;
    }

    global.PROGRESSION = PROGRESSION;
    global.xpForLevel = xpForLevel;
    global.applyLevelUp = applyLevelUp;
    global.rollRarity = rollRarity;

})(typeof window !== 'undefined' ? window : globalThis);
