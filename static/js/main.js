class SofaDesigner {

    constructor() {
        this.currentModel = null;
        this.modules = [];
        this.projects = [];
        this.originalModels = {};
        this.searchTimeout = null;
        this.zoomLevel = 1;
        this.gridVisible = false;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;

        // aplica o grid desativado logo no início
        const sheet = document.getElementById('canvasSheet');
        if (sheet) {
            sheet.classList.add('no-grid');
        }

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadModels();
        this.initializeTooltips();
    }

    /**
     * Helper method to safely add event listeners to DOM elements
     * Prevents errors when elements don't exist
     */
    addEventListenerSafe(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    setupEventListeners() {
        // Cache frequently accessed DOM elements for better performance
        const sidebarContainer = document.querySelector('.sidebar-container');
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        // Sidebar toggle (mobile) - with null safety
        this.addEventListenerSafe('openSidebar', 'click', () => {
            if (sidebarContainer) sidebarContainer.classList.add('show');
        });

        this.addEventListenerSafe('closeSidebar', 'click', () => {
            if (sidebarContainer) sidebarContainer.classList.remove('show');
        });

        // Search functionality - consolidated document click listener
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.performSearch(e.target.value);
                }, 300);
            });

            // Clear filter when search field is cleared
            searchInput.addEventListener('change', (e) => {
                if (!e.target.value.trim()) {
                    // Reset to show all models immediately
                    if (this.originalModels) {
                        this.renderModels(this.originalModels);
                    }
                }
            });
        }

        // Single document click listener for search (consolidated from duplicate)
        document.addEventListener('click', (e) => {
            if (searchInput && searchResults &&
                !searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });

        // Zoom handlers - using safe event binding

        this.addEventListenerSafe('zoomReset', 'click', () => this.zoomReset());
        this.addEventListenerSafe('zoomIn', 'click', () => this.zoomIn());
        this.addEventListenerSafe('zoomOut', 'click', () => this.zoomOut());

        // Vertical Toolbar - new buttons on the left side
        this.addEventListenerSafe('toggleSidebarV', 'click', () => {
            if (sidebarContainer) sidebarContainer.classList.toggle('show');
        });
        this.addEventListenerSafe('zoomInV', 'click', () => this.zoomIn());
        this.addEventListenerSafe('zoomOutV', 'click', () => this.zoomOut());
        this.addEventListenerSafe('gridToggleV', 'click', () => this.toggleGrid());
        this.addEventListenerSafe('clearCanvasV', 'click', () => this.clearCanvas());
        this.addEventListenerSafe('exportPDFV', 'click', () => this.exportAsPDF());
        this.addEventListenerSafe('frameCanvasV', 'click', () => this.frameCanvas());

        // Canvas controls - removed duplicate undo listener
        this.addEventListenerSafe('undoBtn', 'click', () => this.undo());
        this.addEventListenerSafe('redoBtn', 'click', () => this.redo());
        this.addEventListenerSafe('clearCanvas', 'click', () => this.clearCanvas()); this.updateModuleCount();
        this.addEventListenerSafe('gridToggle', 'click', () => this.toggleGrid());

        // Info modal
        this.addEventListenerSafe('infoBtn', 'click', () => this.showInfoModal());

        // Export functions
        this.addEventListenerSafe('exportJSON', 'click', () => this.exportAsJSON());
        this.addEventListenerSafe('exportPDF', 'click', () => this.exportAsPDF());

        // Tab switching
        document.getElementById('modulesTab').addEventListener('click', () => {
            if (!this.currentModel) {
                this.showToast('Selecione um modelo primeiro', 'warning');
                document.getElementById('modelsTab').click();
                return false;
            }
        });

        // Back button
        this.addEventListenerSafe('backToModelsBtn', 'click', () => this.goBackToModels());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        break;
                    case '+':
                    case '=':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        this.zoomReset();
                        break;
                }
            }


        });
    }

    /**
     * Load models from API with enhanced error handling
     * Displays loading state and handles network/parsing errors gracefully
     */
    async loadModels() {
        this.showLoading(true);
        try {
            // console.log('Fetching models from API...');
            const response = await fetch('/api/models');
            // console.log('API response status:', response.status);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const modelsByCategory = await response.json();
            // console.log('Models loaded:', modelsByCategory);
            // Store original (unfiltered) models only on initial load
            this.originalModels = JSON.parse(JSON.stringify(modelsByCategory));
            // console.log('originalModels stored:', this.originalModels);
            this.renderModels(modelsByCategory);
        } catch (error) {
            console.error('Error loading models:', error);
            this.showToast('Erro ao carregar modelos: ' + error.message, 'error');

            // Provide fallback empty state
            this.renderModels({});
        } finally {
            this.showLoading(false);
        }
    }

    renderModels(modelsByCategory) {
        const container = document.getElementById('modelsContainer');
        container.innerHTML = '';

        Object.entries(modelsByCategory).forEach(([category, models]) => {
            const categoryDiv = document.createElement('div');
            // categoryDiv.className = 'model-category fade-in';

            // const categoryTitle = document.createElement('div');
            // categoryTitle.className = 'model-category-title';
            // categoryTitle.textContent = category;
            // categoryDiv.appendChild(categoryTitle);

            models.forEach(model => {
                const modelItem = document.createElement('div');
                modelItem.className = 'model-item slide-in';
                modelItem.dataset.modelo = model.modelo;

                modelItem.innerHTML = `
                    <div class="model-name">${model.modelo}</div>
                    <div class="model-count">${model.qtd}</div>
                `;

                modelItem.addEventListener('click', () => this.selectModel(model.modelo, modelItem));
                categoryDiv.appendChild(modelItem);
            });

            container.appendChild(categoryDiv);
        });
    }

    async selectModel(modelo, element) {
        // Update UI
        document.querySelectorAll('.model-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');

        this.currentModel = modelo;

        // Hide search container when model is selected
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.classList.add('d-none');
        }

        // Show back button and update model name
        const backButtonContainer = document.getElementById('backButtonContainer');
        const selectedModelName = document.getElementById('selectedModelName');
        selectedModelName.textContent = modelo;
        backButtonContainer.classList.remove('d-none');

        // Switch to modules tab using Bootstrap
        document.getElementById('modulesTab').click();

        // Load modules
        await this.loadModules(modelo);

        this.updateStatusMessage(`Modelo "${modelo}" selecionado`);
    }

    /**
     * Go back to models view
     */
    goBackToModels() {
        // Clear current model
        this.currentModel = null;

        // Hide back button
        const backButtonContainer = document.getElementById('backButtonContainer');
        backButtonContainer.classList.add('d-none');

        // Show search container again when returning to model selection
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.classList.remove('d-none');
        }

        // Switch to models tab using Bootstrap
        document.getElementById('modelsTab').click();

        // Remove active class from model items
        document.querySelectorAll('.model-item').forEach(item => item.classList.remove('active'));

        this.updateStatusMessage('Selecione um modelo para começar');
    }

    /**
     * Load modules for a specific model with enhanced error handling
     * @param {string} modelo - The model name to load modules for
     */
    async loadModules(modelo) {
        this.showLoading(true);
        try {
            const response = await fetch(`/api/modules?modelo=${encodeURIComponent(modelo)}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.modules = await response.json();
            this.renderModules(this.modules);
        } catch (error) {
            console.error('Error loading modules:', error);
            this.showToast('Erro ao carregar módulos', 'error');

            // Provide fallback empty state
            this.modules = [];
            this.renderModules(this.modules);
        } finally {
            this.showLoading(false);
        }
    }

    renderModules(modules) {
        const container = document.getElementById('modulesContainer');
        const noModelMessage = document.getElementById('noModelSelected');

        if (modules.length === 0) {
            container.classList.add('d-none');
            noModelMessage.classList.remove('d-none');
            return;
        }

        noModelMessage.classList.add('d-none');
        container.classList.remove('d-none');
        container.innerHTML = '';

        const groupedModules = modules.reduce((groups, module) => {
            const key = module.modulo || 'Sem Categoria';
            if (!groups[key]) groups[key] = [];
            groups[key].push(module);
            return groups;
        }, {});

        for (const modulo in groupedModules) {
            const group = groupedModules[modulo];

            // Container do grupo
            const groupWrapper = document.createElement('div');
            groupWrapper.className = 'module-group-wrapper';
            groupWrapper.style.marginBottom = '1rem';
            groupWrapper.style.border = '1px solid #ccc';
            groupWrapper.style.borderRadius = '4px';
            groupWrapper.style.width = 'auto'; // ajuste conforme desejar

            // Caixa resumo (fechada)
            const summaryBox = document.createElement('div');
            summaryBox.className = 'module-group-summary';
            summaryBox.style.display = 'flex';
            summaryBox.style.alignItems = 'center';
            summaryBox.style.cursor = 'pointer';
            summaryBox.style.padding = '0.5rem';

            // Nome do grupo
            const title = document.createElement('div');
            title.textContent = modulo;
            title.style.fontWeight = 'bold';
            title.style.fontSize = '1rem';
            title.style.marginRight = '10px';
            summaryBox.appendChild(title);

            // Imagem do primeiro módulo
            const img = document.createElement('img');
            img.src = group[0].image;
            img.alt = modulo;
            img.style.height = '60px';
            img.style.width = 'auto';
            img.style.objectFit = 'cover';
            img.style.marginRight = '1rem';
            summaryBox.appendChild(img);



            groupWrapper.appendChild(summaryBox);

            // Container expandido (inicialmente oculto)
            const expandedContainer = document.createElement('div');
            expandedContainer.className = 'module-group-expanded';
            expandedContainer.style.display = 'none';
            expandedContainer.style.padding = '1rem';
            expandedContainer.style.backgroundColor = '#9b9b9bff';

            // Renderizar todos os módulos do grupo
            group.forEach(module => {
                const moduleItem = document.createElement('div');
                moduleItem.className = 'module-item fade-in';
                moduleItem.draggable = true;
                moduleItem.dataset.moduleId = module.id;
                moduleItem.style.display = 'flex';
                moduleItem.style.alignItems = 'center';
                moduleItem.style.marginBottom = '0.5rem';

                moduleItem.innerHTML = `
                <img src="${module.image}" alt="${module.modulo}" class="module-image" />
                <div class="module-info">
                    <div class="module-name">${module.modulo}</div>                    
                    <div class="module-Opcional-1">${module.Opcional_1 || ''}</div>
                    <div class="module-Opcional-2">${module.Opcional_2 || ''}</div>
                    <div class="module-dimensions">${module.largura} × ${module.profundidade} mm</div>
                </div>
            `;

                moduleItem.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(module));
                    moduleItem.classList.add('dragging');
                });

                moduleItem.addEventListener('dragend', () => {
                    moduleItem.classList.remove('dragging');
                    this.updateModuleCount();
                });

                // Suporte para touch/mobile - simula drag com pointer events
                let touchData = null;
                moduleItem.addEventListener('pointerdown', (e) => {
                    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                        touchData = {
                            moduleData: module,
                            startX: e.clientX,
                            startY: e.clientY,
                            pointerId: e.pointerId
                        };
                        moduleItem.classList.add('dragging');
                        moduleItem.setPointerCapture(e.pointerId);
                    }
                });

                moduleItem.addEventListener('pointermove', (e) => {
                    if (touchData && touchData.pointerId === e.pointerId) {
                        // Arraste detectado em touch
                    }
                });

                moduleItem.addEventListener('pointerup', (e) => {
                    if (touchData && touchData.pointerId === e.pointerId) {
                        const canvas = document.getElementById('canvasSheet');
                        const rect = canvas.getBoundingClientRect();

                        // Verifica se o drop foi dentro do canvas
                        if (e.clientX >= rect.left && e.clientX <= rect.right &&
                            e.clientY >= rect.top && e.clientY <= rect.bottom) {

                            // Calcula a posição real onde o usuário soltou o touch
                            // Considera o zoom level atual (igual ao drag/drop do desktop)
                            const x = (e.clientX - rect.left) / sofaDesigner.zoomLevel;
                            const y = (e.clientY - rect.top) / sofaDesigner.zoomLevel;

                            canvasManager.createPlacedModule(touchData.moduleData, x, y);
                        }

                        moduleItem.classList.remove('dragging');
                        touchData = null;
                        this.updateModuleCount();
                    }
                });

                expandedContainer.appendChild(moduleItem);
            });

            groupWrapper.appendChild(expandedContainer);

            // Eventos para expandir/contrair
            // Estado de expansão para mobile
            let isExpandedByTouch = false;
            const isTouchDevice = (('ontouchstart' in window) ||
                (navigator.maxTouchPoints > 0) ||
                (navigator.msMaxTouchPoints > 0));

            if (!isTouchDevice) {
                // Desktop: usar mouseenter/mouseleave
                summaryBox.addEventListener('mouseenter', () => {
                    summaryBox.style.display = 'none';
                    expandedContainer.style.display = 'block';
                    expandedContainer.classList.add('open');
                });

                groupWrapper.addEventListener('mouseleave', () => {
                    expandedContainer.classList.remove('open');
                    const fallbackTimeout = setTimeout(() => {
                        if (!expandedContainer.classList.contains('open')) {
                            expandedContainer.style.display = 'none';
                            summaryBox.style.display = 'flex';
                        }
                    }, 200);
                    expandedContainer.addEventListener('transitionend', function handler(event) {
                        if (event.propertyName === 'opacity' && !expandedContainer.classList.contains('open')) {
                            clearTimeout(fallbackTimeout);
                            expandedContainer.style.display = 'none';
                            summaryBox.style.display = 'flex';
                        }
                    }, { once: true });
                });
            } else {
                // Mobile: usar click para toggle
                summaryBox.addEventListener('click', (e) => {
                    e.preventDefault();

                    if (!isExpandedByTouch) {
                        // Expandir
                        isExpandedByTouch = true;
                        summaryBox.style.display = 'none';
                        expandedContainer.style.display = 'block';
                        expandedContainer.classList.add('open');
                    } else {
                        // Contrair
                        isExpandedByTouch = false;
                        expandedContainer.classList.remove('open');
                        const fallbackTimeout = setTimeout(() => {
                            if (!expandedContainer.classList.contains('open')) {
                                expandedContainer.style.display = 'none';
                                summaryBox.style.display = 'flex';
                            }
                        }, 200);
                        expandedContainer.addEventListener('transitionend', function handler(event) {
                            if (event.propertyName === 'opacity' && !expandedContainer.classList.contains('open')) {
                                clearTimeout(fallbackTimeout);
                                expandedContainer.style.display = 'none';
                                summaryBox.style.display = 'flex';
                            }
                        }, { once: true });
                    }
                });
            }
            container.appendChild(groupWrapper);
        }
    }


    renderSearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        searchResults.innerHTML = '';

        if (results.length === 0) {
            searchResults.innerHTML = '<div class="search-result-item text-muted">Nenhum resultado encontrado</div>';
        } else {
            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div><strong>${result.modelo}</strong></div>
                   
                `;

                item.addEventListener('click', () => {
                    this.selectModelFromSearch(result.modelo);
                    searchResults.style.display = 'none';
                    document.getElementById('searchInput').value = '';
                });

                searchResults.appendChild(item);
            });
        }

        searchResults.style.display = 'block';
    }

    performSearch(query) {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        if (!query.trim()) {
            // If search is empty, show all models
            if (this.originalModels) {
                this.renderModels(this.originalModels);
            }
            searchResults.style.display = 'none';
            return;
        }

        // Filter models by name (case-insensitive) from ORIGINAL unfiltered data
        const filteredModels = {};
        const queryLower = query.toLowerCase();

        Object.entries(this.originalModels || {}).forEach(([category, models]) => {
            const filtered = models.filter(model =>
                model.modelo.toLowerCase().includes(queryLower)
            );
            if (filtered.length > 0) {
                filteredModels[category] = filtered;
            }
        });

        // Re-render with filtered models
        this.renderModels(filteredModels);
    }

    selectModelFromSearch(modelo) {
        const modelElement = document.querySelector(`[data-modelo="${modelo}"]`);
        if (modelElement) {
            modelElement.click();
            document.getElementById('modelsTab').click();
            modelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Zoom functions
    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel + 0.1, 3);
        this.applyZoom();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel - 0.1, 0.2);
        this.applyZoom();
    }

    zoomReset() {
        this.zoomLevel = 1;
        this.applyZoom();
    }

    applyZoom() {
        const canvas = document.getElementById('canvasSheet');
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = `scale(${this.zoomLevel})`;

        const label = document.getElementById('zoomLevel');
        if (label) label.textContent = `${Math.round(this.zoomLevel * 100)}%`;

        // Also update vertical toolbar zoom display
        const zoomLevelV = document.getElementById('zoomLevelV');
        if (zoomLevelV) {
            zoomLevelV.querySelector('span').textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }

    /**
     * Frame/fit all elements in the canvas view
     * Calculates bounding box of all modules and adjusts zoom to fit them
     */
    frameCanvas() {
        const modules = document.querySelectorAll('.placed-module');
        const container = document.getElementById('canvasContainer');
        const canvas = document.getElementById('canvasSheet');

        if (modules.length === 0) {
            this.showToast('Nenhum elemento para enquadrar', 'warning');
            return;
        }

        // Calculate bounding box of all modules
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        modules.forEach(m => {
            const left = parseInt(m.style.left) || 0;
            const top = parseInt(m.style.top) || 0;
            const width = parseInt(m.style.width) || m.offsetWidth;
            const height = parseInt(m.style.height) || m.offsetHeight;

            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, left + width);
            maxY = Math.max(maxY, top + height);
        });

        // Add padding around the elements
        const padding = 50;
        const contentWidth = (maxX - minX) + (padding * 2);
        const contentHeight = (maxY - minY) + (padding * 2);

        // Get container dimensions (visible area)
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;

        // Calculate zoom level to fit content in container
        const zoomX = containerWidth / contentWidth;
        const zoomY = containerHeight / contentHeight;

        // Use the smaller zoom to ensure everything fits, with limits
        let newZoom = Math.min(zoomX, zoomY);
        newZoom = Math.max(newZoom, 0.2); // Minimum zoom
        newZoom = Math.min(newZoom, 2); // Maximum zoom

        // Apply the new zoom level
        this.zoomLevel = newZoom;
        this.applyZoom();

        // Center the view on the content
        requestAnimationFrame(() => {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            // Calculate scroll position to center the content
            const scrollLeft = (centerX * this.zoomLevel) - (containerWidth / 2);
            const scrollTop = (centerY * this.zoomLevel) - (containerHeight / 2);

            container.scrollLeft = Math.max(0, scrollLeft);
            container.scrollTop = Math.max(0, scrollTop);
        });

        this.showToast(`Enquadrado: ${Math.round(newZoom * 100)}%`, 'info');
    }





    // History management
    saveState() {
        const state = this.getCanvasState();

        // Remove future history if we're not at the end
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add new state
        this.history.push(state);

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }

        // this.updateHistoryButtons();
    }

    // undo() {
    //     if (this.historyIndex > 0) {
    //         this.historyIndex--;
    //         this.restoreState(this.history[this.historyIndex]);
    //         this.updateHistoryButtons();
    //     }
    // }

    // redo() {
    //     if (this.historyIndex < this.history.length - 1) {
    //         this.historyIndex++;
    //         this.restoreState(this.history[this.historyIndex]);
    //         this.updateHistoryButtons();
    //     }
    // }

    updateHistoryButtons() {
        document.getElementById('undoBtn').disabled = this.historyIndex <= 0;
        document.getElementById('redoBtn').disabled = this.historyIndex >= this.history.length - 1;
    }

    getCanvasState() {
        const modules = Array.from(document.querySelectorAll('.placed-module')).map(module => ({
            id: module.dataset.moduleId,
            x: parseInt(module.style.left),
            y: parseInt(module.style.top),
            width: parseInt(module.style.width),
            height: parseInt(module.style.height),
            rotation: parseInt(module.dataset.rotation || 0),
            flipX: parseFloat(module.dataset.flipX || 1),
            flipY: parseFloat(module.dataset.flipY || 1),
            src: module.querySelector('img').src,
            data: JSON.parse(module.dataset.moduleData || '{}')
        }));

        return { modules, timestamp: Date.now() };
    }

    restoreState(state) {
        const canvas = document.getElementById('canvasSheet');
        canvas.innerHTML = '';

        state.modules.forEach(moduleData => {
            const el = canvasManager.createPlacedModule(
                moduleData.data,
                moduleData.x,
                moduleData.y,
                false,
                {
                    rotation: moduleData.rotation,
                    flipX: moduleData.flipX,
                    flipY: moduleData.flipY
                }
            );

            el.style.width = moduleData.width + 'px';
            el.style.height = moduleData.height + 'px';
        });

        this.updateModuleCount();
    }

    // Canvas management
    clearCanvas() {
        if (confirm('Tem certeza que deseja limpar todo o canvas?')) {
            this.saveState();
            document.getElementById('canvasSheet').innerHTML = '';
            this.updateModuleCount();
            this.showToast('Canvas limpo', 'info');
        }
    }

    toggleGrid() {
        const sheet = document.getElementById('canvasSheet');
        sheet.classList.toggle('no-grid');
        this.gridVisible = !this.gridVisible;

        const button = document.getElementById('gridToggle');
        button.classList.toggle('active', this.gridVisible);

        this.showToast(this.gridVisible ? 'Grid ativado' : 'Grid desativado', 'info');
    }








    updateModuleCount() {
        const modules = document.querySelectorAll('.placed-module');
        document.getElementById('moduleCount').textContent =
            `${modules.length} módulo${modules.length !== 1 ? 's' : ''}`;

        if (modules.length === 0) {
            document.getElementById('canvasSize').textContent = 'Área ocupada - 0 × 0 cm';
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        modules.forEach(m => {
            const left = parseInt(m.style.left) || 0;
            const top = parseInt(m.style.top) || 0;
            const width = parseInt(m.style.width) || m.offsetWidth;
            const height = parseInt(m.style.height) || m.offsetHeight;

            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, left + width);
            maxY = Math.max(maxY, top + height);

            // Atualiza os datasets
            m.dataset.left = left;
            m.dataset.top = top;
            m.dataset.width = width;
            m.dataset.height = height;

            minX = Math.min(minX, left);
            minY = Math.min(minY, top);
            maxX = Math.max(maxX, left + width);
            maxY = Math.max(maxY, top + height);
        });


        const width = maxX - minX;
        const height = maxY - minY;

        const pxToCm = 0.5;
        const widthCm = Math.round(width * pxToCm);
        const heightCm = Math.round(height * pxToCm);

        document.getElementById("canvasSize").textContent =
            `Área ocupada - ${widthCm} × ${heightCm} cm`;



        // === COTAS DINÂMICAS COM SVG (versão final à prova de recriação) ===
        try {
            const canvas = document.getElementById('canvasSheet');
            if (!canvas) throw new Error('canvasSheet não encontrado');

            // remove overlay antigo (se existir)
            const existingOverlay = document.getElementById('dimensionOverlay');
            if (existingOverlay) existingOverlay.remove();

            // obtém todos os módulos visíveis
            const modules = document.querySelectorAll('.placed-module');

            // --- CASO SEM MÓDULOS ---
            if (modules.length === 0) {
                document.getElementById('canvasSize').textContent = 'Área ocupada - 0 × 0 cm';
                // remove qualquer resto de overlay
                document.querySelectorAll('#dimensionOverlay, #dimLineX, #dimLineY, .dimension-line')
                    .forEach(el => el.remove());
                console.debug('[COTAS] Nenhum módulo detectado — overlay removido e abortado.');
                return; // aborta completamente a execução
            }

            // --- CASO COM MÓDULOS ---
            const svgNS = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(svgNS, 'svg');
            svg.id = 'dimensionOverlay';
            svg.setAttribute('xmlns', svgNS);
            Object.assign(svg.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible'
            });

            const w = canvas.clientWidth || 2000;
            const h = canvas.clientHeight || 2000;
            svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

            // criar setas (markers)
            const defs = document.createElementNS(svgNS, 'defs');
            const createMarker = (id, refX, refY, pathD) => {
                const marker = document.createElementNS(svgNS, 'marker');
                marker.setAttribute('id', id);
                marker.setAttribute('markerWidth', '8');
                marker.setAttribute('markerHeight', '8');
                marker.setAttribute('refX', refX);
                marker.setAttribute('refY', refY);
                marker.setAttribute('orient', 'auto');
                marker.setAttribute('markerUnits', 'strokeWidth');
                const path = document.createElementNS(svgNS, 'path');
                path.setAttribute('d', pathD);
                path.setAttribute('fill', 'red');
                marker.appendChild(path);
                return marker;
            };
            defs.appendChild(createMarker('arrow-start-x', 0, 4, 'M8,0 L0,4 L8,8 Z'));
            defs.appendChild(createMarker('arrow-end-x', 8, 4, 'M0,0 L8,4 L0,8 Z'));
            defs.appendChild(createMarker('arrow-start-y', 0, 4, 'M8,0 L0,4 L8,8 Z'));
            defs.appendChild(createMarker('arrow-end-y', 8, 4, 'M0,0 L8,4 L0,8 Z'));
            svg.appendChild(defs);

            // cálculo das cotas
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            modules.forEach(m => {
                const left = parseInt(m.style.left) || 0;
                const top = parseInt(m.style.top) || 0;
                const width = parseInt(m.style.width) || m.offsetWidth;
                const height = parseInt(m.style.height) || m.offsetHeight;
                minX = Math.min(minX, left);
                minY = Math.min(minY, top);
                maxX = Math.max(maxX, left + width);
                maxY = Math.max(maxY, top + height);
            });

            const offset = 25;
            const pxToCm = 0.5;
            const widthCm = Math.round((maxX - minX) * pxToCm);
            const heightCm = Math.round((maxY - minY) * pxToCm);

            // linha horizontal
            const lineX = document.createElementNS(svgNS, 'line');
            lineX.setAttribute('x1', minX);
            lineX.setAttribute('y1', maxY + offset);
            lineX.setAttribute('x2', maxX);
            lineX.setAttribute('y2', maxY + offset);
            lineX.setAttribute('stroke', 'red');
            lineX.setAttribute('stroke-width', '2');
            lineX.setAttribute('marker-start', 'url(#arrow-start-x)');
            lineX.setAttribute('marker-end', 'url(#arrow-end-x)');
            svg.appendChild(lineX);

            // texto horizontal
            const textX = document.createElementNS(svgNS, 'text');
            textX.textContent = `${widthCm} cm`;
            textX.setAttribute('x', (minX + maxX) / 2);
            textX.setAttribute('y', maxY + offset + 15);
            textX.setAttribute('text-anchor', 'middle');
            textX.setAttribute('fill', 'red');
            textX.setAttribute('font-size', '14');
            textX.setAttribute('font-family', 'sans-serif');
            svg.appendChild(textX);

            // linha vertical
            const lineY = document.createElementNS(svgNS, 'line');
            lineY.setAttribute('x1', maxX + offset);
            lineY.setAttribute('y1', minY);
            lineY.setAttribute('x2', maxX + offset);
            lineY.setAttribute('y2', maxY);
            lineY.setAttribute('stroke', 'red');
            lineY.setAttribute('stroke-width', '2');
            lineY.setAttribute('marker-start', 'url(#arrow-start-y)');
            lineY.setAttribute('marker-end', 'url(#arrow-end-y)');
            svg.appendChild(lineY);

            // texto vertical
            const textY = document.createElementNS(svgNS, 'text');
            textY.textContent = `${heightCm} cm`;
            const textYx = maxX + offset + 15;
            const textYy = (minY + maxY) / 2;
            textY.setAttribute('x', textYx);
            textY.setAttribute('y', textYy);
            textY.setAttribute('transform', `rotate(-90 ${textYx} ${textYy})`);
            textY.setAttribute('text-anchor', 'middle');
            textY.setAttribute('fill', 'red');
            textY.setAttribute('font-size', '14');
            textY.setAttribute('font-family', 'sans-serif');
            svg.appendChild(textY);

            canvas.appendChild(svg);
        } catch (err) {
            console.error('[COTAS] Erro ao desenhar overlay:', err);
        }
        if (modules.length == 0) {
            // remove todos os SVGs/overlays dentro do canvas
            canvas.querySelectorAll('svg, #dimensionOverlay, #dimLineX, #dimLineY, .dimension-line')
                .forEach(el => el.remove());

            // garantia extra (caso exista função global)
            if (typeof window.__forceRemoveOverlay === 'function') window.__forceRemoveOverlay();

            document.getElementById('canvasSize').textContent = 'Área ocupada - 0 × 0 cm';
            console.debug('[COTAS] Nenhum módulo detectado — todos os SVGs removidos.');
            return;
        }
    }


    updateStatusMessage(message) {
        document.getElementById('statusMessage').textContent = message;


    }

    /////////////////////////////////////////////////////////////////////////////////////
    async exportAsPDF() {
        const canvasEl = document.getElementById('canvasSheet');
        const modules = Array.from(canvasEl.querySelectorAll('.placed-module'));

        if (modules.length === 0) {
            this.showToast('Nenhum módulo para exportar', 'warning');
            return;
        }

        const originalZoom = this.zoomLevel || 1;
        const originalPan = this.panOffset ? { ...this.panOffset } : { x: 0, y: 0 };
        const originalTransform = canvasEl.style.transform;

        this.zoomReset();
        await new Promise(resolve => setTimeout(resolve, 100));

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        modules.forEach(m => {
            const x = parseInt(m.style.left) || 0;
            const y = parseInt(m.style.top) || 0;
            const moduleData = JSON.parse(m.dataset.moduleData);
            const rotation = parseInt(m.dataset.rotation) || 0;
            const pixelsPerMM = 0.2;
            let width = Math.round(moduleData.largura * pixelsPerMM);
            let height = Math.round(moduleData.profundidade * pixelsPerMM);
            if (rotation === 90 || rotation === 270) [width, height] = [height, width];
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + width);
            maxY = Math.max(maxY, y + height);
        });

        const capWidth = maxX - minX;
        const capHeight = maxY - minY;

        try {
            // ── Canvas da imagem principal ──────────────────────────────────────
            const renderCanvas = document.createElement('canvas');
            const scale = 2;
            renderCanvas.width = capWidth * scale;
            renderCanvas.height = capHeight * scale;
            const ctx = renderCanvas.getContext('2d');
            ctx.scale(scale, scale);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, capWidth, capHeight);

            for (const m of modules) {
                const x = parseInt(m.style.left) || 0;
                const y = parseInt(m.style.top) || 0;
                const moduleData = JSON.parse(m.dataset.moduleData);
                const rotationRaw = parseInt(m.dataset.rotation) || 0;
                const rotationNorm = ((rotationRaw % 360) + 360) % 360;
                const flipX = parseInt(m.dataset.flipX) || 1;
                const flipY = parseInt(m.dataset.flipY) || 1;
                const pixelsPerMM = 0.2;
                const width = Math.round(moduleData.largura * pixelsPerMM);
                const height = Math.round(moduleData.profundidade * pixelsPerMM);
                let centerW = width, centerH = height;
                if (rotationNorm === 90 || rotationNorm === 270) { centerW = height; centerH = width; }
                const relX = x - minX;
                const relY = y - minY;

                const img = new Image();
                img.src = moduleData.image;
                await new Promise(resolve => {
                    img.onload = () => {
                        ctx.save();
                        ctx.translate(relX + centerW / 2, relY + centerH / 2);
                        ctx.rotate((rotationRaw * Math.PI) / 180);
                        ctx.scale(flipX, flipY);
                        ctx.drawImage(img, -width / 2, -height / 2, width, height);
                        ctx.restore();
                        resolve();
                    };
                    img.onerror = () => { console.warn('Falha ao carregar imagem:', moduleData.image); resolve(); };
                });

                ctx.fillStyle = 'rgba(255, 248, 248, 0)';
                ctx.font = 'bold 12px Arial';
                ctx.fillText(`${moduleData.largura}×${moduleData.profundidade}mm`, relX + 5, relY + 15);
                ctx.restore();
            }

            const imgData = renderCanvas.toDataURL('image/png');

            // ── Thumbnails dos módulos (para tabela) ────────────────────────────
            const state = this.getCanvasState();
            const thumbSize = 14; // mm no PDF

            // Pre-renderiza thumbnails como base64
            const thumbDataList = await Promise.all(state.modules.map(m => {
                return new Promise(resolve => {
                    const img = new Image();
                    img.src = m.data.image;
                    img.onload = () => {
                        const tc = document.createElement('canvas');
                        tc.width = 80; tc.height = 80;
                        const tc2 = tc.getContext('2d');
                        tc2.fillStyle = '#ffffff';
                        tc2.fillRect(0, 0, 80, 80);
                        tc2.drawImage(img, 0, 0, 80, 80);
                        resolve(tc.toDataURL('image/png'));
                    };
                    img.onerror = () => resolve(null);
                });
            }));

            // ── Criação do PDF ──────────────────────────────────────────────────
            const pdf = new jspdf.jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();   // 210
            const pageHeight = pdf.internal.pageSize.getHeight();  // 297
            const mL = 15, mR = 15, mT = 15, mB = 15;
            const contentW = pageWidth - mL - mR;

            // Fundo branco
            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');

            // ── Logo ────────────────────────────────────────────────────────────
            let cursorY = mT;
            try {
                const logoData = await this.getBase64ImageFromURL('static/images/LOGO lIDER LAB.png');
                pdf.addImage(logoData, 'PNG', mL, cursorY, 65, 10);
            } catch (e) {
                // Fallback: texto como logo
                pdf.setFontSize(22);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(0, 0, 0);
                pdf.text('LIDERLAB', mL, cursorY + 12);
            }
            cursorY += 24;

            // ── Título "SOFÁ [MODELO]" ──────────────────────────────────────────
            const modeloName = state.modules.length > 0 ? (state.modules[0].data.modelo || '') : '';
            const pageTitle = `SOFÁ ${modeloName}`.trim();
            pdf.setFontSize(13);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 30, 30);
            pdf.text(pageTitle, mL, cursorY);
            cursorY += 8;

            // ── Imagem principal ────────────────────────────────────────────────
            const imgMaxW = contentW;
            const imgMaxH = 75; // máx 100mm de altura para a imagem
            const ratio = Math.min(imgMaxW / capWidth, imgMaxH / capHeight);
            const imgW = capWidth * ratio;
            const imgH = capHeight * ratio;
            const imgX = mL + (contentW - imgW) / 2;

            pdf.addImage(imgData, 'PNG', imgX, cursorY, imgW, imgH);
            cursorY += imgH + 10;

            // ── Cabeçalho da lista ──────────────────────────────────────────────
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 30, 30);
            pdf.text('Lista de módulos', mL, cursorY);
            cursorY += 3;

            // Linha separadora abaixo do título
            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(0.4);
            pdf.line(mL, cursorY, mL + contentW, cursorY);
            cursorY += 5;

            // ── Cabeçalho da tabela ─────────────────────────────────────────────
            const colNum = mL;
            const colModelo = mL + 14;
            const colModulo = mL + 44;
            const colMedida = mL + 74;
            const colCPL = mL + 134;
            const rowH = thumbSize + 4; // altura da linha com thumbnail

            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 30, 30);
            pdf.text('#', colNum, cursorY);
            pdf.text('Modelo', colModelo, cursorY);
            pdf.text('Módulo', colModulo, cursorY);
            pdf.text('Medidas (mm)', colMedida, cursorY);
            pdf.text('CPL', colCPL, cursorY);
            cursorY += 2;

            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(0.4);
            pdf.line(mL, cursorY, mL + contentW, cursorY);
            cursorY += 4;

            // ── Linhas da tabela ────────────────────────────────────────────────
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.setTextColor(50, 50, 50);

            state.modules.forEach((m, idx) => {
                // Nova página se necessário
                if (cursorY + rowH > pageHeight - mB) {
                    pdf.addPage();
                    cursorY = mT;
                    pdf.setFont('helvetica', 'bold');
                    pdf.setFontSize(9);
                    pdf.text('#', colNum, cursorY);
                    pdf.text('Modelo', colModelo, cursorY);
                    pdf.text('Módulo', colModulo, cursorY);
                    pdf.text('Medidas (mm)', colMedida, cursorY);
                    pdf.text('CPL', colCPL, cursorY);
                    cursorY += 2;
                    pdf.setDrawColor(180, 180, 180);
                    pdf.setLineWidth(0.4);
                    pdf.line(mL, cursorY, mL + contentW, cursorY);
                    cursorY += 4;
                    pdf.setFont('helvetica', 'normal');
                    pdf.setFontSize(8.5);
                    pdf.setTextColor(50, 50, 50);
                }

                const { modelo, modulo, largura, profundidade } = m.data;
                const CPL = m.data['cpl-mod']?.trim() || '-';
                const midY = cursorY + rowH / 2 + 1.5; // baseline vertical centrada

                // Coluna #
                pdf.text(`${idx + 1}`, colNum, midY);

                // Coluna Modelo
                pdf.text(modelo || '-', colModelo, midY);

                // Coluna Módulo
                pdf.text(String(modulo || '-'), colModulo, midY);

                // Coluna Medidas: thumbnail + número do módulo + dimensões
                const thumbX = colMedida;
                const thumbY = cursorY;

                if (thumbDataList[idx]) {
                    pdf.addImage(thumbDataList[idx], 'PNG', thumbX, thumbY, thumbSize, thumbSize);
                }

                // Número do módulo (sobreposto ao thumb, canto superior esquerdo)
                // pdf.setFontSize(7);
                // pdf.setTextColor(255, 255, 255, 0);
                // pdf.setFont('helvetica', 'bold');
                // pdf.text(String(modulo || ''), thumbX + 1, thumbY + 4.5);

                // Dimensões ao lado do thumb
                pdf.setFontSize(8);
                pdf.setTextColor(50, 50, 50);
                pdf.setFont('helvetica', 'normal');
                const dimX = thumbX + thumbSize + 2;
                pdf.text(`${largura} × ${profundidade} mm`, dimX, thumbY + thumbSize / 2 + 1.5);

                // Coluna CPL
                pdf.text(String(CPL ?? 'undefined'), colCPL, midY);

                cursorY += rowH;

                // Linha divisória entre linhas
                pdf.setDrawColor(220, 220, 220);
                pdf.setLineWidth(0.2);
                pdf.line(mL, cursorY, mL + contentW, cursorY);
                cursorY += 2;

                // Reset cor/fonte para próxima linha
                pdf.setFontSize(8.5);
                pdf.setTextColor(50, 50, 50);
                pdf.setFont('helvetica', 'normal');
            });

            // ── Rodapé ──────────────────────────────────────────────────────────
            const dateTime = new Date().toLocaleString('pt-BR');
            pdf.setFontSize(7.5);
            pdf.setTextColor(160, 160, 160);
            pdf.setFont('helvetica', 'normal');
            pdf.text(`Gerado em: ${dateTime}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

            pdf.save(`sofa-layout-${Date.now()}.pdf`);
            this.showToast('PDF exportado com sucesso', 'success');

        } catch (error) {
            console.error('Erro ao exportar PDF:', error);
            this.showToast('Erro ao exportar PDF', 'error');
        } finally {
            if (typeof this.setZoom === 'function') this.setZoom(originalZoom);
            if (typeof this.setPan === 'function' && originalPan)
                this.setPan(originalPan.x, originalPan.y);
            if (originalTransform) canvasEl.style.transform = originalTransform;
        }
    }

    // Manter este método inalterado
    getBase64ImageFromURL(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = img.naturalHeight;
                canvas.width = img.naturalWidth;
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL());
            };
            img.onerror = error => reject(error);
            img.src = url;
        });
    }
    ////////////////////////////////////////////////////////////////////////////////////



    ////////////////////////////////////////////////////////////////////////////////////





    // Project management
    async loadProjects() {
        try {
            const response = await fetch('/api/projects');
            this.projects = await response.json();
            this.renderProjects(this.projects);
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    renderProjects(projects) {
        const container = document.getElementById('projectsContainer');
        container.innerHTML = '';

        if (projects.length === 0) {
            container.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="fas fa-folder-open fa-2x mb-2"></i>
                    <p>Nenhum projeto salvo ainda.</p>
                </div>
            `;
            return;
        }

        projects.forEach(project => {
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item fade-in';

            projectItem.innerHTML = `
                <div class="project-name">${project.name}</div>
                <div class="project-description">${project.description || 'Sem descrição'}</div>
                <div class="project-meta">
                    <span>Criado em ${new Date(project.created_at).toLocaleDateString('pt-BR')}</span>
                    <div class="project-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="sofaDesigner.loadProject(${project.id})">
                            <i class="fas fa-folder-open"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="sofaDesigner.deleteProject(${project.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;

            container.appendChild(projectItem);
        });
    }

    showSaveProjectModal() {
        const modal = new bootstrap.Modal(document.getElementById('saveProjectModal'));
        modal.show();
    }

    showInfoModal() {
        const modal = new bootstrap.Modal(document.getElementById('infoModal'));
        modal.show();
    }

    async saveProject() {
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();

        if (!name) {
            this.showToast('Nome do projeto é obrigatório', 'warning');
            return;
        }

        const layoutData = this.getCanvasState();

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    description,
                    layout_data: layoutData
                })
            });

            if (response.ok) {
                this.showToast('Projeto salvo com sucesso!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('saveProjectModal')).hide();
                document.getElementById('saveProjectForm').reset();
                this.loadProjects();
            } else {
                throw new Error('Erro ao salvar projeto');
            }
        } catch (error) {
            console.error('Save project error:', error);
            this.showToast('Erro ao salvar projeto', 'error');
        }
    }

    async loadProject(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}`);
            const project = await response.json();

            if (confirm(`Carregar projeto "${project.name}"? Isso substituirá o conteúdo atual do canvas.`)) {
                this.restoreState(project.layout_data);
                this.showToast(`Projeto "${project.name}" carregado`, 'success');
            }
        } catch (error) {
            console.error('Load project error:', error);
            this.showToast('Erro ao carregar projeto', 'error');
        }
    }

    async deleteProject(projectId) {
        if (confirm('Tem certeza que deseja excluir este projeto?')) {
            try {
                const response = await fetch(`/api/projects/${projectId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.showToast('Projeto excluído com sucesso', 'success');
                    this.loadProjects();
                } else {
                    throw new Error('Erro ao excluir projeto');
                }
            } catch (error) {
                console.error('Delete project error:', error);
                this.showToast('Erro ao excluir projeto', 'error');
            }
        }
    }

    // Export functions
    exportAsPNG() {
        // Implementation would use html2canvas or similar library
        this.showToast('Exportação PNG em desenvolvimento', 'info');
    }

    exportAsJSON() {
        const data = this.getCanvasState();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `sofa-layout-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
        this.showToast('Layout exportado como JSON', 'success');
    }

    // Utility functions
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.toggle('d-none', !show);
    }

    showToast(message, type = 'info') {
        // Create toast container if it doesn't exist
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-body d-flex align-items-center">
                <i class="fas fa-${this.getToastIcon(type)} me-2"></i>
                ${message}
                <button type="button" class="btn-close ms-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

        container.appendChild(toast);

        // Initialize and show toast
        const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
        bsToast.show();

        // Remove element after hiding
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    initializeTooltips() {
        // Initialize Bootstrap tooltips
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

function updateStatusBarPosition() {
    const sidebar = document.getElementById('sidebar');
    const statusBar = document.getElementById('statusBar');



}

// Atualiza ao carregar a página
window.addEventListener('load', updateStatusBarPosition);

// Atualiza se a janela mudar de tamanho
window.addEventListener('resize', updateStatusBarPosition);

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sofaDesigner = new SofaDesigner();
});
function emulateMouseEvents(element) {
    element.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const mouseDown = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(mouseDown);
    });

    element.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        const mouseMove = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(mouseMove);
    });

    element.addEventListener('touchend', (e) => {
        const mouseUp = new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(mouseUp);
    });
}

// aplica no canvas ou nos módulos arrastáveis
document.querySelectorAll('.moduleElement').forEach(el => emulateMouseEvents(el));
