// Steam API Configuration
const STEAM_API_KEY = '4EA6FC72CD2D41BD23DA659676B159FF';

// CORS Proxy
const CORS_PROXY = 'https://corsproxy.io/?';

// State
let currentLang = 'en';
let currentCurrency = 'USD';
let currentPage = 1;
let currentSort = 'popularity';
let allDeals = [];
let itemsPerPage = 30;

// Currency symbols
const currencySymbols = {
    USD: '$',
    UAH: '₴',
    RUB: '₽'
};

// Country codes for Steam API
const currencyCountries = {
    USD: 'US',
    UAH: 'UA',
    RUB: 'RU'
};

// Helper function to fetch through CORS proxy
async function fetchWithProxy(url) {
    const proxyUrl = CORS_PROXY + encodeURIComponent(url);
    const response = await fetch(proxyUrl);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Translations
const translations = {
    en: {
        title: 'Steam Deals',
        loading: 'Loading deals...',
        error: 'Failed to load deals. Please try again later.',
        discount: '-{discount}%',
        filters: 'Filters',
        sortBy: 'Sort by',
        popularity: 'Popularity',
        discountSize: 'Discount Size',
        reviewCount: 'Review Count',
        game: 'Game',
        price: 'Price',
        reviews: 'Reviews',
        page: 'Page',
        of: 'of'
    },
    ru: {
        title: 'Скидки Steam',
        loading: 'Загрузка скидок...',
        error: 'Не удалось загрузить скидки. Попробуйте позже.',
        discount: '-{discount}%',
        filters: 'Фильтры',
        sortBy: 'Сортировать по',
        popularity: 'Популярности',
        discountSize: 'Размеру скидки',
        reviewCount: 'Количеству отзывов',
        game: 'Игра',
        price: 'Цена',
        reviews: 'Отзывы',
        page: 'Страница',
        of: 'из'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupLanguageSelector();
    setupCurrencySelector();
    setupSortSelector();
    loadDeals();
});

// Language selector
function setupLanguageSelector() {
    const langBtns = document.querySelectorAll('.lang-btn');

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLang = btn.dataset.lang;
            updateTranslations();
            updateDisplay();
        });
    });
}

// Currency selector
function setupCurrencySelector() {
    const currencySelect = document.getElementById('currency-select');

    currencySelect.addEventListener('change', (e) => {
        currentCurrency = e.target.value;
        currentPage = 1;
        loadDeals();
    });
}

// Sort selector
function setupSortSelector() {
    const sortSelect = document.getElementById('sort-select');

    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 1;
        sortDeals();
        updateDisplay();
    });
}

// Update translations
function updateTranslations() {
    const elements = document.querySelectorAll('[data-translate]');
    const lang = translations[currentLang];

    elements.forEach(el => {
        const key = el.dataset.translate;
        if (lang[key]) {
            el.textContent = lang[key];
        }
    });

    // Update sort select options
    const sortSelect = document.getElementById('sort-select');
    sortSelect.querySelector('[value="popularity"]').textContent = lang.popularity;
    sortSelect.querySelector('[value="discount"]').textContent = lang.discountSize;
    sortSelect.querySelector('[value="reviews"]').textContent = lang.reviewCount;
}

// Load deals from Steam
async function loadDeals() {
    const loadingEl = document.getElementById('loading');
    const tbodyEl = document.getElementById('deals-tbody');

    loadingEl.style.display = 'flex';
    tbodyEl.innerHTML = '';
    document.getElementById('pagination').innerHTML = '';

    try {
        // Get featured categories from Steam through CORS proxy
        const steamUrl = `https://store.steampowered.com/api/featuredcategories?cc=${currencyCountries[currentCurrency]}`;
        const data = await fetchWithProxy(steamUrl);
        const specials = data.specials?.items || [];

        if (specials.length === 0) {
            showError();
            return;
        }

        // Get detailed info for each game
        const deals = await Promise.all(
            specials.map(item => getGameDetails(item.id))
        );

        // Filter only games with discounts
        allDeals = deals.filter(game => game && game.discount > 0);

        if (allDeals.length === 0) {
            showError();
            return;
        }

        // Add popularity index from specials order
        allDeals.forEach((game, index) => {
            game.popularityIndex = specials.findIndex(s => s.id === game.id);
        });

        // Sort and display
        sortDeals();
        updateDisplay();
    } catch (error) {
        console.error('Error loading deals:', error);
        showError();
    } finally {
        loadingEl.style.display = 'none';
    }
}

// Show error message
function showError() {
    const tbodyEl = document.getElementById('deals-tbody');
    tbodyEl.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #8f98a0;">${translations[currentLang].error}</td></tr>`;
}

// Get game details
async function getGameDetails(appId) {
    try {
        const steamUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=${currencyCountries[currentCurrency]}`;
        const data = await fetchWithProxy(steamUrl);
        const gameData = data[appId];

        if (!gameData?.success) {
            return null;
        }

        const game = gameData.data;
        const priceInfo = game.price_overview || {};
        const recommendations = game.recommendations || {};
        const positiveReviews = game.positive_reviews || 0;
        const totalReviews = game.total_reviews || 0;

        return {
            id: appId,
            name: game.name,
            image: game.header_image,
            discount: priceInfo.discount_percent || 0,
            originalPrice: priceInfo.initial_formatted || '',
            finalPrice: priceInfo.final_formatted || '',
            reviewCount: recommendations.total || 0,
            positiveReviews: positiveReviews,
            totalReviews: totalReviews,
            url: `https://store.steampowered.com/app/${appId}`
        };
    } catch (error) {
        console.error(`Error fetching details for app ${appId}:`, error);
        return null;
    }
}

// Sort deals
function sortDeals() {
    switch (currentSort) {
        case 'popularity':
            allDeals.sort((a, b) => a.popularityIndex - b.popularityIndex);
            break;
        case 'discount':
            allDeals.sort((a, b) => b.discount - a.discount);
            break;
        case 'reviews':
            allDeals.sort((a, b) => b.reviewCount - a.reviewCount);
            break;
    }
}

// Update display
function updateDisplay() {
    const tbodyEl = document.getElementById('deals-tbody');
    tbodyEl.innerHTML = '';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageDeals = allDeals.slice(startIndex, endIndex);

    pageDeals.forEach(game => {
        const row = createTableRow(game);
        tbodyEl.appendChild(row);
    });

    updatePagination();
}

// Create table row
function createTableRow(game) {
    const row = document.createElement('tr');
    row.onclick = () => window.open(game.url, '_blank');

    const discountText = translations[currentLang].discount.replace('{discount}', game.discount);

    // Format reviews count
    const reviewsText = game.reviewCount > 0
        ? formatNumber(game.reviewCount)
        : '-';

    // Calculate positive percentage if available
    const positivePercent = game.totalReviews > 0
        ? Math.round((game.positiveReviews / game.totalReviews) * 100)
        : null;

    const reviewsClass = positivePercent && positivePercent >= 80
        ? 'reviews-positive'
        : '';

    row.innerHTML = `
        <td>
            <div class="game-cell">
                <img src="${game.image}" alt="${game.name}" loading="lazy">
                <span class="game-name">${game.name}</span>
            </div>
        </td>
        <td>
            <span class="discount-badge">${discountText}</span>
        </td>
        <td>
            <div class="price-cell">
                ${game.originalPrice ? `<span class="original-price">${game.originalPrice}</span>` : ''}
                <span class="final-price">${game.finalPrice}</span>
            </div>
        </td>
        <td>
            <div class="reviews-cell ${reviewsClass}">
                ${reviewsText}
                ${positivePercent ? `<span style="color: var(--discount-green); margin-left: 0.5rem;">(${positivePercent}%)</span>` : ''}
            </div>
        </td>
    `;

    return row;
}

// Format number (e.g., 1000 -> 1K)
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Update pagination
function updatePagination() {
    const paginationEl = document.getElementById('pagination');
    const totalPages = Math.ceil(allDeals.length / itemsPerPage);

    paginationEl.innerHTML = '';

    if (totalPages <= 1) {
        return;
    }

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '←';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            updateDisplay();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    paginationEl.appendChild(prevBtn);

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        const firstBtn = document.createElement('button');
        firstBtn.textContent = '1';
        firstBtn.onclick = () => {
            currentPage = 1;
            updateDisplay();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        paginationEl.appendChild(firstBtn);

        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-info';
            paginationEl.appendChild(dots);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === currentPage ? 'active' : '';
        pageBtn.onclick = () => {
            currentPage = i;
            updateDisplay();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        paginationEl.appendChild(pageBtn);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-info';
            paginationEl.appendChild(dots);
        }

        const lastBtn = document.createElement('button');
        lastBtn.textContent = totalPages;
        lastBtn.onclick = () => {
            currentPage = totalPages;
            updateDisplay();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        paginationEl.appendChild(lastBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = '→';
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            updateDisplay();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    paginationEl.appendChild(nextBtn);

    // Page info
    const pageInfo = document.createElement('div');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `${translations[currentLang].page} ${currentPage} ${translations[currentLang].of} ${totalPages}`;
    paginationEl.appendChild(pageInfo);
}
