/**
 * barco.js — Barcos decorativos diversificados na água
 * Modelos low-poly: vela, pesca, canoa, jangada, mercante
 * Sem funcionalidade / colisão — apenas visual + leve flutuação
 *
 * Depende de: THREE (global)
 * API:
 *   const boats = new BoatSystem(scene, world, options);
 *   await boats.build(onProgress);
 *   boats.update(timeSec);
 *   boats.dispose();
 */

(function (global) {
    'use strict';

    const DEFAULTS = {
        count: 8
    };

    // Posições em áreas baixas (água visível) — distantes da vila
    const DEFAULT_SPOTS = [
        { x: -87.6, z: -81.6, rot: 0.40, type: 'sail' },
        { x: -46.7, z:  98.8, rot: -0.70, type: 'fishing' },
        { x: -53.4, z: -88.4, rot: 1.10, type: 'canoe' },
        { x: -12.6, z: 102.3, rot: -0.30, type: 'raft' },
        { x: -21.7, z: -109.2, rot: 0.85, type: 'merchant' },
        { x: -82.2, z:  59.8, rot: -1.20, type: 'sail' },
        { x: -65.8, z: -62.4, rot: 0.20, type: 'fishing' },
        { x: -80.0, z:  88.8, rot: -0.55, type: 'canoe' }
    ];

    class BoatSystem {
        /**
         * @param {THREE.Scene} scene
         * @param {object} world - WorldMap (getTerrainHeight, cfg)
         * @param {object} [options]
         */
        constructor(scene, world, options = {}) {
            if (!scene) throw new Error('[BoatSystem] scene obrigatória');
            if (!world) throw new Error('[BoatSystem] world obrigatório');

            this.scene = scene;
            this.world = world;
            this.cfg = Object.assign({}, DEFAULTS, options);
            this.boats = [];
            this._groups = [];
        }

        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(70, 'Colocando barcos na água...');

            const waterLevel = (this.world.cfg && this.world.cfg.waterLevel) || 0.5;
            const spots = DEFAULT_SPOTS.slice(0, this.cfg.count);

            for (let i = 0; i < spots.length; i++) {
                const spot = spots[i];
                const h = this.world.getTerrainHeight(spot.x, spot.z);
                if (h > waterLevel + 0.2) continue;

                const boat = this._createBoat(spot.type || 'sail');
                // Escala maior para ficarem bem visíveis na água
                const s = 1.75 + Math.random() * 0.55;
                boat.scale.setScalar(s);

                const baseY = waterLevel + 0.35;
                boat.position.set(spot.x, baseY, spot.z);
                boat.rotation.y = spot.rot + (Math.random() - 0.5) * 0.2;
                boat.name = 'boat_' + i;
                boat.userData = {
                    baseY: baseY,
                    phase: Math.random() * Math.PI * 2,
                    type: spot.type
                };

                this.scene.add(boat);
                this.boats.push(boat);
                this._groups.push(boat);
            }
        }

        /**
         * Leve flutuação e balanço
         * @param {number} timeSec
         */
        update(timeSec) {
            for (let i = 0; i < this.boats.length; i++) {
                const b = this.boats[i];
                if (!b || !b.userData) continue;
                const phase = b.userData.phase || 0;
                const baseY = b.userData.baseY || 0.7;
                b.position.y = baseY + Math.sin(timeSec * 0.75 + phase) * 0.06;
                b.rotation.z = Math.sin(timeSec * 0.5 + phase) * 0.035;
                b.rotation.x = Math.sin(timeSec * 0.38 + phase * 1.2) * 0.022;
            }
        }

        // =====================================================================
        // FACTORY DE MODELOS
        // =====================================================================
        _createBoat(type) {
            switch (type) {
                case 'fishing':  return this._createFishingBoat();
                case 'canoe':    return this._createCanoe();
                case 'raft':     return this._createRaft();
                case 'merchant': return this._createMerchantBoat();
                case 'sail':
                default:         return this._createSailBoat();
            }
        }

        _mat(color, roughness = 0.85, metalness = 0.05) {
            return new THREE.MeshStandardMaterial({
                color: color,
                roughness: roughness,
                metalness: metalness
            });
        }

        // ---------- Veleiro clássico ----------
        _createSailBoat() {
            const g = new THREE.Group();
            const wood = this._mat(0x6d4c41);
            const dark = this._mat(0x3e2723);
            const sail = this._mat(0xf5f5f5, 0.75, 0);
            const rope = this._mat(0x8d6e63, 0.9, 0);

            // Casco principal (forma de barco)
            const hull = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.7, 1.6), wood);
            hull.position.y = 0.2;
            hull.castShadow = true;
            g.add(hull);

            // Proa pontuda
            const bow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.25), wood);
            bow.position.set(2.35, 0.18, 0);
            bow.rotation.z = -0.42;
            bow.castShadow = true;
            g.add(bow);

            // Popa
            const stern = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 1.35), wood);
            stern.position.set(-2.2, 0.15, 0);
            stern.rotation.z = 0.28;
            g.add(stern);

            // Bordas
            const railL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 0.1), dark);
            railL.position.set(0.1, 0.52, 0.72);
            g.add(railL);
            const railR = railL.clone();
            railR.position.z = -0.72;
            g.add(railR);

            // Convés
            const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.2), this._mat(0x8d6e63, 0.8));
            deck.position.y = 0.48;
            g.add(deck);

            // Mastro principal
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.0, 6), dark);
            mast.position.set(-0.2, 2.2, 0);
            mast.castShadow = true;
            g.add(mast);

            // Verge (travessa da vela)
            const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), dark);
            yard.rotation.z = Math.PI / 2;
            yard.position.set(-0.15, 3.5, 0);
            g.add(yard);

            // Vela principal (triângulo)
            const sailGeo = new THREE.BufferGeometry();
            sailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                0, 0, 0,
                0, 2.8, 0,
                1.9, 1.1, 0
            ]), 3));
            sailGeo.computeVertexNormals();
            const mainSail = new THREE.Mesh(sailGeo, sail);
            mainSail.position.set(-0.15, 0.9, 0.06);
            mainSail.rotation.y = 0.12;
            g.add(mainSail);

            // Vela menor (jib)
            const jibGeo = new THREE.BufferGeometry();
            jibGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                0, 0, 0,
                0, 1.6, 0,
                1.2, 0.5, 0
            ]), 3));
            jibGeo.computeVertexNormals();
            const jib = new THREE.Mesh(jibGeo, sail);
            jib.position.set(1.4, 1.0, 0.05);
            jib.rotation.y = -0.25;
            g.add(jib);

            // Leme
            const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.35), dark);
            rudder.position.set(-2.55, 0.1, 0);
            g.add(rudder);

            // Cabine pequena
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.9), this._mat(0x5d4037));
            cabin.position.set(-1.1, 0.75, 0);
            cabin.castShadow = true;
            g.add(cabin);
            const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.0), dark);
            cabinRoof.position.set(-1.1, 1.05, 0);
            g.add(cabinRoof);

            return g;
        }

        // ---------- Barco de pesca ----------
        _createFishingBoat() {
            const g = new THREE.Group();
            const wood = this._mat(0x795548);
            const dark = this._mat(0x4e342e);
            const accent = this._mat(0x1565c0, 0.7, 0.1);

            // Casco mais largo e baixo
            const hull = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.65, 1.8), wood);
            hull.position.y = 0.18;
            hull.castShadow = true;
            g.add(hull);

            const bow = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 1.4), wood);
            bow.position.set(2.05, 0.15, 0);
            bow.rotation.z = -0.38;
            g.add(bow);

            const stern = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 1.5), wood);
            stern.position.set(-1.95, 0.12, 0);
            stern.rotation.z = 0.22;
            g.add(stern);

            // Bordas coloridas
            const railL = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.1), accent);
            railL.position.set(0, 0.48, 0.82);
            g.add(railL);
            const railR = railL.clone();
            railR.position.z = -0.82;
            g.add(railR);

            // Convés
            const deck = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.07, 1.4), this._mat(0xa1887f, 0.8));
            deck.position.y = 0.45;
            g.add(deck);

            // Mastro curto
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 5), dark);
            mast.position.set(0.3, 1.55, 0);
            mast.castShadow = true;
            g.add(mast);

            // Vela simples
            const sailMat = this._mat(0xeceff1, 0.7, 0);
            const sailGeo = new THREE.BufferGeometry();
            sailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                0, 0, 0,  0, 2.0, 0,  1.4, 0.7, 0
            ]), 3));
            sailGeo.computeVertexNormals();
            const sail = new THREE.Mesh(sailGeo, sailMat);
            sail.position.set(0.35, 0.7, 0.05);
            g.add(sail);

            // Redes / caixas de pesca
            const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.45), this._mat(0x5d4037));
            crate1.position.set(-0.9, 0.62, 0.35);
            g.add(crate1);
            const crate2 = crate1.clone();
            crate2.position.set(-0.9, 0.62, -0.35);
            g.add(crate2);

            // Âncora decorativa
            const anchor = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 10), this._mat(0x455a64, 0.5, 0.4));
            anchor.position.set(1.6, 0.55, 0.55);
            anchor.rotation.x = Math.PI / 2;
            g.add(anchor);

            // Banco
            const bench = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 1.2), dark);
            bench.position.set(0.6, 0.52, 0);
            g.add(bench);

            return g;
        }

        // ---------- Canoa ----------
        _createCanoe() {
            const g = new THREE.Group();
            const wood = this._mat(0x5d4037);
            const dark = this._mat(0x3e2723);

            // Casco estreito e longo
            const hull = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.4, 0.95), wood);
            hull.position.y = 0.12;
            hull.castShadow = true;
            g.add(hull);

            // Pontas (proa e popa simétricas)
            const tipGeo = new THREE.BoxGeometry(0.9, 0.32, 0.75);
            const bow = new THREE.Mesh(tipGeo, wood);
            bow.position.set(2.2, 0.1, 0);
            bow.rotation.z = -0.5;
            g.add(bow);
            const stern = new THREE.Mesh(tipGeo, wood);
            stern.position.set(-2.2, 0.1, 0);
            stern.rotation.z = 0.5;
            g.add(stern);

            // Interior oco (mais escuro)
            const inner = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 0.7), dark);
            inner.position.y = 0.22;
            g.add(inner);

            // Bancos transversais
            for (let i = -1; i <= 1; i++) {
                const seat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.75), this._mat(0x6d4c41));
                seat.position.set(i * 0.9, 0.32, 0);
                g.add(seat);
            }

            // Remo (decorativo, de um lado)
            const oarShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), dark);
            oarShaft.rotation.z = Math.PI / 2;
            oarShaft.rotation.y = 0.3;
            oarShaft.position.set(0.4, 0.45, 0.7);
            g.add(oarShaft);
            const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.25), wood);
            oarBlade.position.set(1.4, 0.45, 0.85);
            oarBlade.rotation.y = 0.3;
            g.add(oarBlade);

            return g;
        }

        // ---------- Jangada ----------
        _createRaft() {
            const g = new THREE.Group();
            const wood = this._mat(0x8d6e63);
            const rope = this._mat(0x6d4c41, 0.95, 0);

            // Tábuas principais (várias paralelas)
            for (let i = -2; i <= 2; i++) {
                const plank = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.38), wood);
                plank.position.set(0, 0.08, i * 0.42);
                plank.castShadow = true;
                g.add(plank);
            }

            // Travessas
            for (let i = -1; i <= 1; i++) {
                const cross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 2.1), this._mat(0x5d4037));
                cross.position.set(i * 1.1, 0.06, 0);
                g.add(cross);
            }

            // Cordas (cilindros finos)
            for (let i = -2; i <= 2; i++) {
                const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.0, 5), rope);
                r.rotation.x = Math.PI / 2;
                r.position.set(i * 0.7, 0.2, 0);
                g.add(r);
            }

            // Mastro simples + vela improvisada
            const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 5), this._mat(0x4e342e));
            mast.position.set(0, 1.3, 0);
            mast.castShadow = true;
            g.add(mast);

            const sailMat = this._mat(0xfff8e1, 0.8, 0);
            const sailGeo = new THREE.BufferGeometry();
            sailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                0, 0, 0,  0, 1.8, 0,  1.3, 0.6, 0
            ]), 3));
            sailGeo.computeVertexNormals();
            const sail = new THREE.Mesh(sailGeo, sailMat);
            sail.position.set(0.05, 0.5, 0.04);
            g.add(sail);

            // Caixa / baú no centro
            const chest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.55), this._mat(0x5d4037));
            chest.position.set(-0.8, 0.4, 0);
            g.add(chest);

            return g;
        }

        // ---------- Barco mercante (maior) ----------
        _createMerchantBoat() {
            const g = new THREE.Group();
            const wood = this._mat(0x6d4c41);
            const dark = this._mat(0x3e2723);
            const sail = this._mat(0xe8eaf6, 0.7, 0);
            const gold = this._mat(0xc9a227, 0.5, 0.3);

            // Casco largo
            const hull = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.85, 2.0), wood);
            hull.position.y = 0.25;
            hull.castShadow = true;
            g.add(hull);

            const bow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 1.55), wood);
            bow.position.set(2.85, 0.22, 0);
            bow.rotation.z = -0.4;
            g.add(bow);

            const stern = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.7), wood);
            stern.position.set(-2.7, 0.2, 0);
            stern.rotation.z = 0.25;
            g.add(stern);

            // Bordas altas
            const railL = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 0.12), dark);
            railL.position.set(0, 0.65, 0.92);
            g.add(railL);
            const railR = railL.clone();
            railR.position.z = -0.92;
            g.add(railR);

            // Convés
            const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.6), this._mat(0x8d6e63));
            deck.position.y = 0.6;
            g.add(deck);

            // Dois mastros
            const mast1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), dark);
            mast1.position.set(0.6, 2.4, 0);
            mast1.castShadow = true;
            g.add(mast1);
            const mast2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6), dark);
            mast2.position.set(-1.4, 2.0, 0);
            mast2.castShadow = true;
            g.add(mast2);

            // Velas
            const makeSail = (w, h, x, y) => {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
                    0, 0, 0,  0, h, 0,  w, h * 0.4, 0
                ]), 3));
                geo.computeVertexNormals();
                const m = new THREE.Mesh(geo, sail);
                m.position.set(x, y, 0.07);
                return m;
            };
            g.add(makeSail(2.0, 3.0, 0.65, 1.0));
            g.add(makeSail(1.5, 2.2, -1.35, 0.9));

            // Cabine traseira
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.3), this._mat(0x5d4037));
            cabin.position.set(-1.8, 1.0, 0);
            cabin.castShadow = true;
            g.add(cabin);
            const roof = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 1.45), dark);
            roof.position.set(-1.8, 1.42, 0);
            g.add(roof);

            // Detalhe dourado na proa
            const figure = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), gold);
            figure.position.set(3.3, 0.45, 0);
            g.add(figure);

            // Caixas de carga
            const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), this._mat(0x795548));
            box1.position.set(0.2, 0.85, 0.4);
            g.add(box1);
            const box2 = box1.clone();
            box2.position.set(0.2, 0.85, -0.4);
            g.add(box2);

            // Leme
            const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.4), dark);
            rudder.position.set(-3.15, 0.15, 0);
            g.add(rudder);

            return g;
        }

        // =====================================================================
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

            for (const g of this._groups) {
                this.scene.remove(g);
                g.traverse(disposeMesh);
            }
            this._groups.length = 0;
            this.boats.length = 0;
        }
    }

    global.BoatSystem = BoatSystem;
})(typeof window !== 'undefined' ? window : globalThis);
