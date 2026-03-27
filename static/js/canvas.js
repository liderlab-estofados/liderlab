// Canvas management and module placement
class CanvasManager {
    constructor() {
        this.snapTolerance = 15; // pixels
        this.snapadTolerance = 15; // pixels
        this.pixelsPerMM = 0.2; // Increased scale for better visibility
        this.isDragging = true;
        this.selectedModules = []; // <--- agora é array

        this.init();
    }



    // Centralized function to calculate exact dimensions from database values
    getModuleDimensions(moduleData) {
        const width = Math.round(moduleData.largura * this.pixelsPerMM);
        const height = Math.round(moduleData.profundidade * this.pixelsPerMM);
        return { width, height };
    }

    init() {
        this.setupCanvasEvents();
        // this.setupDropZone();
    }

    setupCanvasEvents() {
        const canvas = document.getElementById('canvasSheet');

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedModules.length > 0) {
                const toDelete = [...this.selectedModules]; // cópia
                this.deselectAllModules();
                toDelete.forEach(m => this.removeModule(m));
            }
        });

        // Canvas click to deselect
        canvas.addEventListener('pointerdown', (ev) => {
            // botão esquerdo apenas
            if (ev.button !== 0) return;

            // ignora se o clique começou sobre um módulo
            const isOnModule = ev.composedPath().some(el =>
                el.classList && el.classList.contains('placed-module')
            );
            if (isOnModule) return;

            ev.preventDefault();

            this.isPanning = false;     // ainda não estamos em pan
            this.isPanCandidate = true; // só um candidato a pan
            this._panStartX = ev.clientX;
            this._panStartY = ev.clientY;

            // usa o container que realmente tem rolagem
            const scrollContainer = canvas.closest('.canvas-container') || canvas.parentElement;
            this._panStartScrollLeft = scrollContainer.scrollLeft;
            this._panStartScrollTop = scrollContainer.scrollTop;

            scrollContainer.style.cursor = 'grabbing';
            if (ev.pointerId) scrollContainer.setPointerCapture?.(ev.pointerId);

            const onPointerMove = (moveEv) => {
                if (this.isPanCandidate) {
                    const moved = Math.abs(moveEv.clientX - this._panStartX) > 3 ||
                        Math.abs(moveEv.clientY - this._panStartY) > 3;

                    if (moved) {
                        this.isPanning = true;      // agora sim inicia pan
                        this.isPanCandidate = false;
                    } else {
                        return; // ainda é clique, não pan
                    }
                }

                // de fato está em pan
                if (!this.isPanning) return;



                const scale = sofaDesigner.zoomLevel || 1;
                const dx = (moveEv.clientX - this._panStartX);
                const dy = (moveEv.clientY - this._panStartY);

                scrollContainer.scrollLeft = this._panStartScrollLeft - dx;
                scrollContainer.scrollTop = this._panStartScrollTop - dy;
            };

            const endPan = (endEv) => {
                // Se não entrou em pan → é clique simples fora
                if (!this.isPanning && this.isPanCandidate) {
                    this.deselectAllModules();
                }

                // encerra qualquer estado
                this.isPanning = false;
                this.isPanCandidate = false;

                scrollContainer.style.cursor = '';
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', endPan);
                if (endEv && endEv.pointerId) scrollContainer.releasePointerCapture?.(endEv.pointerId);
            };

            document.addEventListener('pointermove', onPointerMove, { passive: true });
            document.addEventListener('pointerup', endPan);
            document.addEventListener('pointercancel', endPan);
        });

        // Prevent default drag behavior
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.classList.add('drag-over');
        });

        canvas.addEventListener('dragleave', (e) => {
            if (!canvas.contains(e.relatedTarget)) {
                canvas.classList.remove('drag-over');
            }
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');

            try {
                const moduleData = JSON.parse(e.dataTransfer.getData('application/json'));
                const rect = canvas.getBoundingClientRect();
                const x = (e.clientX - rect.left) / sofaDesigner.zoomLevel;
                const y = (e.clientY - rect.top) / sofaDesigner.zoomLevel;

                this.createPlacedModule(moduleData, x, y);
            } catch (error) {
                console.error('Error placing module:', error);
                sofaDesigner.showToast('Erro ao colocar módulo', 'error');
            }
        });



        // Zoom com scroll do mouse (preciso e compatível com pan)
        const scrollContainer = canvas.closest('.canvas-container');

        scrollContainer.addEventListener('wheel', (e) => {
            if (!canvas.contains(e.target)) return;
            e.preventDefault();

            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            const newZoom = Math.min(3, Math.max(0.2, sofaDesigner.zoomLevel + delta));

            // Pega posição do mouse relativa ao container (não apenas ao canvas)
            const rect = scrollContainer.getBoundingClientRect();
            const mouseX = e.clientX - rect.left + scrollContainer.scrollLeft;
            const mouseY = e.clientY - rect.top + scrollContainer.scrollTop;

            const prevZoom = sofaDesigner.zoomLevel;
            const zoomRatio = newZoom / prevZoom;

            sofaDesigner.zoomLevel = newZoom;
            canvas.style.transformOrigin = '0 0';
            canvas.style.transform = `scale(${sofaDesigner.zoomLevel})`;

            // Ajusta o scroll para manter o ponto do cursor fixo visualmente
            scrollContainer.scrollLeft = mouseX * zoomRatio - (e.clientX - rect.left);
            scrollContainer.scrollTop = mouseY * zoomRatio - (e.clientY - rect.top);

            // Atualiza o label de zoom
            const label = document.getElementById('zoomLevel');
            if (label) label.textContent = `${Math.round(sofaDesigner.zoomLevel * 100)}%`;
        }, { passive: false });

        // =====================================================
        // PINCH-TO-ZOOM para mobile (dois dedos)
        // =====================================================
        let initialPinchDistance = 0;
        let initialZoomLevel = 1;
        let isPinching = false;

        const getTouchDistance = (touch1, touch2) => {
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // Detect when two fingers touch the screen
        scrollContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                isPinching = true;
                initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
                initialZoomLevel = sofaDesigner.zoomLevel;
            }
        }, { passive: false });

        // Handle pinch movement
        scrollContainer.addEventListener('touchmove', (e) => {
            if (isPinching && e.touches.length === 2) {
                e.preventDefault();

                const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
                const pinchRatio = currentDistance / initialPinchDistance;

                // Calculate new zoom level
                let newZoom = initialZoomLevel * pinchRatio;
                newZoom = Math.min(3, Math.max(0.2, newZoom));

                sofaDesigner.zoomLevel = newZoom;
                canvas.style.transformOrigin = '0 0';
                canvas.style.transform = `scale(${sofaDesigner.zoomLevel})`;

                // Update zoom label
                const label = document.getElementById('zoomLevel');
                if (label) label.textContent = `${Math.round(sofaDesigner.zoomLevel * 100)}%`;

                // Update vertical toolbar zoom display
                const zoomLevelV = document.getElementById('zoomLevelV');
                if (zoomLevelV) {
                    zoomLevelV.querySelector('span').textContent = `${Math.round(sofaDesigner.zoomLevel * 100)}%`;
                }
            }
        }, { passive: false });

        // End pinch gesture
        scrollContainer.addEventListener('touchend', (e) => {
            if (isPinching && e.touches.length < 2) {
                isPinching = false;
            }
        });
        // =====================================================


        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;

        // Quando o botão do mouse é pressionado
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;

            const isOnModule = e.composedPath().some(
                el => el.classList && el.classList.contains('placed-module')
            );


            if (!isOnModule) return;  // só inicia detector de arraste se clicou no módulo

            dragStartX = e.clientX;
            dragStartY = e.clientY;
            isDragging = false;


        });
        // Quando o mouse se move
        canvas.addEventListener('pointermove', (e) => {
            const isOnModule = e.composedPath().some(
                el => el.classList && el.classList.contains('placed-module')
            );
            if (!isOnModule) return;

            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                isDragging = true;
            }
        });

        // Quando solta o botão
        canvas.addEventListener('pointerup', (e) => {
            if (e.button !== 0) return;

            const clickedModule = e.composedPath().some(
                el => el.classList && el.classList.contains('placed-module')
            );

            if (!isDragging && !clickedModule) {
                this.deselectAllModules();
            }

            isDragging = false;
        });



    }

    createPlacedModule(moduleData, x, y, saveState = true, opts = {}) {
        const ignoreCollision = opts.ignoreCollision ?? false;

        if (saveState) {
            sofaDesigner.saveState();
        }

        const canvas = document.getElementById('canvasSheet');
        const { width, height } = this.getModuleDimensions(moduleData);
        const angle = opts.rotation ?? 0;

        // Se opts.positionMode for 'corner', usa x e y diretamente como posição do canto
        // Caso contrário, treat as center coordinates (original behavior)
        let targetLeft, targetTop;

        if (opts.positionMode === 'corner') {
            // Usar coordenadas diretamente (para substituições de módulo na mesma posição)
            targetLeft = x;
            targetTop = y;
        } else {
            // Original: treat x,y as center
            const adjustedX = Math.max(0, Math.min(x - width / 2, canvas.clientWidth - width));
            const adjustedY = Math.max(0, Math.min(y - height / 2, canvas.clientHeight - height));
            targetLeft = adjustedX;
            targetTop = adjustedY;
        }

        // Direção baseada no ângulo (similar ao duplicateModule)
        let dx = 0, dy = 0;
        const angNorm = ((angle % 360) + 360) % 360;
        if (angNorm === 0) { dx = width; dy = 0; }       // direita
        else if (angNorm === 90) { dx = 0; dy = height; } // baixo
        else if (angNorm === 180) { dx = -width; dy = 0; } // esquerda
        else if (angNorm === 270) { dx = 0; dy = -height; } // cima
        else { dx = width; } // default para direita

        // Se colisão na posição inicial, avança em "saltos" até achar espaço livre (só se não ignora colisão)
        if (!ignoreCollision) {
            while (this.hasCollision(null, targetLeft, targetTop, width, height)) {
                targetLeft += dx;
                targetTop += dy;

                // Limite do canvas → aborta
                if (
                    targetLeft < 0 ||
                    targetTop < 0 ||
                    targetLeft > canvas.clientWidth - width ||
                    targetTop > canvas.clientHeight - height
                ) {
                    sofaDesigner.showToast('Sem espaço livre para adicionar o módulo.', 'warning');
                    return null;
                }
            }
        }

        // Cria o módulo na posição encontrada (usando lógica similar ao _createPlacedModuleExact)
        const moduleElement = document.createElement('div');
        moduleElement.className = 'placed-module fade-in';
        moduleElement.style.left = targetLeft + 'px';
        moduleElement.style.top = targetTop + 'px';
        moduleElement.style.width = width + 'px';
        moduleElement.style.height = height + 'px';

        moduleElement.dataset.moduleId = moduleData.id;
        moduleElement.dataset.moduleData = JSON.stringify(moduleData);

        // Aceita valores vindos de fora
        moduleElement.dataset.rotation = String(opts.rotation ?? 0);
        moduleElement.dataset.flipX = String(opts.flipX ?? 1);
        moduleElement.dataset.flipY = String(opts.flipY ?? 1);

        const controls = this.createModuleControls(moduleElement);

        const img = document.createElement('img');
        img.src = moduleData.image;
        img.alt = moduleData.modulo;
        img.draggable = false;
        img.style.position = 'absolute';
        img.style.top = '50%';
        img.style.left = '50%';
        img.style.transformOrigin = 'center center';
        img.style.objectFit = 'fill';
        img.style.transform = 'translate(-50%, -50%)';

        moduleElement.appendChild(controls);
        moduleElement.appendChild(img);

        this.setupModuleInteractions(moduleElement);
        canvas.appendChild(moduleElement);

        // Aplica rotação/flip na imagem
        this.applyTransforms(moduleElement);

        sofaDesigner.updateModuleCount();
        sofaDesigner.updateStatusMessage(`Módulo "${moduleData.modulo}" adicionado`);
        sofaDesigner.saveState();

        return moduleElement;

    }

    async showModuleConfiguration(moduleElement, event) {
        const moduleData = JSON.parse(moduleElement.dataset.moduleData);

        try {
            // 1️⃣ Buscar dados da API
            const response = await fetch(`/api/modules?modelo=${encodeURIComponent(moduleData.modelo)}`);
            if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);
            const availableMeasures = await response.json();

            // 2️⃣ Remover janela anterior, se existir
            const existingConfig = document.querySelector('.floating-module-config');
            if (existingConfig) existingConfig.remove();

            // 3️⃣ Carregar o HTML externo
            const configWindow = await this.loadHTMLTemplate('/static/html/module-config.html');

            // 4️⃣ Posicionar dinamicamente
            configWindow.style.left = `${event.clientX + 100}px`;
            configWindow.style.top = `${event.clientY}px`;

            // 5️⃣ Preencher dados iniciais
            configWindow.querySelector('#modelo-field').value = moduleData.modelo || 'N/A';

            const uniqueModules = [...new Set(availableMeasures.map(m => m.modulo))].sort();
            const getOptions = (modulo, campo) => {
                const filtered = availableMeasures.filter(m => m.modulo === modulo);
                const values = [...new Set(filtered.map(m => m[campo]))].sort((a, b) => a - b);
                return values.map(v => `<option value="${v}" ${v === moduleData[campo] ? 'selected' : ''}>${v}</option>`).join('');
            };

            // Preenche selects
            const moduloSelect = configWindow.querySelector('#modulo-select');
            moduloSelect.innerHTML = uniqueModules.map(mod =>
                `<option value="${mod}" ${mod === moduleData.modulo ? 'selected' : ''}>${mod}</option>`
            ).join('');

            configWindow.querySelector('#largura-select').innerHTML = getOptions(moduleData.modulo, 'largura');
            configWindow.querySelector('#profundidade-select').innerHTML = getOptions(moduleData.modulo, 'profundidade');
            configWindow.querySelector('#opcional1-select').innerHTML = getOptions(moduleData.modulo, 'Opcional 1');

            // 6️⃣ Adicionar à página
            document.body.appendChild(configWindow);

            // 7️⃣ Fechar ao clicar fora
            const closeConfig = () => configWindow.remove();
            document.addEventListener('click', (e) => {
                if (!configWindow.contains(e.target)) closeConfig();
            });
            configWindow.querySelector('#close-config').addEventListener('click', closeConfig);

            // 8️⃣ Atualizar selects quando o módulo muda
            moduloSelect.addEventListener('change', (e) => {
                const selectedModulo = e.target.value;
                configWindow.querySelector('#largura-select').innerHTML = getOptions(selectedModulo, 'largura');
                configWindow.querySelector('#profundidade-select').innerHTML = getOptions(selectedModulo, 'profundidade');
                configWindow.querySelector('#opcional1-select').innerHTML = getOptions(selectedModulo, 'Opcional 1');
            });

            // 9️⃣ Aplicar mudanças
            configWindow.querySelector('#apply-config').addEventListener('click', () => {
                const selectedModulo = configWindow.querySelector('#modulo-select').value;
                const selectedLargura = Number(configWindow.querySelector('#largura-select').value);
                const selectedProfundidade = Number(configWindow.querySelector('#profundidade-select').value);

                // Usar verificação mais flexível com conversão de tipos
                const matched = availableMeasures.find(m => {
                    const matchModulo = String(m.modulo).trim() === selectedModulo.trim();
                    const matchLargura = Number(m.largura) === selectedLargura;
                    const matchProfundidade = Number(m.profundidade) === selectedProfundidade;
                    return matchModulo && matchLargura && matchProfundidade;
                });

                if (!matched) {
                    alert('A combinação selecionada não é válida.');
                    return;
                }

                // Captura posição atual ANTES de modificar qualquer coisa
                const currentLeft = parseFloat(moduleElement.style.left) || 0;
                const currentTop = parseFloat(moduleElement.style.top) || 0;
                const currentRotation = parseInt(moduleElement.dataset.rotation ?? 0);
                const currentFlipX = parseInt(moduleElement.dataset.flipX ?? 1);
                const currentFlipY = parseInt(moduleElement.dataset.flipY ?? 1);

                // Atualiza os dados do módulo existente em vez de recriar
                moduleElement.dataset.moduleData = JSON.stringify(matched);
                moduleElement.dataset.moduleId = matched.id;
                moduleElement.dataset.rotation = String(currentRotation);
                moduleElement.dataset.flipX = String(currentFlipX);
                moduleElement.dataset.flipY = String(currentFlipY);

                // Atualiza as dimensões visuais
                const { width: newWidth, height: newHeight } = this.getModuleDimensions(matched);
                moduleElement.style.width = newWidth + 'px';
                moduleElement.style.height = newHeight + 'px';

                // Atualiza a imagem
                const img = moduleElement.querySelector('img');
                if (img) {
                    img.src = matched.image;
                    img.alt = matched.modulo;
                }

                // Aplica transformações
                this.applyTransforms(moduleElement);

                sofaDesigner.updateModuleCount();
                sofaDesigner.saveState();
                sofaDesigner.showToast(`Módulo alterado para "${matched.modulo}"`, 'info');

                closeConfig();
            });

        } catch (error) {
            console.error('Erro ao carregar módulos:', error);
            alert('Erro ao carregar as opções de configuração. Tente novamente.');
        }
    }

    async loadHTMLTemplate(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Falha ao carregar template: ${response.status}`);
        const html = await response.text();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html.trim();
        return wrapper.firstElementChild;
    }



    createModuleControls(moduleElement) {
        const controls = document.createElement('div');
        controls.className = 'module-controls';
        const buttons = [
            { icon: 'fa-rotate-left', title: 'Girar para esquerda', action: () => this.rotateModule(moduleElement, -90) },
            { icon: 'fa-rotate-right', title: 'Girar para direita', action: () => this.rotateModule(moduleElement, 90) },
            { icon: 'fa-arrows-alt-h', title: 'Espelhar horizontalmente', action: () => this.flipModule(moduleElement, 'x') },
            { icon: 'fa-arrows-alt-v', title: 'Espelhar verticalmente', action: () => this.flipModule(moduleElement, 'y') },
            { icon: 'fa-copy', title: 'Duplicar', action: () => this.duplicateModule(moduleElement) },
            { icon: 'fa-cog', title: 'Configurar Módulo', action: (e) => this.showModuleConfiguration(moduleElement, e) },
            { icon: 'fa-trash', title: 'Remover', action: () => this.removeModule(moduleElement), class: 'danger' }
        ];
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `control-btn ${btn.class || ''}`;
            button.innerHTML = `<i class="fas ${btn.icon}"></i>`;
            button.title = btn.title;
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.action(e);  // Correção: passe 'e' para btn.action
            });
            controls.appendChild(button);
        });

        return controls;
    }



    setupModuleInteractions(moduleElement) {
        moduleElement.addEventListener('pointerdown', (e) => {
            if (this.findParentWithClass(e.target, 'control-btn')) return;

            e.preventDefault();

            const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;

            if (isMulti) {
                // toggle: adiciona ou remove da seleção
                if (moduleElement.classList.contains('selected')) {
                    moduleElement.classList.remove('selected');
                    this.selectedModules = this.selectedModules.filter(m => m !== moduleElement);
                } else {
                    this.selectModule(moduleElement, true);
                }
            } else {
                // clique normal → sempre seleção única
                this.selectModule(moduleElement, false);
            }
            let startX = e.clientX;
            let startY = e.clientY;
            let startLeft = parseFloat(moduleElement.style.left) || 0;
            let startTop = parseFloat(moduleElement.style.top) || 0;
            let isDragging = true;

            moduleElement.style.cursor = 'grabbing';
            if (e.pointerId) moduleElement.setPointerCapture(e.pointerId);

            const onPointerMove = (moveEvent) => {
                if (!isDragging) return;

                const deltaX = (moveEvent.clientX - startX) / sofaDesigner.zoomLevel;
                const deltaY = (moveEvent.clientY - startY) / sofaDesigner.zoomLevel;

                // Movimento livre — sem snap nem colisão
                const newX = startLeft + deltaX;
                const newY = startTop + deltaY;

                // Suavização: interpolação linear (lerp)
                const currentX = parseFloat(moduleElement.style.left) || 0;
                const currentY = parseFloat(moduleElement.style.top) || 0;
                const lerpFactor = 0.3; // entre 0.1 (bem suave) e 0.5 (quase direto)

                const smoothX = currentX + (newX - currentX) * lerpFactor;
                const smoothY = currentY + (newY - currentY) * lerpFactor;

                moduleElement.style.left = smoothX + 'px';
                moduleElement.style.top = smoothY + 'px';
                sofaDesigner.updateModuleCount();
            };

            const onPointerUp = () => {
                if (isDragging) {
                    const { width, height } = this.getActualModuleDimensions(moduleElement);
                    let currentX = parseFloat(moduleElement.style.left);
                    let currentY = parseFloat(moduleElement.style.top);

                    // 1️⃣ Verifica colisão
                    let overlap = this.hasCollision(moduleElement, currentX, currentY, width, height);

                    if (overlap) {
                        // 2️⃣ Encontra o módulo mais próximo que colide
                        const modules = Array.from(document.querySelectorAll('.placed-module'))
                            .filter(m => m !== moduleElement);

                        let minDistance = Infinity;
                        let closest = null;

                        for (const mod of modules) {
                            const rect = this.getModuleRect(mod);
                            const dx = (currentX + width / 2) - (rect.left + rect.width / 2);
                            const dy = (currentY + height / 2) - (rect.top + rect.height / 2);
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closest = rect;
                            }
                        }

                        if (closest) {
                            // 3️⃣ Calcula deslocamento mínimo pra sair da colisão
                            const moveLeft = currentX + width - closest.left;
                            const moveRight = closest.right - currentX;
                            const moveUp = currentY + height - closest.top;
                            const moveDown = closest.bottom - currentY;

                            const diffs = [
                                { dir: 'left', dist: Math.abs(moveLeft) },
                                { dir: 'right', dist: Math.abs(moveRight) },
                                { dir: 'up', dist: Math.abs(moveUp) },
                                { dir: 'down', dist: Math.abs(moveDown) }
                            ].sort((a, b) => a.dist - b.dist);

                            const nearestSide = diffs[0].dir;

                            switch (nearestSide) {
                                case 'left':
                                    currentX = closest.left - width - 1;
                                    break;
                                case 'right':
                                    currentX = closest.right + 1;
                                    break;
                                case 'up':
                                    currentY = closest.top - height - 1;
                                    break;
                                case 'down':
                                    currentY = closest.bottom + 1;
                                    break;

                            }

                        }

                    }

                    // 4️⃣ Snap final (somente externo)
                    const snapped = this.snapPosition(currentX, currentY, width, height, moduleElement);
                    if (snapped.snapped) {
                        moduleElement.style.transition = 'left 0.15s ease, top 0.15s ease';
                        moduleElement.style.left = snapped.x + 'px';
                        moduleElement.style.top = snapped.y + 'px';
                        setTimeout(() => (moduleElement.style.transition = ''), 200);
                    } else {
                        moduleElement.style.left = currentX + 'px';
                        moduleElement.style.top = currentY + 'px';
                    }

                    // 5️⃣ Feedback visual e atualização
                    moduleElement.classList.toggle('collision', overlap);
                    sofaDesigner.saveState();

                }

                isDragging = false;
                moduleElement.style.cursor = 'move';
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                sofaDesigner.updateModuleCount();

            };

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);


        });

    }

    selectModule(moduleElement, append = true) {
        if (!append) {
            this.deselectAllModules();
        }
        moduleElement.classList.add('selected');
        if (!this.selectedModules.includes(moduleElement)) {
            this.selectedModules.push(moduleElement);
        }
    }

    deselectAllModules() {
        document.querySelectorAll('.placed-module.selected').forEach(module => {
            module.classList.remove('selected');
        });

        this.selectedModules = [];       // ← OBRIGATÓRIO
        this.selectedModule = null;      // (se ainda for usado)
    }

    rotateModule(moduleElement, degrees) {
        sofaDesigner.saveState();

        // Dados do módulo
        const moduleData = JSON.parse(moduleElement.dataset.moduleData || '{}');
        const prevAngle = Number(moduleData.angulo) || 0;
        // console.log(moduleData);

        // soma, normaliza e quantiza em múltiplos de 90°
        let angulo = prevAngle + degrees;

        //O bloco abaixo foi comentado para melhor o visual da rotação
        //angulo = ((angulo % 360) + 360) % 360;
        angulo = Math.round(angulo / 90) * 90;


        moduleData.angulo = angulo;
        moduleElement.dataset.moduleData = JSON.stringify(moduleData);

        // Dimensões base do módulo
        const { width: baseW, height: baseH } = this.getModuleDimensions(moduleData);

        // Dimensões antigas do container
        const oldW = parseInt(moduleElement.style.width) || moduleElement.offsetWidth;
        const oldH = parseInt(moduleElement.style.height) || moduleElement.offsetHeight;

        // Novo tamanho dependendo da rotação
        const isNinety = Math.abs(angulo % 180) === 90;
        const newW = isNinety ? baseH : baseW;
        const newH = isNinety ? baseW : baseH;

        // Mantém o centro fixo
        let left = parseInt(moduleElement.style.left) || 0;
        let top = parseInt(moduleElement.style.top) || 0;

        const dx = (oldW - newW) / 2;
        const dy = (oldH - newH) / 2;

        moduleElement.style.width = newW + 'px';
        moduleElement.style.height = newH + 'px';
        moduleElement.style.left = (left + dx) + 'px';
        moduleElement.style.top = (top + dy) + 'px';

        // Aplica transformações

        this.applyTransforms(moduleElement);
        moduleElement.dataset.rotation = String(angulo); // mantém colisão coerente com a rotação
        this.getActualModuleDimensions(moduleElement); // força atualização das dimensões reais

        moduleElement.containerWidth = newW;
        moduleElement.containerHeight = newH;


        sofaDesigner.showToast(`Módulo rotacionado para ${angulo}°`, 'info');

        sofaDesigner.updateModuleCount();


    }

    flipModule(moduleElement, axis) {
        sofaDesigner.saveState();

        const currentFlipX = parseFloat(moduleElement.dataset.flipX) || 1;
        const currentFlipY = parseFloat(moduleElement.dataset.flipY) || 1;

        let newFlipX = currentFlipX;
        let newFlipY = currentFlipY;

        if (axis === 'x') {
            newFlipX = currentFlipX === 1 ? -1 : 1;
        } else if (axis === 'y') {
            newFlipY = currentFlipY === 1 ? -1 : 1;
        }

        moduleElement.dataset.flipX = newFlipX.toString();
        moduleElement.dataset.flipY = newFlipY.toString();

        // Aplica transformações
        this.applyTransforms(moduleElement);

        sofaDesigner.showToast(`Módulo espelhado ${axis === 'x' ? 'horizontalmente' : 'verticalmente'}`, 'info');
    }

    applyTransforms(moduleElement) {
        const moduleData = JSON.parse(moduleElement.dataset.moduleData || '{}');
        const angulo = Number(moduleData.angulo) || 0;
        const flipX = parseFloat(moduleElement.dataset.flipX) || 1;
        const flipY = parseFloat(moduleElement.dataset.flipY) || 1;
        const { width: refW, height: refH } = this.getModuleDimensions(moduleData);

        const img = moduleElement.querySelector('img');
        if (img) {
            img.style.position = 'absolute';
            img.style.top = '50%';
            img.style.left = '50%';
            img.style.width = refW + 'px';
            img.style.height = refH + 'px';
            img.style.objectPosition = 'center';
            img.style.transformOrigin = 'center center';
            img.style.objectFit = 'fill';
            img.style.transform = `translate(-50%, -50%) rotate(${angulo}deg) scaleX(${flipX}) scaleY(${flipY})`;
        }

    }

    // Mantém compatibilidade: updateModuleDimensions agora é só um alias
    updateModuleDimensions(moduleElement) {
        this.applyTransforms(moduleElement);
    }

    getActualModuleDimensions(moduleElement) {
        const width = parseInt(moduleElement.style.width) || moduleElement.offsetWidth;
        const height = parseInt(moduleElement.style.height) || moduleElement.offsetHeight;
        return { width, height };
    }

    duplicateModule(moduleElement) {
        sofaDesigner.saveState();

        const moduleData = JSON.parse(moduleElement.dataset.moduleData || '{}');
        const angle = Number(moduleData.angulo) || 0;
        const flipX = parseFloat(moduleElement.dataset.flipX) || 1;
        const flipY = parseFloat(moduleElement.dataset.flipY) || 1;

        const currentLeft = parseInt(moduleElement.style.left) || 0;
        const currentTop = parseInt(moduleElement.style.top) || 0;
        const { width: currW, height: currH } = this.getActualModuleDimensions(moduleElement);

        const canvas = document.getElementById('canvasSheet');

        // Direção baseada no ângulo
        let dx = 0, dy = 0;
        const angNorm = ((angle % 360) + 360) % 360;
        if (angNorm === 0) { dx = currW; dy = 0; }       // direita
        else if (angNorm === 90) { dx = 0; dy = currH; } // baixo
        else if (angNorm === 180) { dx = -currW; dy = 0; } // esquerda
        else if (angNorm === 270) { dx = 0; dy = -currH; } // cima
        else { dx = currW; }

        // Avança em "saltos" até achar espaço livre
        let targetLeft = currentLeft + dx;
        let targetTop = currentTop + dy;

        while (this.hasCollision(null, targetLeft, targetTop, currW, currH)) {
            targetLeft += dx;
            targetTop += dy;

            // limite do canvas → aborta
            if (
                targetLeft < 0 ||
                targetTop < 0 ||
                targetLeft > canvas.clientWidth - currW ||
                targetTop > canvas.clientHeight - currH
            ) {
                sofaDesigner.showToast('Sem espaço livre para duplicar.', 'warning');
                return;
            }
        }

        // Cria novo módulo diretamente com createPlacedModule
        this.createPlacedModule(moduleData, targetLeft + currW / 2, targetTop + currH / 2, true, { rotation: angle, flipX, flipY });
    }


    removeModule(moduleElement) {
        sofaDesigner.saveState();
        moduleElement.remove();
        sofaDesigner.updateModuleCount();
        const remaining = document.querySelectorAll('.placed-module').length;
        if (remaining === 0) {
            const overlay = document.getElementById('dimensionOverlay');
            if (overlay) overlay.innerHTML = '';
        }

    }

    hasCollision(movingElement, x, y, width, height) {
        const modules = Array.from(document.querySelectorAll('.placed-module'));
        for (const module of modules) {
            if (module === movingElement) continue;
            // Sempre use retângulo do container, ignorando rotação
            const moduleRect = this.getModuleRect(module);
            const testRect = { left: x, top: y, right: x + width, bottom: y + height };
            if (this.rectsOverlap(moduleRect, testRect)) {
                return true;
            }
        }
        return false;
    }

    snapPosition(x, y, width, height, movingElement) {
        const modules = Array.from(document.querySelectorAll('.placed-module'))
            .filter(module => module !== movingElement);

        let snappedX = x;
        let snappedY = y;
        let snapped = false;

        for (const module of modules) {
            const rect = this.getModuleRect(module);

            // ---------- SNAP VERTICAL ----------
            // Topo do módulo atual "encaixando por dentro" (mais tolerância)
            if (y >= rect.top && y <= rect.bottom && Math.abs(y - rect.top) < this.snapTolerance) {
                snappedY = rect.top;
                snapped = true;
            }

            // Base "encaixando por dentro"
            if (y + height >= rect.top && y + height <= rect.bottom && Math.abs(y + height - rect.bottom) < this.snapTolerance) {
                snappedY = rect.bottom - height;
                snapped = true;
            }

            // Topo com base de outro (encaixe externo, mais preciso)
            if (Math.abs(y - rect.bottom) < this.snapadTolerance) {
                snappedY = rect.bottom;
                snapped = true;
            }

            // Base com topo de outro (encaixe externo, mais preciso)
            if (Math.abs(y + height - rect.top) < this.snapadTolerance) {
                snappedY = rect.top - height;
                snapped = true;
            }

            // ---------- SNAP HORIZONTAL ----------
            // Esquerda "encaixando por dentro"
            if (x >= rect.left && x <= rect.right && Math.abs(x - rect.left) < this.snapTolerance) {
                snappedX = rect.left;
                snapped = true;
            }

            // Direita "encaixando por dentro"
            if (x + width >= rect.left && x + width <= rect.right && Math.abs(x + width - rect.right) < this.snapTolerance) {
                snappedX = rect.right - width;
                snapped = true;
            }

            // Esquerda com direita (encaixe externo)
            if (Math.abs(x - rect.right) < this.snapadTolerance) {
                snappedX = rect.right;
                snapped = true;
            }

            // Direita com esquerda (encaixe externo)
            if (Math.abs(x + width - rect.left) < this.snapadTolerance) {
                snappedX = rect.left - width;
                snapped = true;
            }
        }

        return { x: snappedX, y: snappedY, snapped };
    }


    getModuleRect(moduleElement) {
        const left = parseInt(moduleElement.style.left) || 0;
        const top = parseInt(moduleElement.style.top) || 0;
        const dimensions = this.getActualModuleDimensions(moduleElement);

        return {
            left,
            top,
            right: left + dimensions.width,
            bottom: top + dimensions.height,
            width: dimensions.width,
            height: dimensions.height
        };
    }

    rectsOverlap(rect1, rect2) {
        // Allow objects to touch exactly - no gap
        return !(rect2.left >= rect1.right ||
            rect2.right <= rect1.left ||
            rect2.top >= rect1.bottom ||
            rect2.bottom <= rect1.top);
    }

    findParentWithClass(element, className) {
        while (element && element !== document) {
            if (element.classList && element.classList.contains(className)) {
                return element;
            }
            element = element.parentNode;
        }
        return null;
    }
}



// Initialize canvas manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.canvasManager = new CanvasManager();


});



document.querySelectorAll('.moduleElement').forEach(el => emulateMouseEvents(el));

