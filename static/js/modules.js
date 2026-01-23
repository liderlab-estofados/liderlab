// Module management and interaction utilities
class ModuleManager {
    constructor() {
        this.moduleDatabase = new Map();
        this.categories = new Set();
        this.filters = {
            category: 'all',
            search: '',
            dimensions: { min: null, max: null }
        };
        
        this.init();
    }

    // init() {    
    //     this.setupModuleFilters();
    // }

    setupModuleFilters() {
        // Category filter
        const categoryFilter = this.createCategoryFilter();
        const modulesContainer = document.getElementById('modulesContainer');
        
        if (modulesContainer) {
            const filterContainer = document.createElement('div');
            filterContainer.className = 'module-filters mb-3';
            filterContainer.appendChild(categoryFilter);
            modulesContainer.parentNode.insertBefore(filterContainer, modulesContainer);
        }
    }

    createCategoryFilter() {
        const container = document.createElement('div');
        container.className = 'category-filter mb-2';
        
        const label = document.createElement('label');
        label.className = 'form-label small';
        label.textContent = 'Filtrar por categoria:';
        
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.innerHTML = '<option value="all">Todas as categorias</option>';
        
        select.addEventListener('change', (e) => {
            this.filters.category = e.target.value;
            this.applyFilters();
        });
        
        container.appendChild(label);
        container.appendChild(select);
        
        return container;
    }

    updateCategories(modules) {
        this.categories.clear();
        modules.forEach(module => {
            if (module.categoria) {
                this.categories.add(module.categoria);
            }
        });
        
        this.updateCategoryFilter();
    }

    updateCategoryFilter() {
        const select = document.querySelector('.category-filter select');
        if (!select) return;
        
        // Keep current selection
        const currentValue = select.value;
        
        // Clear and rebuild options
        select.innerHTML = '<option value="all">Todas as categorias</option>';
        
        Array.from(this.categories).sort().forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
        
        // Restore selection if still valid
        if (Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    }

    applyFilters() {
        const moduleItems = document.querySelectorAll('.module-item');
        
        moduleItems.forEach(item => {
            const moduleData = JSON.parse(item.dataset.moduleData || '{}');
            let show = true;
            
            // Category filter
            if (this.filters.category !== 'all') {
                show = show && moduleData.categoria === this.filters.category;
            }
            
            // Search filter (if needed in the future)
            if (this.filters.search) {
                const searchText = this.filters.search.toLowerCase();
                const moduleText = `${moduleData.modulo} ${moduleData.modelo}`.toLowerCase();
                show = show && moduleText.includes(searchText);
            }
            
            item.style.display = show ? 'flex' : 'none';
        });
        
        this.updateFilterSummary();
    }

    updateFilterSummary() {
        const visible = document.querySelectorAll('.module-item[style*="flex"], .module-item:not([style*="none"])').length;
        const total = document.querySelectorAll('.module-item').length;
        
        let summary = document.querySelector('.filter-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.className = 'filter-summary small text-muted mb-2';
            const container = document.getElementById('modulesContainer');
            container.parentNode.insertBefore(summary, container);
        }
        
        if (visible < total) {
            summary.textContent = `Mostrando ${visible} de ${total} módulos`;
            summary.style.display = 'block';
        } else {
            summary.style.display = 'none';
        }
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

    addModuleToDatabase(moduleData) {
        this.moduleDatabase.set(moduleData.id, moduleData);
        if (moduleData.categoria) {
            this.categories.add(moduleData.categoria);
        }
    }

    getModuleFromDatabase(moduleId) {
        return this.moduleDatabase.get(moduleId);
    }
}

// Initialize module manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.moduleManager = new ModuleManager();
});
document.querySelectorAll('.moduleElement').forEach(el => emulateMouseEvents(el));
