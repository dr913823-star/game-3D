/**
 * loja_ferreiro.js — Forja / Loja do Ferreiro Borin
 * Prédio com forja, bigorna e fumaça; colisor para o mundo.
 *
 * Depende de: THREE (global)
 * API:
 *   const shop = new BlacksmithShop(scene, world, options);
 *   await shop.build();
 *   shop.update(time);
 *   shop.dispose();
 *   shop.getInteractPoint(); // {x,z,radius}
 */
(function (global) {
    'use strict';

    class BlacksmithShop {
        /**
         * @param {THREE.Scene} scene
         * @param {object} world
         * @param {object} [options]
         * @param {number} [options.x=-9]
         * @param {number} [options.z=6]
         */
        constructor(scene, world, options = {}) {
            if (!scene) throw new Error('[BlacksmithShop] scene obrigatória');
            this.scene = scene;
            this.world = world;
            // Lugar da casa removida; porta (+Z local) virada para o poço (0,0)
            this.x = options.x != null ? options.x : -16.2;
            this.z = options.z != null ? options.z : 11.8;
            this.rotY = options.rotY != null
                ? options.rotY
                : Math.atan2(this.x, this.z) + Math.PI;
            this._group = null;
            this._embers = [];
            this._smoke = [];
            this._built = false;
        }

        async build() {
            const group = new THREE.Group();
            group.name = 'blacksmith_shop';
            const groundY = this.world.getTerrainHeight(this.x, this.z);
            group.position.set(this.x, groundY, this.z);
            group.rotation.y = this.rotY;

            const wood = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.88 });
            const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 });
            const stone = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 });
            const plaster = new THREE.MeshStandardMaterial({ color: 0xb8a890, roughness: 0.92 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.75 });
            const metal = new THREE.MeshStandardMaterial({
                color: 0x71717a, metalness: 0.8, roughness: 0.35
            });
            const iron = new THREE.MeshStandardMaterial({
                color: 0x3f3f46, metalness: 0.7, roughness: 0.45
            });
            const glow = new THREE.MeshStandardMaterial({
                color: 0xff6b00, emissive: 0xff4500, emissiveIntensity: 1.2
            });

            // Fundação
            const foundation = new THREE.Mesh(
                new THREE.BoxGeometry(8.2, 0.5, 7.0),
                stone
            );
            foundation.position.y = 0.25;
            foundation.castShadow = true;
            foundation.receiveShadow = true;
            group.add(foundation);

            // Paredes
            const wallH = 3.6;
            const walls = new THREE.Mesh(
                new THREE.BoxGeometry(7.6, wallH, 6.4),
                plaster
            );
            walls.position.y = 0.5 + wallH * 0.5;
            walls.castShadow = true;
            walls.receiveShadow = true;
            group.add(walls);

            // Vigas de madeira na fachada
            for (const yy of [1.2, 2.4, 3.6]) {
                const beam = new THREE.Mesh(
                    new THREE.BoxGeometry(7.8, 0.2, 0.25),
                    wood
                );
                beam.position.set(0, yy, 3.25);
                group.add(beam);
            }
            for (const xx of [-3.5, 0, 3.5]) {
                const post = new THREE.Mesh(
                    new THREE.BoxGeometry(0.25, wallH, 0.25),
                    woodDark
                );
                post.position.set(xx, 0.5 + wallH * 0.5, 3.25);
                group.add(post);
            }

            // Telhado
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(6.2, 2.8, 4),
                roofMat
            );
            roof.position.y = 0.5 + wallH + 1.2;
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = true;
            group.add(roof);

            // Chaminé da forja
            const chimney = new THREE.Mesh(
                new THREE.BoxGeometry(1.3, 3.2, 1.3),
                stone
            );
            chimney.position.set(-2.2, 0.5 + wallH + 1.5, -1.5);
            chimney.castShadow = true;
            group.add(chimney);
            const chimneyTop = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 0.35, 1.5),
                stone
            );
            chimneyTop.position.set(-2.2, 0.5 + wallH + 3.2, -1.5);
            group.add(chimneyTop);

            // Porta
            const door = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, 2.5, 0.15),
                woodDark
            );
            door.position.set(0, 1.5, 3.28);
            door.castShadow = true;
            group.add(door);
            // Placa "FORJA"
            const sign = new THREE.Mesh(
                new THREE.BoxGeometry(2.2, 0.7, 0.12),
                wood
            );
            sign.position.set(0, 3.5, 3.35);
            group.add(sign);
            // Anel metálico da porta
            const handle = new THREE.Mesh(
                new THREE.TorusGeometry(0.1, 0.03, 6, 10),
                metal
            );
            handle.position.set(0.45, 1.5, 3.4);
            group.add(handle);

            // Janelas com brilho de forja
            for (const wx of [-2.4, 2.4]) {
                const frame = new THREE.Mesh(
                    new THREE.BoxGeometry(1.3, 1.1, 0.12),
                    woodDark
                );
                frame.position.set(wx, 2.4, 3.28);
                group.add(frame);
                const glass = new THREE.Mesh(
                    new THREE.BoxGeometry(1.05, 0.85, 0.08),
                    new THREE.MeshStandardMaterial({
                        color: 0xff8c00,
                        emissive: 0xff4500,
                        emissiveIntensity: 0.7,
                        transparent: true,
                        opacity: 0.85
                    })
                );
                glass.position.set(wx, 2.4, 3.32);
                group.add(glass);
                this._embers.push(glass);
            }

            // —— Interior / frente: forja e bigorna (do lado de fora da porta) ——
            // Forja
            const forgeBase = new THREE.Mesh(
                new THREE.BoxGeometry(2.2, 1.0, 1.6),
                stone
            );
            forgeBase.position.set(-3.2, 0.75, 4.6);
            forgeBase.castShadow = true;
            group.add(forgeBase);

            const forgeFire = new THREE.Mesh(
                new THREE.BoxGeometry(1.4, 0.5, 1.0),
                glow
            );
            forgeFire.position.set(-3.2, 1.35, 4.6);
            group.add(forgeFire);
            this._embers.push(forgeFire);

            // Luz da forja
            const forgeLight = new THREE.PointLight(0xff6a00, 1.4, 12, 2);
            forgeLight.position.set(-3.2, 1.8, 4.6);
            group.add(forgeLight);
            this._forgeLight = forgeLight;

            // Bigorna
            const anvilBase = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.5, 0.5),
                iron
            );
            anvilBase.position.set(-1.2, 0.55, 4.8);
            anvilBase.castShadow = true;
            group.add(anvilBase);
            const anvilTop = new THREE.Mesh(
                new THREE.BoxGeometry(1.3, 0.35, 0.55),
                metal
            );
            anvilTop.position.set(-1.2, 0.95, 4.8);
            anvilTop.castShadow = true;
            group.add(anvilTop);
            const anvilHorn = new THREE.Mesh(
                new THREE.CylinderGeometry(0.08, 0.12, 0.5, 6),
                metal
            );
            anvilHorn.rotation.z = Math.PI / 2;
            anvilHorn.position.set(-0.5, 0.95, 4.8);
            group.add(anvilHorn);

            // Martelo apoiado
            const hammerHandle = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.04, 0.7, 6),
                wood
            );
            hammerHandle.rotation.z = 0.6;
            hammerHandle.position.set(-1.0, 1.25, 5.1);
            group.add(hammerHandle);
            const hammerHead = new THREE.Mesh(
                new THREE.BoxGeometry(0.28, 0.14, 0.14),
                metal
            );
            hammerHead.position.set(-0.75, 1.45, 5.1);
            group.add(hammerHead);

            // Barril de água
            const barrel = new THREE.Mesh(
                new THREE.CylinderGeometry(0.45, 0.5, 0.9, 10),
                woodDark
            );
            barrel.position.set(1.5, 0.7, 4.7);
            barrel.castShadow = true;
            group.add(barrel);

            // Pilha de minério / lingotes
            for (let i = 0; i < 5; i++) {
                const ingot = new THREE.Mesh(
                    new THREE.BoxGeometry(0.45, 0.12, 0.22),
                    metal
                );
                ingot.position.set(
                    2.4 + (i % 2) * 0.15,
                    0.4 + Math.floor(i / 2) * 0.14,
                    4.5 + (i % 3) * 0.1
                );
                ingot.rotation.y = (i * 0.3);
                group.add(ingot);
            }

            // Fumaça (esferas transparentes)
            for (let i = 0; i < 4; i++) {
                const puff = new THREE.Mesh(
                    new THREE.SphereGeometry(0.25 + i * 0.05, 8, 6),
                    new THREE.MeshStandardMaterial({
                        color: 0x94a3b8,
                        transparent: true,
                        opacity: 0.35,
                        depthWrite: false
                    })
                );
                puff.position.set(-2.2, 0.5 + wallH + 3.5 + i * 0.4, -1.5);
                group.add(puff);
                this._smoke.push({ mesh: puff, phase: i * 1.2, baseY: puff.position.y });
            }

            // Placa de texto (canvas)
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(40,25,10,0.9)';
            ctx.fillRect(0, 0, 256, 64);
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 3;
            ctx.strokeRect(4, 4, 248, 56);
            ctx.font = 'bold 28px sans-serif';
            ctx.fillStyle = '#fbbf24';
            ctx.textAlign = 'center';
            ctx.fillText('⚒ FORJA DE BORIN', 128, 42);
            const tex = new THREE.CanvasTexture(canvas);
            const label = new THREE.Mesh(
                new THREE.PlaneGeometry(2.4, 0.6),
                new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
            );
            label.position.set(0, 3.5, 3.42);
            group.add(label);
            this._label = label;

            this.scene.add(group);
            this._group = group;
            this._built = true;

            // Colisor
            if (this.world && Array.isArray(this.world.colliders)) {
                this.world.colliders.push({
                    x: this.x, z: this.z, radius: 5.2, type: 'blacksmith_shop'
                });
            }
        }

        getInteractPoint() {
            // Frente da porta (local +Z ≈ 4.5), rotacionado para o mundo
            const dist = 4.8;
            const fx = this.x + Math.sin(this.rotY) * dist;
            const fz = this.z + Math.cos(this.rotY) * dist;
            return {
                x: fx,
                z: fz,
                radius: 3.8,
                label: 'Abrir Loja do Ferreiro',
                type: 'blacksmith_shop'
            };
        }

        update(time) {
            // Atualiza efeitos a cada ~2 frames (suficiente visualmente, menos custo)
            this._updSkip = (this._updSkip || 0) + 1;
            if (this._updSkip < 2) return;
            this._updSkip = 0;

            // Fogo pulsando
            for (let i = 0; i < this._embers.length; i++) {
                const m = this._embers[i];
                if (m.material && m.material.emissiveIntensity != null) {
                    m.material.emissiveIntensity = 0.7 + Math.sin(time * 6 + i) * 0.4;
                }
            }
            if (this._forgeLight) {
                this._forgeLight.intensity = 1.2 + Math.sin(time * 5) * 0.5;
            }
            // Fumaça subindo
            for (let i = 0; i < this._smoke.length; i++) {
                const s = this._smoke[i];
                const t = (time * 0.4 + s.phase) % 2.5;
                s.mesh.position.y = s.baseY + t;
                s.mesh.material.opacity = 0.35 * (1 - t / 2.5);
                s.mesh.position.x = -2.2 + Math.sin(time * 0.8 + s.phase) * 0.3;
            }
        }

        dispose() {
            if (!this._group) return;
            this.scene.remove(this._group);
            this._group.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
            this._group = null;
            this._embers = [];
            this._smoke = [];
            this._built = false;
        }
    }

    /** Catálogo da loja: armas + itens que alteram HP/Vigor/Mana/XP. */
    function buildBlacksmithCatalog() {
        const weapons = (typeof getShopWeapons === 'function')
            ? getShopWeapons()
            : [];
        const armors = (typeof getShopArmors === 'function')
            ? getShopArmors()
            : [];
        const extras = [
            {
                id: 'potion',
                name: 'Poção de Vida',
                desc: 'Restaura 45 de HP',
                icon: 'fa-flask',
                price: 25,
                type: 'item',
                effect: 'heal',
                heal: 45
            },
            {
                id: 'potion_big',
                name: 'Poção Maior',
                desc: 'Restaura 80 de HP',
                icon: 'fa-flask',
                price: 55,
                type: 'item',
                effect: 'heal',
                heal: 80
            },
            {
                id: 'armor_reinforce',
                name: 'Reforço de Armadura',
                desc: '+20 HP máximo permanente',
                icon: 'fa-shield-halved',
                price: 100,
                type: 'upgrade_hp',
                hpBonus: 20
            }
        ];
        // Mantém armas, armaduras (afetam HP/defesa) e consumíveis que afetam HP.
        return weapons.concat(armors).concat(extras);
    }

    const BLACKSMITH_CATALOG = buildBlacksmithCatalog();

    global.BlacksmithShop = BlacksmithShop;
    global.BLACKSMITH_CATALOG = BLACKSMITH_CATALOG;
    global.getBlacksmithCatalog = buildBlacksmithCatalog;

})(typeof window !== 'undefined' ? window : globalThis);
