/**
 * poste.js — Postes de luz medievais na vila
 * 2 postes de madeira/ferro com lanterna que iluminam à noite
 * Sem funcionalidade de gameplay — só visual + PointLight
 *
 * Depende de: THREE (global)
 * API:
 *   const lamps = new LampPostSystem(scene, world, options);
 *   await lamps.build(onProgress);
 *   lamps.setNight(isNight);   // liga/desliga a luz
 *   lamps.update(timeSec);     // leve flicker da chama
 *   lamps.dispose();
 */

(function (global) {
    'use strict';

    // Apenas 2 postes, próximos ao centro da vila (poço / caminhos)
    const DEFAULT_SPOTS = [
        { x:  7.5, z: -6.5, rot: 0.2 },
        { x: -7.0, z:  7.0, rot: -0.4 }
    ];

    class LampPostSystem {
        /**
         * @param {THREE.Scene} scene
         * @param {object} world - WorldMap (getTerrainHeight, cfg)
         * @param {object} [options]
         */
        constructor(scene, world, options = {}) {
            if (!scene) throw new Error('[LampPostSystem] scene obrigatória');
            if (!world) throw new Error('[LampPostSystem] world obrigatório');

            this.scene = scene;
            this.world = world;
            this.spots = options.spots || DEFAULT_SPOTS.slice();
            this.posts = [];
            this.lights = [];
            this._groups = [];
            this._isNight = false;
            this._baseIntensity = 1.35;
        }

        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(72, 'Erguendo postes de luz...');

            for (let i = 0; i < this.spots.length; i++) {
                const spot = this.spots[i];
                const groundY = this.world.getTerrainHeight(spot.x, spot.z);

                const post = this._createMedievalPost();
                post.position.set(spot.x, groundY, spot.z);
                post.rotation.y = spot.rot || 0;
                post.name = 'lamp_post_' + i;

                // PointLight no topo da lanterna (só acende de noite)
                const light = new THREE.PointLight(0xffaa55, 0, 18, 1.6);
                light.position.set(0, 4.15, 0); // relativo ao grupo
                light.castShadow = false; // evita custo extra
                light.name = 'lamp_light_' + i;
                post.add(light);

                this.scene.add(post);
                this.posts.push(post);
                this.lights.push(light);
                this._groups.push(post);
            }
        }

        /**
         * Liga/desliga a iluminação noturna
         * @param {boolean} isNight
         */
        setNight(isNight) {
            this._isNight = !!isNight;
            const target = this._isNight ? this._baseIntensity : 0;
            for (let i = 0; i < this.lights.length; i++) {
                this.lights[i].intensity = target;
            }
            // Material emissivo da chama
            for (let i = 0; i < this.posts.length; i++) {
                const flame = this.posts[i].userData && this.posts[i].userData.flame;
                if (flame && flame.material) {
                    flame.material.emissiveIntensity = this._isNight ? 1.2 : 0.05;
                    flame.visible = this._isNight;
                }
            }
        }

        /**
         * Flicker suave da chama à noite
         * @param {number} timeSec
         */
        update(timeSec) {
            if (!this._isNight) return;
            for (let i = 0; i < this.lights.length; i++) {
                const flicker = 0.85 + Math.sin(timeSec * 9 + i * 2.1) * 0.12
                    + Math.sin(timeSec * 17 + i) * 0.06;
                this.lights[i].intensity = this._baseIntensity * flicker;

                const flame = this.posts[i] && this.posts[i].userData && this.posts[i].userData.flame;
                if (flame) {
                    flame.scale.y = 0.9 + Math.sin(timeSec * 11 + i) * 0.15;
                    flame.scale.x = 0.95 + Math.sin(timeSec * 13 + i * 1.3) * 0.1;
                }
            }
        }

        // =====================================================================
        // MODELO MEDIEVAL
        // =====================================================================
        _mat(color, roughness = 0.88, metalness = 0.08) {
            return new THREE.MeshStandardMaterial({
                color: color,
                roughness: roughness,
                metalness: metalness
            });
        }

        _createMedievalPost() {
            const g = new THREE.Group();

            const wood = this._mat(0x4e342e, 0.92, 0.02);
            const darkWood = this._mat(0x3e2723, 0.9, 0.02);
            const iron = this._mat(0x37474f, 0.55, 0.45);
            const bronze = this._mat(0x8d6e63, 0.5, 0.35);

            // --- Base de pedra ---
            const base = new THREE.Mesh(
                new THREE.CylinderGeometry(0.35, 0.42, 0.35, 6),
                this._mat(0x616161, 0.95, 0.05)
            );
            base.position.y = 0.18;
            base.castShadow = true;
            base.receiveShadow = true;
            g.add(base);

            // --- Poste de madeira (haste principal) ---
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.11, 0.14, 3.4, 6),
                wood
            );
            pole.position.y = 2.0;
            pole.castShadow = true;
            g.add(pole);

            // Anéis de ferro no poste
            for (const hy of [0.9, 2.0, 3.15]) {
                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(0.15, 0.03, 6, 10),
                    iron
                );
                ring.rotation.x = Math.PI / 2;
                ring.position.y = hy;
                g.add(ring);
            }

            // --- Braço horizontal de ferro ---
            const arm = new THREE.Mesh(
                new THREE.BoxGeometry(0.9, 0.08, 0.08),
                iron
            );
            arm.position.set(0.4, 3.45, 0);
            arm.castShadow = true;
            g.add(arm);

            // Suporte diagonal
            const brace = new THREE.Mesh(
                new THREE.BoxGeometry(0.55, 0.05, 0.05),
                iron
            );
            brace.position.set(0.22, 3.25, 0);
            brace.rotation.z = -0.55;
            g.add(brace);

            // --- Lanterna (gaiola hexagonal) ---
            const lanternY = 3.25;
            const lanternX = 0.75;

            // Teto da lanterna
            const roof = new THREE.Mesh(
                new THREE.ConeGeometry(0.28, 0.28, 6),
                bronze
            );
            roof.position.set(lanternX, lanternY + 0.45, 0);
            roof.castShadow = true;
            g.add(roof);

            // Pico decorativo
            const spike = new THREE.Mesh(
                new THREE.ConeGeometry(0.05, 0.2, 5),
                iron
            );
            spike.position.set(lanternX, lanternY + 0.68, 0);
            g.add(spike);

            // Armação vertical da gaiola (6 barras)
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const bar = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.018, 0.018, 0.55, 4),
                    iron
                );
                bar.position.set(
                    lanternX + Math.cos(a) * 0.2,
                    lanternY + 0.15,
                    Math.sin(a) * 0.2
                );
                g.add(bar);
            }

            // Anel inferior da gaiola
            const bottomRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.2, 0.025, 6, 12),
                iron
            );
            bottomRing.rotation.x = Math.PI / 2;
            bottomRing.position.set(lanternX, lanternY - 0.12, 0);
            g.add(bottomRing);

            // Anel superior
            const topRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.2, 0.025, 6, 12),
                iron
            );
            topRing.rotation.x = Math.PI / 2;
            topRing.position.set(lanternX, lanternY + 0.35, 0);
            g.add(topRing);

            // --- Chama / fogo (emissivo) ---
            const flameMat = new THREE.MeshStandardMaterial({
                color: 0xff6600,
                emissive: 0xff4400,
                emissiveIntensity: 0.05,
                roughness: 0.4,
                transparent: true,
                opacity: 0.95
            });
            const flame = new THREE.Mesh(
                new THREE.ConeGeometry(0.1, 0.28, 5),
                flameMat
            );
            flame.position.set(lanternX, lanternY + 0.12, 0);
            flame.name = 'flame';
            flame.visible = false;
            g.add(flame);
            g.userData.flame = flame;

            // Núcleo da chama (mais claro)
            const core = new THREE.Mesh(
                new THREE.SphereGeometry(0.06, 6, 6),
                new THREE.MeshStandardMaterial({
                    color: 0xffcc66,
                    emissive: 0xffaa33,
                    emissiveIntensity: 0.8,
                    roughness: 0.3
                })
            );
            core.position.set(lanternX, lanternY + 0.02, 0);
            g.add(core);
            g.userData.flameCore = core;

            // Corrente / gancho que segura a lanterna no braço
            const hook = new THREE.Mesh(
                new THREE.TorusGeometry(0.06, 0.015, 5, 8),
                iron
            );
            hook.position.set(lanternX, lanternY + 0.55, 0);
            g.add(hook);

            return g;
        }

        dispose() {
            const disposeMesh = (obj) => {
                if (!obj) return;
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            };

            for (const light of this.lights) {
                if (light.parent) light.parent.remove(light);
                // PointLight não tem geometry
            }
            this.lights.length = 0;

            for (const g of this._groups) {
                this.scene.remove(g);
                g.traverse(disposeMesh);
            }
            this._groups.length = 0;
            this.posts.length = 0;
        }
    }

    global.LampPostSystem = LampPostSystem;
})(typeof window !== 'undefined' ? window : globalThis);
