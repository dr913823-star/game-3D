/**
 * missoes.js — Missões oferecidas por cada NPC da vila
 *
 * API:
 *   NPC_QUESTS                 — mapa npcId → quest def
 *   QuestManager (global)      — gerencia aceite, progresso e recompensas
 */
(function (global) {
    'use strict';

    /**
     * status: 'available' | 'active' | 'ready' | 'done'
     * ready = objetivos cumpridos, falta entregar ao NPC
     */
    const NPC_QUESTS = {
        npc_marcus: {
            id: 'q_marcus_goblins',
            giverId: 'npc_marcus',
            giverName: 'Ancião Marcus',
            title: 'Ameaça no Vale',
            desc: 'Derrote 3 Goblins na floresta e volte a falar com Marcus.',
            target: 'goblin',
            need: 3,
            gold: 60,
            xp: 35,
            dialogueOffer:
                'Saudações, viajante! Os goblins infestam a floresta ao norte. Derrote três deles e volte — trarei ouro e bênçãos.',
            dialogueProgress:
                'Ainda há goblins por aí. Quando derrubar três, volte a mim.',
            dialogueComplete:
                'Excelente trabalho! A vila respira aliviada. Tome isto como agradecimento.',
            dialogueDone:
                'Você já ajudou muito a vila. Os espíritos sorriem para você.'
        },
        npc_fazendeiro: {
            id: 'q_tomas_wolves',
            giverId: 'npc_fazendeiro',
            giverName: 'Tomás',
            title: 'Proteja a Colheita',
            desc: 'Derrote 2 Esqueletos que ameaçam as plantações.',
            target: 'skeleton',
            need: 2,
            gold: 45,
            xp: 25,
            dialogueOffer:
                'Os ossos andantes estão perto das plantações! Derrube dois esqueletos e a colheita estará a salvo.',
            dialogueProgress:
                'Ainda ouço ossos batendo à noite... Preciso que derrote dois esqueletos.',
            dialogueComplete:
                'Graças aos espíritos da terra! Minha colheita está segura. Aqui, um pouco de ouro.',
            dialogueDone:
                'As plantações crescem fortes graças a você!'
        },
        npc_guarda: {
            id: 'q_roric_shadow',
            giverId: 'npc_guarda',
            giverName: 'Capitão Roric',
            title: 'Besta das Sombras',
            desc: 'Derrote a Besta das Sombras e reporte a Roric.',
            target: 'shadow',
            need: 1,
            gold: 120,
            xp: 60,
            dialogueOffer:
                'A muralha segura a vila, mas a Besta das Sombras espreita ao sul. Elimine-a e prove seu valor de guerreiro.',
            dialogueProgress:
                'A besta ainda vive. Não volte sem a vitória.',
            dialogueComplete:
                'Soldado de verdade! A vila deve-lhe esta vitória. Recompensa merecida.',
            dialogueDone:
                'Com a besta morta, a muralha pode descansar um pouco.'
        },
        npc_ferreiro: {
            id: 'q_borin_ore',
            giverId: 'npc_ferreiro',
            giverName: 'Borin',
            title: 'Minério da Floresta',
            desc: 'Colete 3 minérios na floresta e entregue a Borin.',
            target: 'ore',
            need: 3,
            gold: 55,
            xp: 30,
            dialogueOffer:
                'Minha forja pede minério puro! Vá à floresta, colete três minérios e traga-os — forjo com poder de verdade.',
            dialogueProgress:
                'Ainda preciso de minério. Procure pedras brilhantes entre as árvores da floresta.',
            dialogueComplete:
                'Perfeito! Com isto a bigorna canta. Tome ouro pelo trabalho.',
            dialogueDone:
                'A forja está abastecida. Volte se quiser comprar uma lâmina nova!'
        },
        npc_curandeira: {
            id: 'q_elara_herbs',
            giverId: 'npc_curandeira',
            giverName: 'Elara',
            title: 'Ervas Medicinais',
            desc: 'Colete 3 ervas medicinais na floresta e entregue a Elara.',
            target: 'herb',
            need: 3,
            gold: 40,
            xp: 25,
            dialogueOffer:
                'Preciso de ervas frescas para as poções. Vá à floresta, colha três ervas medicinais e traga-as a mim.',
            dialogueProgress:
                'Ainda faltam ervas. Procure folhas verdes brilhantes entre a vegetação da floresta.',
            dialogueComplete:
                'Excelente! Com estas ervas preparo remédios poderosos. Tome estas moedas.',
            dialogueDone:
                'Suas feridas sempre encontrarão alívio aqui.'
        },
        npc_comerciante: {
            id: 'q_vessa_crystals',
            giverId: 'npc_comerciante',
            giverName: 'Vessa',
            title: 'Cristais para o Mercado',
            desc: 'Colete 2 Cristais Místicos e volte a Vessa.',
            target: 'crystal',
            need: 2,
            gold: 50,
            xp: 25,
            dialogueOffer:
                'Cristais místicos vendem bem na tenda! Traga dois e recompenso o esforço.',
            dialogueProgress:
                'Ainda não vi cristais... Procure brilhos azuis no campo e nas ruínas.',
            dialogueComplete:
                'Negócio é negócio! Aqui está uma gorjeta pelos cristais.',
            dialogueDone:
                'Sempre tenho algo misterioso na tenda, se tiver ouro...'
        },
        npc_crianca: {
            id: 'q_lila_play',
            giverId: 'npc_crianca',
            giverName: 'Lila',
            title: 'Esconde-Esconde',
            desc: 'Fale com Lila de novo depois de aceitar (ela “se esconde”).',
            target: 'npc_crianca',
            need: 1,
            gold: 15,
            xp: 10,
            dialogueOffer:
                'Quer brincar de esconde-esconde? Aceita e depois me acha de novo — eu “escondo” bem aqui!',
            dialogueProgress:
                'Hihi, ainda não me achou de verdade... Fale comigo outra vez!',
            dialogueComplete:
                'Te achei! ...Espera, você me achou. Ganhei? Toma, peguei estas moedas do chão!',
            dialogueDone:
                'Você é o melhor herói da vila! Pode brincar sempre.'
        }
    };

    class QuestManager {
        constructor() {
            /** @type {Object.<string, object>} */
            this.byId = {};
            /** ordem para HUD */
            this.order = [];

            for (const key of Object.keys(NPC_QUESTS)) {
                const def = NPC_QUESTS[key];
                this.byId[def.id] = Object.assign({}, def, {
                    cur: 0,
                    status: 'available', // available | active | ready | done
                    accepted: false
                });
                this.order.push(def.id);
            }

            // Compat com saves antigos
            this.idx = 0;
            this.quests = this.order.map(id => this.byId[id]);
        }

        getQuestByGiver(npcId) {
            const def = NPC_QUESTS[npcId];
            if (!def) return null;
            return this.byId[def.id] || null;
        }

        getActiveQuests() {
            return this.order.map(id => this.byId[id]).filter(q => q.status === 'active' || q.status === 'ready');
        }

        current() {
            const active = this.getActiveQuests();
            if (active.length) return active[0];
            const avail = this.order.map(id => this.byId[id]).find(q => q.status === 'available');
            return avail || null;
        }

        /**
         * Ao falar com NPC: aceita, atualiza diálogo ou entrega missão
         * @returns {{ speech: string, accepted?: boolean, turnedIn?: boolean, quest?: object }}
         */
        handleNpcTalk(npcId) {
            const q = this.getQuestByGiver(npcId);
            if (!q) {
                return { speech: null };
            }

            if (q.status === 'available') {
                q.status = 'active';
                q.accepted = true;
                q.cur = 0;
                // Missão da criança: progresso ao falar de novo (segundo contato)
                if (q.target === 'npc_crianca') {
                    // não completa no aceite
                }
                return {
                    speech: q.dialogueOffer,
                    accepted: true,
                    quest: q
                };
            }

            if (q.status === 'active') {
                // Caso especial: missão Lila — segundo diálogo conta como achar
                if (q.target === 'npc_crianca' && npcId === 'npc_crianca') {
                    this.progress('npc_crianca', 1);
                }
                if (q.status === 'ready') {
                    return this._turnIn(q);
                }
                return {
                    speech: q.dialogueProgress + ` (${q.cur}/${q.need})`,
                    quest: q
                };
            }

            if (q.status === 'ready') {
                return this._turnIn(q);
            }

            // done
            return {
                speech: q.dialogueDone,
                quest: q
            };
        }

        _turnIn(q) {
            q.status = 'done';
            q.done = true;
            const gold = q.gold || 40;
            const xp = q.xp || 20;
            if (typeof Game !== 'undefined' && Game.player) {
                Game.player.gold = (Game.player.gold || 0) + gold;
                if (typeof Game.player.gainXP === 'function') Game.player.gainXP(xp);
                else Game.player.xp = (Game.player.xp || 0) + xp;
            }
            if (typeof Game !== 'undefined') {
                Game.showToast?.(`Missão concluída: ${q.title}! +${gold} ouro`, 'amber');
                Game.updateHUDQuests?.();
            }
            if (typeof Sound !== 'undefined') Sound.playLevelUp?.();
            return {
                speech: q.dialogueComplete,
                turnedIn: true,
                quest: q
            };
        }

        /**
         * Progresso genérico por tipo de alvo (goblin, crystal, shop_buy, etc.)
         */
        progress(type, n = 1) {
            let changed = false;
            for (const id of this.order) {
                const q = this.byId[id];
                if (!q || q.status !== 'active') continue;
                if (q.target !== type) continue;
                q.cur = Math.min(q.need, q.cur + n);
                changed = true;
                if (q.cur >= q.need) {
                    q.status = 'ready';
                    if (typeof Game !== 'undefined') {
                        Game.showToast?.(`Objetivo: ${q.title} — volte a ${q.giverName}!`, 'amber');
                    }
                }
            }
            if (changed && typeof Game !== 'undefined') Game.updateHUDQuests?.();
            // Compat: progresso linear antigo
            this.idx = this.order.findIndex(id => this.byId[id].status !== 'done');
            if (this.idx < 0) this.idx = this.order.length;
        }

        /** Serialização simples */
        toSave() {
            const data = {};
            for (const id of this.order) {
                const q = this.byId[id];
                data[id] = { cur: q.cur, status: q.status, accepted: q.accepted };
            }
            return data;
        }

        fromSave(data) {
            if (!data || typeof data !== 'object') return;
            for (const id of Object.keys(data)) {
                if (!this.byId[id]) continue;
                Object.assign(this.byId[id], data[id]);
            }
        }

        /** Reinicia todas as missões (nova jornada) */
        reset() {
            for (const id of this.order) {
                const q = this.byId[id];
                if (!q) continue;
                q.cur = 0;
                q.status = 'available';
                q.accepted = false;
                q.done = false;
            }
            this.idx = 0;
        }
    }

    global.NPC_QUESTS = NPC_QUESTS;
    global.QuestManager = QuestManager;

})(typeof window !== 'undefined' ? window : globalThis);
