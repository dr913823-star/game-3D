/**
 * lojas_npc.js — Lojas temáticas de cada NPC da vila
 *
 * API:
 *   getNpcShop(npcId | profession) → { id, title, subtitle, icon, catalog }
 *   NPC_SHOPS — mapa completo
 */
(function (global) {
    'use strict';

    function item(id, name, desc, icon, price, type, extra) {
        return Object.assign({ id, name, desc, icon, price, type }, extra || {});
    }

    // As lojas agora exibem somente armas e itens que realmente alteram
    // Vida (HP), Vigor/Stamina, Mana ou XP. Itens utilitários, tesouros,
    // mapas, vendas e upgrades de dano ficam fora das lojas.
    function filterAllowedShopItems(catalog) {
        return (catalog || []).filter(it => {
            if (!it) return false;
            if (it.type === 'weapon') return true;
            // Armaduras aumentam HP máximo, portanto permanecem disponíveis.
            if (it.type === 'armor' || it.maxHp != null || it.hpBonus != null) return true;
            if (it.heal != null || it.effect === 'heal' || it.effect === 'heal_full' || it.effect === 'antidote') return true;
            if (it.xp != null || it.effect === 'xp' || it.type === 'xp_scroll') return true;
            if (it.mana != null || it.manaBonus != null || it.maxMana != null || it.effect === 'mana') return true;
            if (it.stamina != null || it.staminaBonus != null || it.maxStamina != null || it.effect === 'stamina' || it.effect === 'vigor') return true;
            return false;
        });
    }

    /** Catálogos por NPC */
    const NPC_SHOPS = {
        npc_ferreiro: {
            id: 'npc_ferreiro',
            title: 'Forja de Borin',
            subtitle: 'Armas, armaduras e melhorias',
            icon: 'fa-hammer',
            profession: 'blacksmith',
            getCatalog() {
                if (typeof getBlacksmithCatalog === 'function') return getBlacksmithCatalog();
                if (typeof BLACKSMITH_CATALOG !== 'undefined') return BLACKSMITH_CATALOG;
                return [];
            }
        },

        npc_curandeira: {
            id: 'npc_curandeira',
            title: 'Ervanário de Elara',
            subtitle: 'Poções, ervas e curas',
            icon: 'fa-mortar-pestle',
            profession: 'healer',
            getCatalog() {
                return filterAllowedShopItems([
                    item('potion', 'Poção de Vida', 'Restaura 45 de HP', 'fa-flask', 25, 'item', { effect: 'heal', heal: 45 }),
                    item('potion_big', 'Poção Maior', 'Restaura 80 de HP', 'fa-flask', 55, 'item', { effect: 'heal', heal: 80 }),
                    item('potion_full', 'Elixir Completo', 'Restaura todo o HP', 'fa-flask-vial', 120, 'item', { effect: 'heal_full' }),
                    item('antidote', 'Antídoto', 'Remove veneno e restaura 20 HP', 'fa-prescription-bottle', 35, 'item', { effect: 'antidote', heal: 20 }),
                    item('herb_bundle', 'Maço de Ervas', 'Material de cura · +15 HP ao usar', 'fa-leaf', 15, 'item', { effect: 'heal', heal: 15 }),
                    item('bandage', 'Bandagem', 'Cura rápida · restaura 30 HP', 'fa-band-aid', 18, 'item', { effect: 'heal', heal: 30 }),
                    item('blessing', 'Bênção de Elara', '+10 HP máximo permanente', 'fa-hand-holding-heart', 150, 'upgrade_hp_small', { hpBonus: 10 })
                ]);
            }
        },

        npc_comerciante: {
            id: 'npc_comerciante',
            title: 'Tenda de Vessa',
            subtitle: 'Mercadorias raras e curiosidades',
            icon: 'fa-store',
            profession: 'merchant',
            getCatalog() {
                return filterAllowedShopItems([
                    item('potion', 'Poção de Vida', 'Restaura 45 de HP', 'fa-flask', 30, 'item', { effect: 'heal', heal: 45 }),
                    item('torch', 'Tocha Encantada', 'Ilumina o caminho por 60s', 'fa-fire', 40, 'item', { effect: 'torch' }),
                    item('map_fragment', 'Fragmento de Mapa', 'Pista sobre tesouros do vale', 'fa-map', 60, 'item', { effect: 'map_treasure' }),
                    item('lucky_charm', 'Amuleto da Sorte', '+5% ouro em drops (permanente)', 'fa-clover', 90, 'item', { effect: 'lucky_charm' }),
                    item('spice', 'Especiarias do Sul', 'Venda rápida: recupera 55 ouro', 'fa-mortar-pestle', 45, 'item', { effect: 'sell', sellGold: 55 }),
                    item('silk', 'Tecido Élfico', 'Venda rápida: recupera 85 ouro', 'fa-scroll', 70, 'item', { effect: 'sell', sellGold: 85 }),
                    item('mystery_box', 'Caixa Misteriosa', 'Surpresa aleatória!', 'fa-box-open', 100, 'mystery')
                ]);
            }
        },

        npc_fazendeiro: {
            id: 'npc_fazendeiro',
            title: 'Barraca de Tomás',
            subtitle: 'Comida fresca e suprimentos da fazenda',
            icon: 'fa-seedling',
            profession: 'farmer',
            getCatalog() {
                return filterAllowedShopItems([
                    item('bread', 'Pão Caseiro', 'Restaura 25 de HP', 'fa-bread-slice', 12, 'item', { effect: 'heal', heal: 25 }),
                    item('apple', 'Maçã Madura', 'Restaura 15 de HP', 'fa-apple-whole', 8, 'item', { effect: 'heal', heal: 15 }),
                    item('stew', 'Ensopado da Vila', 'Restaura 50 de HP', 'fa-bowl-food', 28, 'item', { effect: 'heal', heal: 50 }),
                    item('cheese', 'Queijo de Cabra', 'Restaura 20 de HP', 'fa-cheese', 14, 'item', { effect: 'heal', heal: 20 }),
                    item('ration', 'Ração de Viagem', 'Restaura 35 de HP', 'fa-basket-shopping', 22, 'item', { effect: 'heal', heal: 35 }),
                    item('hay', 'Feno Seco', 'Venda rápida: recupera 12 ouro', 'fa-wheat-awn', 10, 'item', { effect: 'sell', sellGold: 12 })
                ]);
            }
        },

        npc_guarda: {
            id: 'npc_guarda',
            title: 'Posto do Capitão Roric',
            subtitle: 'Equipamento de guarda e suprimentos de patrulha',
            icon: 'fa-shield-halved',
            profession: 'guard',
            getCatalog() {
                return filterAllowedShopItems([
                    item('potion', 'Poção de Patrulha', 'Restaura 40 de HP', 'fa-flask', 28, 'item', { effect: 'heal', heal: 40 }),
                    item('ration_guard', 'Ração Militar', 'Restaura 35 de HP', 'fa-box', 20, 'item', { effect: 'heal', heal: 35 }),
                    item('whetstone_guard', 'Pedra de Amolar', '+5 dano na arma atual', 'fa-gem', 65, 'upgrade_damage_small', { dmgBonus: 5 }),
                    item('shield_polish', 'Polimento de Escudo', '+10 HP máximo', 'fa-shield', 75, 'upgrade_hp_small', { hpBonus: 10 }),
                    item('alert_horn', 'Chifre de Alerta', 'Assusta inimigos próximos (5s)', 'fa-bullhorn', 50, 'item', { effect: 'horn' }),
                    item('map_danger', 'Mapa de Perigos', 'Marca zonas de monstros no vale', 'fa-map-location-dot', 55, 'item', { effect: 'map_danger' })
                ]);
            }
        },

        npc_marcus: {
            id: 'npc_marcus',
            title: 'Santuário do Ancião',
            subtitle: 'Bênçãos, relíquias e orientações',
            icon: 'fa-book-open',
            profession: 'elder',
            getCatalog() {
                return filterAllowedShopItems([
                    item('blessing_minor', 'Bênção Menor', '+15 HP máximo', 'fa-hands-praying', 80, 'upgrade_hp_small', { hpBonus: 15 }),
                    item('wisdom_scroll', 'Pergaminho de Sabedoria', '+50 XP ao usar', 'fa-scroll', 70, 'xp_scroll', { xp: 50 }),
                    item('village_token', 'Token da Vila', 'Símbolo de confiança · +20 ouro ao apresentar', 'fa-medal', 40, 'item', { effect: 'sell', sellGold: 20 }),
                    item('potion_holy', 'Água Sagrada', 'Restaura 60 de HP', 'fa-droplet', 45, 'item', { effect: 'heal', heal: 60 }),
                    item('relic_shard', 'Fragmento de Relíquia', 'Material sagrado · +30 XP ao contemplar', 'fa-gem', 95, 'item', { effect: 'xp', xp: 30 }),
                    item('guidance', 'Orientação do Ancião', '+1 Skill Point', 'fa-star', 200, 'skill_point')
                ]);
            }
        }
        // Lila (criança) não tem loja
    };

    // Alias por profissão
    const BY_PROFESSION = {};
    for (const shop of Object.values(NPC_SHOPS)) {
        if (shop.profession) BY_PROFESSION[shop.profession] = shop;
    }

    function getNpcShop(key) {
        if (!key) return null;
        if (NPC_SHOPS[key]) return NPC_SHOPS[key];
        if (BY_PROFESSION[key]) return BY_PROFESSION[key];
        // tenta prefixo npc_
        if (NPC_SHOPS['npc_' + key]) return NPC_SHOPS['npc_' + key];
        return null;
    }

    function hasNpcShop(key) {
        return !!getNpcShop(key);
    }

    // =========================================================================
    // PRÉDIOS DE LOJA (estilo forja do ferreiro)
    // =========================================================================
    // Posições = antigas casas da vila (anel ~raio 20, porta virada ao poço)
    // Forja de Borin fica em (-16.2, 11.8) via BlacksmithShop
    const SHOP_BUILDING_DEFS = [
        {
            shopKey: 'npc_comerciante',
            name: 'Tenda de Vessa',
            label: 'Abrir Tenda',
            x: 20.0, z: 0.0,
            rotY: -1.5708,
            style: 'merchant',
            wallColor: 0xd4a574,
            roofColor: 0xb45309,
            accent: 0xfbbf24
        },
        {
            shopKey: 'npc_guarda',
            name: 'Posto do Capitão',
            label: 'Abrir Posto',
            x: 16.2, z: 11.8,
            rotY: -2.2003,
            style: 'guard',
            wallColor: 0x8b7355,
            roofColor: 0x3f3f46,
            accent: 0x60a5fa
        },
        {
            shopKey: 'npc_marcus',
            name: 'Santuário do Ancião',
            label: 'Abrir Santuário',
            x: 6.2, z: 19.0,
            rotY: -2.8262,
            style: 'elder',
            wallColor: 0xa8a29e,
            roofColor: 0x57534e,
            accent: 0xfde68a
        },
        {
            shopKey: 'npc_curandeira',
            name: 'Ervanário de Elara',
            label: 'Abrir Ervanário',
            x: -6.2, z: 19.0,
            rotY: 2.8262,
            style: 'healer',
            wallColor: 0xc4b5a0,
            roofColor: 0x4a7c59,
            accent: 0x86efac
        },
        {
            // slot oeste — opcionalmente deixa vazio; usamos para reforçar anel
            shopKey: 'npc_fazendeiro',
            name: 'Barraca de Tomás',
            label: 'Abrir Barraca',
            x: -20.0, z: 0.0,
            rotY: 1.5708,
            style: 'farmer',
            wallColor: 0xb8a070,
            roofColor: 0x78716c,
            accent: 0xa3e635
        }
        // Casas restantes do anel (sul/sudeste) ficam livres — sem loja da Lila
    ];

    class NpcShopBuilding {
        constructor(scene, world, def) {
            if (!scene) throw new Error('[NpcShopBuilding] scene obrigatória');
            this.scene = scene;
            this.world = world;
            this.def = def;
            this.shopKey = def.shopKey;
            this.x = def.x;
            this.z = def.z;
            this.scale = def.scale || 1;
            // Porta virada para o poço (0,0)
            this.rotY = def.rotY != null
                ? def.rotY
                : Math.atan2(this.x, this.z) + Math.PI;
            this._group = null;
            this._fx = [];
            this._built = false;
        }

        async build() {
            const def = this.def;
            const s = this.scale;
            const group = new THREE.Group();
            group.name = 'npc_shop_' + this.shopKey;

            const groundY = this.world && typeof this.world.getTerrainHeight === 'function'
                ? this.world.getTerrainHeight(this.x, this.z)
                : 0;
            group.position.set(this.x, groundY, this.z);
            group.rotation.y = this.rotY;

            const wood = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.88 });
            const woodDark = new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 });
            const stone = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 });
            const plaster = new THREE.MeshStandardMaterial({ color: def.wallColor || 0xb8a890, roughness: 0.92 });
            const roofMat = new THREE.MeshStandardMaterial({ color: def.roofColor || 0x7c2d12, roughness: 0.75 });
            const accentMat = new THREE.MeshStandardMaterial({
                color: def.accent || 0xfbbf24,
                emissive: def.accent || 0xfbbf24,
                emissiveIntensity: 0.25,
                roughness: 0.5
            });

            const w = 6.2 * s;
            const d = 5.4 * s;
            const wallH = 3.2 * s;

            // Fundação
            const foundation = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.4 * s, d + 0.5), stone);
            foundation.position.y = 0.2 * s;
            foundation.castShadow = true;
            foundation.receiveShadow = true;
            group.add(foundation);

            // Paredes
            const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), plaster);
            walls.position.y = 0.4 * s + wallH * 0.5;
            walls.castShadow = true;
            walls.receiveShadow = true;
            group.add(walls);

            // Vigas fachada
            for (const yy of [1.0 * s, 2.0 * s, 3.0 * s]) {
                const beam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.16 * s, 0.2 * s), wood);
                beam.position.set(0, yy, d * 0.5 + 0.05);
                group.add(beam);
            }

            // Telhado
            if (def.style === 'merchant') {
                // Tenda / toldo
                const canopy = new THREE.Mesh(
                    new THREE.BoxGeometry(w + 1.2, 0.12 * s, d + 0.8),
                    roofMat
                );
                canopy.position.y = 0.4 * s + wallH + 0.3 * s;
                canopy.rotation.x = -0.08;
                canopy.castShadow = true;
                group.add(canopy);
                // Postes da tenda
                for (const sx of [-1, 1]) {
                    const post = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.08 * s, 0.1 * s, wallH + 0.6 * s, 6),
                        woodDark
                    );
                    post.position.set(sx * (w * 0.45), 0.4 * s + (wallH + 0.6 * s) * 0.5, d * 0.55);
                    group.add(post);
                }
            } else if (def.style === 'elder') {
                const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, 2.4 * s, 6), roofMat);
                roof.position.y = 0.4 * s + wallH + 1.0 * s;
                roof.castShadow = true;
                group.add(roof);
            } else {
                const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 2.2 * s, 4), roofMat);
                roof.position.y = 0.4 * s + wallH + 0.95 * s;
                roof.rotation.y = Math.PI / 4;
                roof.castShadow = true;
                group.add(roof);
            }

            // Chaminé (exceto criança e comerciante)
            if (def.style !== 'child' && def.style !== 'merchant') {
                const chimney = new THREE.Mesh(
                    new THREE.BoxGeometry(0.9 * s, 2.4 * s, 0.9 * s),
                    stone
                );
                chimney.position.set(-w * 0.28, 0.4 * s + wallH + 1.0 * s, -d * 0.2);
                chimney.castShadow = true;
                group.add(chimney);
            }

            // Porta
            const door = new THREE.Mesh(
                new THREE.BoxGeometry(1.3 * s, 2.2 * s, 0.12 * s),
                woodDark
            );
            door.position.set(0, 1.3 * s, d * 0.5 + 0.04);
            door.castShadow = true;
            group.add(door);

            // Maçaneta
            const handle = new THREE.Mesh(
                new THREE.SphereGeometry(0.06 * s, 6, 6),
                new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.7, roughness: 0.3 })
            );
            handle.position.set(0.4 * s, 1.3 * s, d * 0.5 + 0.12);
            group.add(handle);

            // Janelas com cor de destaque
            for (const wx of [-1.8 * s, 1.8 * s]) {
                const frame = new THREE.Mesh(
                    new THREE.BoxGeometry(1.0 * s, 0.9 * s, 0.1 * s),
                    woodDark
                );
                frame.position.set(wx, 2.1 * s, d * 0.5 + 0.03);
                group.add(frame);
                const glass = new THREE.Mesh(
                    new THREE.BoxGeometry(0.8 * s, 0.7 * s, 0.06 * s),
                    accentMat
                );
                glass.position.set(wx, 2.1 * s, d * 0.5 + 0.08);
                group.add(glass);
                this._fx.push(glass);
            }

            // Detalhe frontal por estilo
            this._addStyleProps(group, def, s, d, wood, woodDark, stone, accentMat);

            // Placa com nome
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(30,20,10,0.92)';
            ctx.fillRect(0, 0, 320, 64);
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 3;
            ctx.strokeRect(3, 3, 314, 58);
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#fbbf24';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const title = (def.name || 'LOJA').toUpperCase();
            ctx.fillText(title.length > 22 ? title.slice(0, 20) + '…' : title, 160, 32);
            const tex = new THREE.CanvasTexture(canvas);
            const label = new THREE.Mesh(
                new THREE.PlaneGeometry(2.6 * s, 0.52 * s),
                new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
            );
            label.position.set(0, 3.15 * s, d * 0.5 + 0.15);
            group.add(label);
            this._label = label;

            this.scene.add(group);
            this._group = group;
            this._built = true;

            if (this.world && Array.isArray(this.world.colliders)) {
                this.world.colliders.push({
                    x: this.x, z: this.z,
                    radius: 4.2 * s,
                    type: 'npc_shop_' + this.shopKey
                });
            }
        }

        _addStyleProps(group, def, s, d, wood, woodDark, stone, accentMat) {
            const frontZ = d * 0.5 + 0.9 * s;
            if (def.style === 'healer') {
                // Mesa de ervas + vasos
                const table = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 0.7 * s, 0.7 * s), wood);
                table.position.set(-1.6 * s, 0.55 * s, frontZ);
                group.add(table);
                for (let i = 0; i < 3; i++) {
                    const pot = new THREE.Mesh(
                        new THREE.CylinderGeometry(0.15 * s, 0.18 * s, 0.35 * s, 8),
                        new THREE.MeshStandardMaterial({ color: 0x4ade80 })
                    );
                    pot.position.set(-1.9 * s + i * 0.35 * s, 1.05 * s, frontZ);
                    group.add(pot);
                }
                const mortar = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.22 * s, 0.2 * s, 0.25 * s, 10),
                    stone
                );
                mortar.position.set(1.4 * s, 0.35 * s, frontZ);
                group.add(mortar);
            } else if (def.style === 'merchant') {
                // Caixotes e barril
                for (let i = 0; i < 3; i++) {
                    const box = new THREE.Mesh(
                        new THREE.BoxGeometry(0.55 * s, 0.45 * s, 0.55 * s),
                        wood
                    );
                    box.position.set(-1.5 * s + i * 0.7 * s, 0.35 * s, frontZ);
                    box.rotation.y = i * 0.2;
                    group.add(box);
                }
                const barrel = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.35 * s, 0.38 * s, 0.7 * s, 10),
                    woodDark
                );
                barrel.position.set(1.8 * s, 0.45 * s, frontZ);
                group.add(barrel);
            } else if (def.style === 'farmer') {
                // Sacos e cercado
                for (let i = 0; i < 2; i++) {
                    const sack = new THREE.Mesh(
                        new THREE.SphereGeometry(0.35 * s, 8, 6),
                        new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 1 })
                    );
                    sack.scale.y = 0.7;
                    sack.position.set(-1.4 * s + i * 0.7 * s, 0.3 * s, frontZ);
                    group.add(sack);
                }
                const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.5 * s, 0.7 * s), wood);
                crate.position.set(1.5 * s, 0.35 * s, frontZ);
                group.add(crate);
            } else if (def.style === 'guard') {
                // Escudo e bandeira
                const shield = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 0.08 * s, 6),
                    accentMat
                );
                shield.rotation.x = Math.PI / 2;
                shield.position.set(-1.5 * s, 1.2 * s, frontZ - 0.2 * s);
                group.add(shield);
                const pole = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 2.4 * s, 6),
                    woodDark
                );
                pole.position.set(1.6 * s, 1.3 * s, frontZ);
                group.add(pole);
                const flag = new THREE.Mesh(
                    new THREE.BoxGeometry(0.7 * s, 0.45 * s, 0.04 * s),
                    accentMat
                );
                flag.position.set(1.95 * s, 2.2 * s, frontZ);
                group.add(flag);
            } else if (def.style === 'elder') {
                // Pedestal e livro
                const pedestal = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.35 * s, 0.4 * s, 0.9 * s, 8),
                    stone
                );
                pedestal.position.set(0, 0.55 * s, frontZ);
                group.add(pedestal);
                const book = new THREE.Mesh(
                    new THREE.BoxGeometry(0.45 * s, 0.1 * s, 0.35 * s),
                    accentMat
                );
                book.position.set(0, 1.05 * s, frontZ);
                group.add(book);
            } else if (def.style === 'child') {
                // Caixa de brinquedos
                const toyBox = new THREE.Mesh(
                    new THREE.BoxGeometry(1.2 * s, 0.6 * s, 0.8 * s),
                    accentMat
                );
                toyBox.position.set(0, 0.4 * s, frontZ);
                group.add(toyBox);
                const ball = new THREE.Mesh(
                    new THREE.SphereGeometry(0.18 * s, 8, 6),
                    new THREE.MeshStandardMaterial({ color: 0x38bdf8 })
                );
                ball.position.set(0.5 * s, 0.85 * s, frontZ);
                group.add(ball);
            }
        }

        getInteractPoint() {
            const dist = 4.2 * this.scale;
            const fx = this.x + Math.sin(this.rotY) * dist;
            const fz = this.z + Math.cos(this.rotY) * dist;
            return {
                x: fx,
                z: fz,
                radius: 3.5 * this.scale,
                label: this.def.label || ('Abrir ' + (this.def.name || 'Loja')),
                type: 'npc_shop',
                shopKey: this.shopKey
            };
        }

        update(time) {
            this._updSkip = (this._updSkip || 0) + 1;
            if (this._updSkip < 3) return;
            this._updSkip = 0;
            for (let i = 0; i < this._fx.length; i++) {
                const m = this._fx[i];
                if (m.material && m.material.emissiveIntensity != null) {
                    m.material.emissiveIntensity = 0.2 + Math.sin(time * 3 + i) * 0.15;
                }
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
            this._fx = [];
            this._built = false;
        }
    }

    class NpcShopManager {
        constructor(scene, world) {
            this.scene = scene;
            this.world = world;
            this.buildings = [];
        }

        async build() {
            this.dispose();
            for (const def of SHOP_BUILDING_DEFS) {
                const b = new NpcShopBuilding(this.scene, this.world, def);
                await b.build();
                this.buildings.push(b);
            }
        }

        update(time) {
            for (const b of this.buildings) b.update(time);
        }

        getNearInteract(px, pz) {
            for (const b of this.buildings) {
                const ip = b.getInteractPoint();
                const dx = px - ip.x, dz = pz - ip.z;
                if (dx * dx + dz * dz < ip.radius * ip.radius) return ip;
            }
            return null;
        }

        dispose() {
            for (const b of this.buildings) b.dispose();
            this.buildings.length = 0;
        }
    }

    global.NPC_SHOPS = NPC_SHOPS;
    global.getNpcShop = getNpcShop;
    global.hasNpcShop = hasNpcShop;
    global.SHOP_BUILDING_DEFS = SHOP_BUILDING_DEFS;
    global.NpcShopBuilding = NpcShopBuilding;
    global.NpcShopManager = NpcShopManager;

})(typeof window !== 'undefined' ? window : globalThis);
