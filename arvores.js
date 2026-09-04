/**
 * arvores.js — Vegetação instanciada + corte com machado
 *
 * Depende de: THREE (global)
 * API:
 *   const trees = new TreeSystem(scene, world, options);
 *   await trees.build(onProgress);
 *   trees.tryChop(x, z, range) → { chopped, wood, x, z, hitsLeft } | null
 *   trees.update(dt)
 *   trees.dispose();
 */

(function (global) {
    'use strict';

    const _dummy = new THREE.Object3D();
    const _hideMat = new THREE.Matrix4().makeScale(0, 0, 0);

    const DEFAULTS = {
        count: 120,
        minDistFromCenter: 32,
        avoidWallInner: null,
        avoidWallOuter: null,
        areaSize: 260,
        woodPerTree: 2,
        chopHits: 3
    };

    class TreeSystem {
        constructor(scene, world, options = {}) {
            if (!scene) throw new Error('[TreeSystem] scene obrigatória');
            if (!world) throw new Error('[TreeSystem] world obrigatório');

            this.scene = scene;
            this.world = world;
            this.cfg = Object.assign({}, DEFAULTS, options);

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
            this.trees = [];
            this._trunkInst = null;
            this._leafInsts = [];
            this._falling = [];
            this._sharedGeos = null;
            this._sharedMats = null;
        }

        async build(onProgress) {
            const progress = async (pct, msg) => {
                if (typeof onProgress === 'function') await onProgress(pct, msg);
            };

            await progress(50, 'Plantando árvores detalhadas...');

            const count = this.cfg.count;
            const waterLevel = (this.world.cfg && this.world.cfg.waterLevel) || 0.5;

            const trunkGeo = new THREE.CylinderGeometry(0.28, 0.48, 3.2, 7);
            const trunkMat = new THREE.MeshStandardMaterial({
                color: 0x4a3728,
                roughness: 0.92,
                metalness: 0.02
            });
            const leafMatA = new THREE.MeshStandardMaterial({
                color: 0x1b4332, roughness: 0.88, metalness: 0
            });
            const leafMatB = new THREE.MeshStandardMaterial({
                color: 0x2d6a4f, roughness: 0.85, metalness: 0
            });
            const leafGeo1 = new THREE.ConeGeometry(2.6, 3.2, 7);
            const leafGeo2 = new THREE.ConeGeometry(2.0, 2.6, 7);
            const leafGeo3 = new THREE.ConeGeometry(1.35, 2.0, 7);

            this._sharedGeos = { trunkGeo, leafGeo1, leafGeo2, leafGeo3 };
            this._sharedMats = { trunkMat, leafMatA, leafMatB };

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

                _dummy.position.set(rx, ry + 1.55 * s, rz);
                _dummy.scale.set(s, s, s);
                _dummy.rotation.set(0, rot, 0);
                _dummy.updateMatrix();
                trunkInst.setMatrixAt(n, _dummy.matrix);

                _dummy.position.set(rx, ry + 3.4 * s, rz);
                _dummy.scale.set(s, s, s);
                _dummy.updateMatrix();
                leaf1Inst.setMatrixAt(n, _dummy.matrix);

                _dummy.position.set(rx, ry + 4.6 * s, rz);
                _dummy.scale.set(s * 0.95, s, s * 0.95);
                _dummy.updateMatrix();
                leaf2Inst.setMatrixAt(n, _dummy.matrix);

                _dummy.position.set(rx, ry + 5.6 * s, rz);
                _dummy.scale.set(s * 0.9, s, s * 0.9);
                _dummy.updateMatrix();
                leaf3Inst.setMatrixAt(n, _dummy.matrix);

                const col = { x: rx, z: rz, radius: 0.95 * s, type: 'tree', treeIdx: n };
                this.colliders.push(col);
                this.trees.push({
                    x: rx, z: rz, y: ry, s, rot,
                    alive: true,
                    hits: 0,
                    idx: n,
                    collider: col
                });
                n++;
            }

            trunkInst.count = n;
            leaf1Inst.count = n;
            leaf2Inst.count = n;
            leaf3Inst.count = n;
            trunkInst.instanceMatrix.needsUpdate = true;
            leaf1Inst.instanceMatrix.needsUpdate = true;
            leaf2Inst.instanceMatrix.needsUpdate = true;
            leaf3Inst.instanceMatrix.needsUpdate = true;

            this.scene.add(trunkInst, leaf1Inst, leaf2Inst, leaf3Inst);
            this._meshes.push(trunkInst, leaf1Inst, leaf2Inst, leaf3Inst);
            this._trunkInst = trunkInst;
            this._leafInsts = [leaf1Inst, leaf2Inst, leaf3Inst];

            if (Array.isArray(this.world.colliders)) {
                this.world.colliders.push(...this.colliders);
            }

            await progress(58, n + ' árvores plantadas');
        }

        tryChop(x, z, range) {
            range = range == null ? 3.2 : range;
            let best = null;
            let bestD = range * range;
            for (let i = 0; i < this.trees.length; i++) {
                const t = this.trees[i];
                if (!t.alive) continue;
                const dx = t.x - x;
                const dz = t.z - z;
                const d2 = dx * dx + dz * dz;
                if (d2 < bestD) {
                    bestD = d2;
                    best = t;
                }
            }
            if (!best) return null;

            best.hits += 1;
            const need = this.cfg.chopHits || 3;
            this._shakeInstance(best);

            if (best.hits < need) {
                return {
                    chopped: false,
                    wood: 0,
                    x: best.x,
                    z: best.z,
                    hitsLeft: need - best.hits
                };
            }

            best.alive = false;
            this._hideInstance(best.idx);
            this._removeCollider(best);
            this._spawnFallAnimation(best);

            const wood = this.cfg.woodPerTree || 2;
            return {
                chopped: true,
                wood: wood,
                x: best.x,
                z: best.z,
                hitsLeft: 0
            };
        }

        _shakeInstance(tree) {
            if (!this._trunkInst) return;
            const idx = tree.idx;
            const s = tree.s;
            const lean = (Math.random() - 0.5) * 0.18;
            const lean2 = (Math.random() - 0.5) * 0.12;
            const self = this;

            const applyPose = function (trunkLean, leafLean) {
                _dummy.position.set(tree.x, tree.y + 1.55 * s, tree.z);
                _dummy.scale.set(s, s, s);
                _dummy.rotation.set(trunkLean, tree.rot, trunkLean * 0.5);
                _dummy.updateMatrix();
                self._trunkInst.setMatrixAt(idx, _dummy.matrix);
                self._trunkInst.instanceMatrix.needsUpdate = true;

                if (self._leafInsts) {
                    const leafYs = [3.4, 4.6, 5.6];
                    const leafScales = [1, 0.95, 0.9];
                    for (let li = 0; li < self._leafInsts.length; li++) {
                        const inst = self._leafInsts[li];
                        if (!inst) continue;
                        const sc = leafScales[li] || 1;
                        _dummy.position.set(tree.x, tree.y + leafYs[li] * s, tree.z);
                        _dummy.scale.set(s * sc, s, s * sc);
                        _dummy.rotation.set(leafLean, tree.rot, leafLean * 0.4);
                        _dummy.updateMatrix();
                        inst.setMatrixAt(idx, _dummy.matrix);
                        inst.instanceMatrix.needsUpdate = true;
                    }
                }
            };

            applyPose(lean, lean2);

            setTimeout(function () {
                if (!tree.alive || !self._trunkInst) return;
                applyPose(0, 0);
            }, 140);
        }

        _hideInstance(idx) {
            const insts = [this._trunkInst].concat(this._leafInsts);
            for (let i = 0; i < insts.length; i++) {
                const m = insts[i];
                if (!m) continue;
                m.setMatrixAt(idx, _hideMat);
                m.instanceMatrix.needsUpdate = true;
            }
        }

        _removeCollider(tree) {
            if (tree.collider) {
                tree.collider.radius = 0;
                tree.collider.type = 'tree_stump';
            }
            if (Array.isArray(this.world.colliders)) {
                const i = this.world.colliders.indexOf(tree.collider);
                if (i >= 0) this.world.colliders.splice(i, 1);
            }
        }

        _spawnFallAnimation(tree) {
            const s = tree.s;
            const geos = this._sharedGeos;
            const mats = this._sharedMats;
            if (!geos || !mats) return;

            const group = new THREE.Group();
            group.position.set(tree.x, tree.y, tree.z);
            group.rotation.y = tree.rot;
            group.userData.baseY = tree.y;

            const trunk = new THREE.Mesh(geos.trunkGeo, mats.trunkMat.clone());
            trunk.position.y = 1.55 * s;
            trunk.scale.setScalar(s);
            trunk.castShadow = true;
            group.add(trunk);

            const leaf1 = new THREE.Mesh(geos.leafGeo1, mats.leafMatA.clone());
            leaf1.position.y = 3.4 * s;
            leaf1.scale.setScalar(s);
            leaf1.castShadow = true;
            group.add(leaf1);

            const leaf2 = new THREE.Mesh(geos.leafGeo2, mats.leafMatB.clone());
            leaf2.position.y = 4.6 * s;
            leaf2.scale.set(s * 0.95, s, s * 0.95);
            leaf2.castShadow = true;
            group.add(leaf2);

            const leaf3 = new THREE.Mesh(geos.leafGeo3, mats.leafMatA.clone());
            leaf3.position.y = 5.6 * s;
            leaf3.scale.set(s * 0.9, s, s * 0.9);
            leaf3.castShadow = true;
            group.add(leaf3);

            const fallAng = Math.random() * Math.PI * 2;
            this.scene.add(group);
            this._falling.push({
                group: group,
                t: 0,
                duration: 1.15,
                fallAng: fallAng,
                s: s,
                done: false
            });
        }

        update(dt) {
            if (!this._falling.length) return;
            for (let i = this._falling.length - 1; i >= 0; i--) {
                const f = this._falling[i];
                if (f.done) {
                    this._falling.splice(i, 1);
                    continue;
                }
                f.t += dt;
                const p = Math.min(1, f.t / f.duration);
                const ease = p * p;
                const tilt = ease * (Math.PI / 2) * 0.95;
                f.group.rotation.z = Math.cos(f.fallAng) * tilt;
                f.group.rotation.x = Math.sin(f.fallAng) * tilt;
                if (p > 0.7) {
                    const fade = (p - 0.7) / 0.3;
                    const baseY = f.group.userData.baseY || 0;
                    f.group.position.y = baseY - fade * 0.4;
                    f.group.traverse(function (o) {
                        if (o.material && o.material.opacity != null) {
                            o.material.transparent = true;
                            o.material.opacity = 1 - fade;
                        }
                    });
                }
                if (p >= 1) {
                    f.done = true;
                    this.scene.remove(f.group);
                    f.group.traverse(function (o) {
                        if (o.material) o.material.dispose && o.material.dispose();
                    });
                    this._falling.splice(i, 1);
                }
            }
        }

        dispose() {
            for (let i = 0; i < this._falling.length; i++) {
                this.scene.remove(this._falling[i].group);
            }
            this._falling.length = 0;
            for (let i = 0; i < this._meshes.length; i++) {
                const m = this._meshes[i];
                this.scene.remove(m);
                if (m.geometry) m.geometry.dispose();
                if (m.material) m.material.dispose();
            }
            this._meshes.length = 0;
            this.colliders.length = 0;
            this.trees.length = 0;
        }
    }

    global.TreeSystem = TreeSystem;
})(typeof window !== 'undefined' ? window : globalThis);
