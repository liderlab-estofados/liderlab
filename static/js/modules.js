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

    init() {
        this.setupModuleFilters();
    }

    setupModuleFilters() {
        // Module filters setup - currently disabled
        // Future: add category filter, search, dimensions filters
    }

    // Removed unused createCategoryFilter - was causing ReferenceError
    // Category filter functionality moved to main.js renderModules

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
