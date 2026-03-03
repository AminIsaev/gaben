// State
let currentLang = 'en';
let currentCurrency = 'USD';
let currentPage = 1;
let currentSort = 'popularity';
let allDeals = [];
let filteredDeals = [];
let itemsPerPage = 30;
let cachedData = null;

// Filter state
const filters = {
    discountMin: 0,
    discountMax: 100,
    priceMin: null,
    priceMax: null,
    ratingMin: 0,
    reviewsMin: 0,
    genre: '',
    releaseYear: ''
};

// Currency mapping
const currencyMapping = {
    USD: 'US',
    UAH: 'UA',
    RUB: 'RU'
};

// Currency to numeric multiplier for price filtering
const currencyMultipliers = {
    USD: 1,
    UAH: 0.025,
    RUB: 0.01
};

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
        price: 'Price',
        rating: 'Rating',
        reviewCount: 'Review Count',
        game: 'Game',
        reviews: 'Reviews',
        page: 'Page',
        of: 'of',
        lastUpdated: 'Last updated: {date}',
        discountFilter: 'Discount',
        priceFilter: 'Price',
        ratingFilter: 'Rating',
        reviewsFilter: 'Min Reviews',
        genreFilter: 'Genre',
        releaseFilter: 'Release Year'
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
        price: 'Цена',
        rating: 'Рейтинг',
        reviewCount: 'Количеству отзывов',
        game: 'Игра',
        reviews: 'Отзывы',
        page: 'Страница',
        of: 'из',
        lastUpdated: 'Обновлено: {date}',
        discountFilter: 'Скидка',
        priceFilter: 'Цена',
        ratingFilter: 'Рейтинг',
        reviewsFilter: 'Мин. отзывов',
        genreFilter: 'Жанр',
        releaseFilter: 'Год выпуска'
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setupLanguageSelector();
    setupCurrencySelector();
    setupFilters();

    // Load cached data
    await loadCachedData();

    if (cachedData) {
        displayDeals();
    }
});

// Setup filters
function setupFilters() {
    // Sort selector
    const sortSelect = document.getElementById('sort-select');
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        currentPage = 1;
        applyFilters();
    });

    // Discount filters
    document.getElementById('discount-min').addEventListener('change', (e) => {
        filters.discountMin = parseInt(e.target.value);
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('discount-max').addEventListener('change', (e) => {
        filters.discountMax = parseInt(e.target.value);
        currentPage = 1;
        applyFilters();
    });

    // Price filters
    document.getElementById('price-min').addEventListener('input', (e) => {
        filters.priceMin = e.target.value ? parseFloat(e.target.value) : null;
        currentPage = 1;
        applyFilters();
    });
    document.getElementById('price-max').addEventListener('input', (e) => {
        filters.priceMax = e.target.value ? parseFloat(e.target.value) : null;
        currentPage = 1;
        applyFilters();
    });

    // Rating filter
    document.getElementById('rating-min').addEventListener('change', (e) => {
        filters.ratingMin = parseInt(e.target.value);
        currentPage = 1;
        applyFilters();
    });

    // Reviews filter
    document.getElementById('reviews-min').addEventListener('change', (e) => {
        filters.reviewsMin = parseInt(e.target.value);
        currentPage = 1;
        applyFilters();
    });

    // Genre filter
    document.getElementById('genre-select').addEventListener('change', (e) => {
        filters.genre = e.target.value;
        currentPage = 1;
        applyFilters();
    });

    // Release year filter
    document.getElementById('release-year').addEventListener('change', (e) => {
        filters.releaseYear = e.target.value;
        currentPage = 1;
        applyFilters();
    });

    // Clear filters button
    document.getElementById('clear-filters').addEventListener('click', clearAllFilters);
}

// Apply all filters
function applyFilters() {
    filteredDeals = allDeals.filter(game => {
        // Discount filter
        if (game.discount < filters.discountMin || game.discount > filters.discountMax) {
            return false;
        }

        // Price filter (convert to USD for comparison)
        const priceUSD = parsePriceToUSD(game.finalPrice);
        if (filters.priceMin !== null && priceUSD < filters.priceMin) return false;
        if (filters.priceMax !== null && priceUSD > filters.priceMax) return false;

        // Rating filter
        if (game.ratingPercent < filters.ratingMin) return false;

        // Reviews filter
        if (game.reviewCount < filters.reviewsMin) return false;

        // Genre filter
        if (filters.genre && !game.genres.includes(filters.genre)) return false;

        // Release year filter
        if (filters.releaseYear) {
            const gameYear = extractYear(game.releaseDate);
            if (!gameYear) return false;

            switch (filters.releaseYear) {
                case '2025':
                case '2024':
                case '2023':
                case '2022':
                case '2021':
                case '2020':
                    if (gameYear !== parseInt(filters.releaseYear)) return false;
                    break;
                case '2010s':
                    if (gameYear < 2010 || gameYear > 2019) return false;
                    break;
                case '2000s':
                    if (gameYear < 2000 || gameYear > 2009) return false;
                    break;
            }
        }

        return true;
    });

    // Sort
    sortDeals();

    // Update display
    updateDealsCount();
    updateDisplay();
    updateActiveFilters();
}

// Parse price string to USD (approximate)
function parsePriceToUSD(priceStr) {
    // Remove currency symbols and convert
    const cleaned = priceStr.replace(/[^\d.,]/g, '').replace(',', '.');
    const numPrice = parseFloat(cleaned) || 0;

    // Convert to USD based on current currency
    const multiplier = currencyMultipliers[currentCurrency] || 1;
    return numPrice * multiplier;
}

// Extract year from date string
function extractYear(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/\d{4}/);
    return match ? parseInt(match[0]) : null;
}

// Clear all filters
function clearAllFilters() {
    filters.discountMin = 0;
    filters.discountMax = 100;
    filters.priceMin = null;
    filters.priceMax = null;
    filters.ratingMin = 0;
    filters.reviewsMin = 0;
    filters.genre = '';
    filters.releaseYear = '';

    // Reset UI
    document.getElementById('discount-min').value = '0';
    document.getElementById('discount-max').value = '100';
    document.getElementById('price-min').value = '';
    document.getElementById('price-max').value = '';
    document.getElementById('rating-min').value = '0';
    document.getElementById('genre-select').value = '';
    document.getElementById('release-year').value = '';

    currentPage = 1;
    applyFilters();
}

// Update deals count
function updateDealsCount() {
    document.getElementById('deals-count').textContent = filteredDeals.length;
}

// Update active filters display
function updateActiveFilters() {
    const container = document.getElementById('active-filters');
    container.innerHTML = '';

    const activeFilters = [];

    if (filters.discountMin > 0 || filters.discountMax < 100) {
        activeFilters.push(`Discount: ${filters.discountMin}-${filters.discountMax}%`);
    }
    if (filters.priceMin !== null || filters.priceMax !== null) {
        const min = filters.priceMin !== null ? filters.priceMin : 0;
        const max = filters.priceMax !== null ? filters.priceMax : '∞';
        activeFilters.push(`Price: $${min}-${max}`);
    }
    if (filters.ratingMin > 0) {
        activeFilters.push(`Rating: ${filters.ratingMin}%+`);
    }
    if (filters.reviewsMin > 0) {
        activeFilters.push(`Reviews: ${filters.reviewsMin}+`);
    }
    if (filters.genre) {
        activeFilters.push(`Genre: ${filters.genre}`);
    }
    if (filters.releaseYear) {
        activeFilters.push(`Year: ${filters.releaseYear}`);
    }

    activeFilters.forEach(filter => {
        const tag = document.createElement('span');
        tag.className = 'filter-tag';
        tag.innerHTML = `
            ${filter}
            <button onclick="clearAllFilters()">×</button>
        `;
        container.appendChild(tag);
    });
}

// Load cached data from JSON file
async function loadCachedData() {
    const loadingEl = document.getElementById('loading');
    const tbodyEl = document.getElementById('deals-tbody');

    loadingEl.style.display = 'flex';
    tbodyEl.innerHTML = '';

    try {
        const response = await fetch('steam-deals.json');

        if (!response.ok) {
            throw new Error('Failed to load cached data');
        }

        cachedData = await response.json();

        // Show last updated time
        if (cachedData.lastUpdated) {
            const lastUpdated = new Date(cachedData.lastUpdated);
            const timeAgo = getTimeAgo(lastUpdated);
            console.log(`📅 Cache updated: ${timeAgo}`);
        }

        console.log(`🎮 Loaded ${cachedData.totalGames} games`);

        loadingEl.style.display = 'none';
    } catch (error) {
        console.error('Error loading cached data:', error);
        showError();
        loadingEl.style.display = 'none';
    }
}

// Get time ago string
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
        }
    }

    return 'just now';
}

// Display deals from cache
function displayDeals() {
    allDeals = cachedData.deals.map(game => {
        const countryCode = currencyMapping[currentCurrency];
        const priceData = game.prices[countryCode] || game.prices['US'] || {};

        // Calculate rating percentage
        const ratingPercent = game.totalReviews > 0
            ? Math.round((game.positive_reviews / game.totalReviews) * 100)
            : 0;

        return {
            id: game.id,
            name: game.name,
            image: game.header_image,
            discount: priceData.discount_percent || 0,
            originalPrice: priceData.initial_formatted || '',
            finalPrice: priceData.final_formatted || '',
            reviewCount: game.recommendations || 0,
            positiveReviews: game.positive_reviews || 0,
            totalReviews: game.total_reviews || 0,
            ratingPercent: ratingPercent,
            popularityIndex: game.popularityIndex,
            url: game.url,
            genres: game.genres || [],
            tags: game.tags || [],
            description: game.short_description || '',
            releaseDate: game.release_date || ''
        };
    });

    // Populate genre filter
    populateGenreFilter();

    // Apply initial filters
    applyFilters();
}

// Populate genre filter dropdown
function populateGenreFilter() {
    const genreSelect = document.getElementById('genre-select');
    const allGenres = new Set();

    allDeals.forEach(game => {
        game.genres?.forEach(genre => allGenres.add(genre));
    });

    // Clear existing options (except first)
    while (genreSelect.options.length > 1) {
        genreSelect.remove(1);
    }

    // Add genres alphabetically
    Array.from(allGenres).sort().forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        genreSelect.appendChild(option);
    });
}

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
        displayDeals();
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
    sortSelect.querySelector('[value="price"]').textContent = lang.price;
    sortSelect.querySelector('[value="rating"]').textContent = lang.rating;
    sortSelect.querySelector('[value="reviews"]').textContent = lang.reviewCount;
}

// Show error message
function showError() {
    const tbodyEl = document.getElementById('deals-tbody');
    tbodyEl.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #8f98a0;">${translations[currentLang].error}</td></tr>`;
}

// Sort deals
function sortDeals() {
    switch (currentSort) {
        case 'popularity':
            filteredDeals.sort((a, b) => a.popularityIndex - b.popularityIndex);
            break;
        case 'discount':
            filteredDeals.sort((a, b) => b.discount - a.discount);
            break;
        case 'price':
            filteredDeals.sort((a, b) => parsePriceToUSD(a.finalPrice) - parsePriceToUSD(b.finalPrice));
            break;
        case 'rating':
            filteredDeals.sort((a, b) => b.ratingPercent - a.ratingPercent);
            break;
        case 'reviews':
            filteredDeals.sort((a, b) => b.reviewCount - a.reviewCount);
            break;
    }
}

// Update display
function updateDisplay() {
    const tbodyEl = document.getElementById('deals-tbody');
    const noResultsEl = document.getElementById('no-results');
    const tableContainer = document.querySelector('.deals-table-container');

    tbodyEl.innerHTML = '';

    if (filteredDeals.length === 0) {
        tableContainer.style.display = 'none';
        noResultsEl.style.display = 'block';
        return;
    }

    tableContainer.style.display = 'block';
    noResultsEl.style.display = 'none';

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageDeals = filteredDeals.slice(startIndex, endIndex);

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

    // Rating color
    const ratingClass = game.ratingPercent >= 80 ? 'rating-high' :
                       game.ratingPercent >= 60 ? 'rating-medium' : 'rating-low';

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
            <span class="rating-cell ${ratingClass}">${game.ratingPercent > 0 ? game.ratingPercent + '%' : '-'}</span>
        </td>
        <td>
            <div class="reviews-cell">
                ${reviewsText}
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
    const totalPages = Math.ceil(filteredDeals.length / itemsPerPage);

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
