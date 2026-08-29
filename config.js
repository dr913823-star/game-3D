/**
 * config.js — Configuração central + utilitários de estabilidade
 * Garante desempenho e funcionamento de diálogo, inventário e game over.
 *
 * Carregar ANTES dos outros módulos do jogo.
 */

(function (global) {
    'use strict';

    // =========================================================================
    // CONFIGURAÇÃO PRINCIPAL
    // =========================================================================
    const CONFIG = {
        version: '3.0.0',
        saveKey: 'wilds_v3_save',

        /** Performance */
        performance: {
            /** performance | balanced | ultra */
            defaultPreset: 'balanced',
            maxPixelRatio: 1.1,
            antialias: false,
            shadowMapSize: 512,
            shadowType: 'basic', // basic = mais leve
            targetFpsHudInterval: 0.5,
            hudUpdateInterval: 0.08,
            minimapUpdateInterval: 0.12,
            maxDeltaTime: 0.08
        },

        /** Mundo */
        world: {
            mapSize: 320,
            treeCount: 120,
            rockCount: 55,
            wallRadius: 130,
            wallClosed: false
        },

        /** Jogador */
        player: {
            maxHp: 100,
            moveSpeed: 9.5,
            attackRange: 3.6
        },

        /** UI / Sistemas — flags de segurança */
        systems: {
            dialogue: true,
            inventory: true,
            gameOver: true,
            quests: true,
            saveLoad: true,
            minimap: true,
            particles: true,
            sound: true
        },

        /** Teclas */
        keys: {
            interact: 'KeyE',
            inventory: 'KeyI',
            potion: 'KeyQ',
            pause: 'Escape',
            pauseAlt: 'KeyP',
            character: 'KeyC',
            skills: 'KeyK'
        },

        /** Distâncias */
        interactDistance: {
            npc: 3.4,
            collectible: 2.4,
            chest: 2.8
        }
    };

    // =========================================================================
    // UTILITÁRIOS SEGUROS (evitam bugs de null / DOM)
    // =========================================================================
    const Utils = {
        /** querySelector seguro */
        $(id) {
            return document.getElementById(id);
        },

        /** Mostra elemento (remove hidden) */
        show(id) {
            const el = Utils.$(id);
            if (el) el.classList.remove('hidden');
            return el;
        },

        /** Esconde elemento */
        hide(id) {
            const el = Utils.$(id);
            if (el) el.classList.add('hidden');
            return el;
        },

        /** Está visível? */
        isVisible(id) {
            const el = Utils.$(id);
            return !!(el && !el.classList.contains('hidden'));
        },

        /** Texto seguro */
        setText(id, text) {
            const el = Utils.$(id);
            if (el) el.textContent = text == null ? '' : String(text);
        },

        /** HTML seguro (só para conteúdo controlado pelo jogo) */
        setHtml(id, html) {
            const el = Utils.$(id);
            if (el) el.innerHTML = html == null ? '' : String(html);
        },

        /** Pointer lock seguro */
        requestLock() {
            try {
                if (document.body && document.pointerLockElement !== document.body) {
                    document.body.requestPointerLock();
                }
            } catch (_) { /* ignore */ }
        },

        exitLock() {
            try {
                if (document.pointerLockElement) document.exitPointerLock();
            } catch (_) { /* ignore */ }
        },

        /** Clampa número */
        clamp(v, min, max) {
            return Math.max(min, Math.min(max, v));
        },

        /**
         * Aplica preset de performance no renderer Three.js.
         * NÃO altera a resolução (pixel ratio) — isso é controlado só pelo seletor de Resolução.
         * Só recria o shadow map se o tamanho mudou (evita hitch ao abrir o menu).
         */
        applyPreset(renderer, scene, sunLight, preset) {
            if (!renderer) return;
            const p = preset || CONFIG.performance.defaultPreset;
            let wantSize = CONFIG.performance.shadowMapSize || 512;
            let enableShadows = true;
            let fogDensity = 0.006;

            if (p === 'performance') {
                enableShadows = false;
                wantSize = 256;
                fogDensity = 0.01;
            } else if (p === 'ultra') {
                enableShadows = true;
                wantSize = 1024;
                fogDensity = 0.0045;
            } else {
                enableShadows = true;
                wantSize = CONFIG.performance.shadowMapSize || 512;
                fogDensity = 0.006;
            }

            renderer.shadowMap.enabled = enableShadows;
            if (scene && scene.fog) scene.fog.density = fogDensity;

            if (sunLight && sunLight.shadow) {
                const cur = sunLight.shadow.mapSize.x;
                if (cur !== wantSize) {
                    sunLight.shadow.mapSize.set(wantSize, wantSize);
                    try {
                        if (sunLight.shadow.map) {
                            sunLight.shadow.map.dispose();
                            sunLight.shadow.map = null;
                        }
                    } catch (_) { /* ignore */ }
                }
            }
        },

        /** Log de sistema (só se debug) */
        log(...args) {
            if (CONFIG.debug) console.log('[Game]', ...args);
        },

        warn(...args) {
            console.warn('[Game]', ...args);
        }
    };

    // =========================================================================
    // UI CONTROLLER — diálogo / inventário / game over sem conflito
    // =========================================================================
    class UIController {
        constructor(game) {
            this.game = game;
            /** Qual modal bloqueia o jogo agora */
            this.activeModal = null; // 'dialogue' | 'inventory' | 'pause' | 'death' | 'settings' | null
        }

        /** Abre modal de forma exclusiva e segura */
        open(name, beforeOpen) {
            if (!CONFIG.systems) return false;

            // Game over tem prioridade: não abre outros por cima
            if (this.activeModal === 'death' && name !== 'death') return false;

            // Fecha conflitos leves (não fecha death)
            if (name === 'dialogue' && this.activeModal === 'inventory') {
                this.close('inventory', true);
            }

            if (typeof beforeOpen === 'function') beforeOpen();

            Utils.exitLock();

            if (name === 'dialogue' && CONFIG.systems.dialogue) {
                Utils.show('dialogue-modal');
            } else if (name === 'inventory' && CONFIG.systems.inventory) {
                Utils.show('inventory-modal');
            } else if (name === 'pause') {
                Utils.show('pause-modal');
            } else if (name === 'death' && CONFIG.systems.gameOver) {
                Utils.show('death-modal');
            } else if (name === 'settings') {
                Utils.show('settings-modal');
            } else {
                return false;
            }

            this.activeModal = name;
            if (this.game) this.game.isPaused = (name !== null);
            return true;
        }

        /** Fecha modal e restaura controle se possível */
        close(name, skipResume) {
            if (name === 'dialogue') Utils.hide('dialogue-modal');
            else if (name === 'inventory') Utils.hide('inventory-modal');
            else if (name === 'pause') Utils.hide('pause-modal');
            else if (name === 'death') Utils.hide('death-modal');
            else if (name === 'settings') Utils.hide('settings-modal');

            if (this.activeModal === name) this.activeModal = null;

            // Se ainda há outro modal aberto, mantém pausa
            const stillOpen =
                Utils.isVisible('dialogue-modal') ||
                Utils.isVisible('inventory-modal') ||
                Utils.isVisible('pause-modal') ||
                Utils.isVisible('death-modal') ||
                Utils.isVisible('settings-modal');

            if (stillOpen) {
                if (Utils.isVisible('death-modal')) this.activeModal = 'death';
                else if (Utils.isVisible('pause-modal')) this.activeModal = 'pause';
                else if (Utils.isVisible('dialogue-modal')) this.activeModal = 'dialogue';
                else if (Utils.isVisible('inventory-modal')) this.activeModal = 'inventory';
                else if (Utils.isVisible('settings-modal')) this.activeModal = 'settings';
                if (this.game) this.game.isPaused = true;
                return;
            }

            if (!skipResume && this.game && this.game.gameStarted) {
                this.game.isPaused = false;
                Utils.requestLock();
            } else if (this.game && !stillOpen) {
                this.game.isPaused = false;
            }
        }

        isBlocked() {
            return this.activeModal != null;
        }
    }

    // Export
    global.CONFIG = CONFIG;
    global.Utils = Utils;
    global.UIController = UIController;

})(typeof window !== 'undefined' ? window : globalThis);
