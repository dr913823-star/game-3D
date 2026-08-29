/**
 * arvores.js — Vegetação instanciada de alta qualidade
 * Árvores com tronco, copa em camadas e variação procedural
 *
 * Depende de: THREE (global)
 * API:
 *   const trees = new TreeSystem(scene, world, options);
 *   await trees.build(onProgress);
 *   trees.dispose();
 */

(function (global) {
    'use strict';

    const _dummy = new THREE.Object3D();

    const DEFAULTS = {
        count: 120,
        minDistFromCenter: 32,
        avoidWallInner: null,  // preenchido pelo world.cfg se houver
        avoidWallOuter: null,
        areaSize: 260
    };

    class TreeSystem {
        /**
         * @param {THREE.Scene} scene
         * @param {object} world - WorldMap (getTerrainHeight, cfg)
         * @param {object} [options]
         */
        constructor(scene, world, options = {}) {
            if (!scene) throw new Error('[TreeSystem] scene obrigatória');
            if (!world) throw new Error('[TreeSystem] world obrigatório');

            this.scene = scene;
            this.world = world;
            this.cfg = Object.assign({}, DEFAULTS, options);

            // Usa config do muro se existir
            if (world.cfg) {
                if (this.cfg.avoidWallInner == null && world.cfg.wallRadius) {
                    this.cfg.avoidWallInner = world.cfg.wallRadius - 6;
                    this.cfg.avoidWallOuter = world.cfg.wallRadius + 8;
                }
                if (world.cfg.villageRadius) {
                    this.cfg.minDistFromCenter = world.cfg.villageRadius + 2;
                }
            }

            this._meshes = [];
            this.colliders = [];
        }

        /**
         * @param {function(number,string):Promise|void} [onProgress]
         */
        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(50, 'Plantando árvores detalhadas...');

            const count = this.cfg.count;
            const waterLevel = (this.world.cfg && this.world.cfg.waterLevel) || 0.5;

            // --- Geometrias compartilhadas ---
            const trunkGeo = new THREE.CylinderGeometry(0.28, 0.48, 3.2, 7);
            const trunkMat = new THREE.MeshStandardMaterial({
                color: 0x4a3728,
                roughness: 0.92,
                metalness: 0.02
            });

            // Copa em 3 camadas (cones empilhados) para visual mais rico
            const leafMatA = new THREE.MeshStandardMaterial({
                color: 0x1b4332, roughness: 0.88, metalness: 0
            });
            const leafMatB = new THREE.MeshStandardMaterial({
                color: 0x2d6a4f, roughness: 0.85, metalness: 0
            });
            const leafGeo1 = new THREE.ConeGeometry(2.6, 3.2, 7);
            const leafGeo2 = new THREE.ConeGeometry(2.0, 2.6, 7);
            const leafGeo3 = new THREE.ConeGeometry(1.35, 2.0, 7);

            const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
            const leaf1Inst = new THREE.InstancedMesh(leafGeo1, leafMatA, count);
            const leaf2Inst = new THREE.InstancedMesh(leafGeo2, leafMatB, count);
            const leaf3Inst = new THREE.InstancedMesh(leafGeo3, leafMatA, count);

            [trunkInst, leaf1Inst, leaf2Inst, leaf3Inst].forEach(m => {
                m.castShadow = true;
                m.receiveShadow = true;
            });

            let n = 0;
            const attempts = count * 4;
            const area = this.cfg.areaSize;
            const minC = this.cfg.minDistFromCenter;
            const wIn = this.cfg.avoidWallInner;
            const wOut = this.cfg.avoidWallOuter;

            for (let i = 0; i < attempts && n < count; i++) {
                const rx = (Math.random() - 0.5) * area;
                const rz = (Math.random() - 0.5) * area;
                const dist = Math.hypot(rx, rz);

                if (dist < minC) continue;
                if (wIn != null && wOut != null && dist > wIn && dist < wOut) continue;

                const ry = this.world.getTerrainHeight(rx, rz);
                if (ry < waterLevel + 0.3) continue;

                const s = 0.7 + Math.random() * 0.65;
                const rot = Math.random() * Math.PI * 2;

                // Tronco
                _dummy.position.set(rx, ry + 1.55 * s, rz);
                _dummy.scale.set(s, s, s);
                _dummy.rotation.set(0, rot, 0);
                _dummy.updateMatrix();
                trunkInst.setMatrixAt(n, _dummy.matrix);

                // Camada 1 (base da copa)
                _dummy.position.set(rx, ry + 3.4 * s, rz);
                _dummy.scale.set(s, s, s);
                _dummy.updateMatrix();
                leaf1Inst.setMatrixAt(n, _dummy.matrix);

                // Camada 2
                _dummy.position.set(rx, ry + 4.6 * s, rz);
                _dummy.scale.set(s * 0.95, s, s * 0.95);
                _dummy.updateMatrix();
                leaf2Inst.setMatrixAt(n, _dummy.matrix);

                // Camada 3 (topo)
                _dummy.position.set(rx, ry + 5.6 * s, rz);
                _dummy.scale.set(s * 0.9, s, s * 0.9);
                _dummy.updateMatrix();
                leaf3Inst.setMatrixAt(n, _dummy.matrix);

                this.colliders.push({ x: rx, z: rz, radius: 0.95 * s, type: 'tree' });
                n++;
            }

            trunkInst.count = n;
            leaf1Inst.count = n;
            leaf2Inst.count = n;
            leaf3Inst.count = n;

            this.scene.add(trunkInst, leaf1Inst, leaf2Inst, leaf3Inst);
            this._meshes.push(trunkInst, leaf1Inst, leaf2Inst, leaf3Inst);

            // Empurra colisões para o world
            if (Array.isArray(this.world.colliders)) {
                this.world.colliders.push(...this.colliders);
            }

            await progress(58, `${n} árvores plantadas`);
        }

        dispose() {
            for (const m of this._meshes) {
                this.scene.remove(m);
                if (m.geometry) m.geometry.dispose();
                if (m.material) m.material.dispose();
            }
            this._meshes.length = 0;
            this.colliders.length = 0;
        }
    }

    global.TreeSystem = TreeSystem;
})(typeof window !== 'undefined' ? window : globalThis);
