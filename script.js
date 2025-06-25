
// script.js
//  API_KEY = 'AIzaSyATH0UghO4r4yhyyydpPFYviLKvHypj7sk'


//chave da API do YouTube Data v3
const API_KEY = 'AIzaSyATH0UghO4r4yhyyydpPFYviLKvHypj7sk'; 
const BASE_URL = 'https://www.googleapis.com/youtube/v3';

// Elementos do DOM
const prevLiveBtn = document.getElementById('prev-live-btn');
const nextLiveBtn = document.getElementById('next-live-btn');
const videoPlayerContainer = document.getElementById('video-player-container');

const categoryCheckboxesContainer = document.getElementById('category-checkboxes');
const applyFiltersBtn = document.getElementById('apply-filters-btn');

// VARIAVEIS GLOBAIS
let currentLives = [];
let currentLiveIndex = -1;
let historyLives = [];
const HISTORY_MAX_SIZE = 15;
let youtubePlayerInstance = null;
let selectedCategoryIds = []; // Array para armazenar os IDs das categorias selecionadas

let quotaExceeded = false; // Flag para indicar se a cota do Google Console foi excedida (10k por 100 queries por dia)

// Lista de países para buscar lives ALEATORIAMENTE
const COUNTRIES_FOR_RANDOM_SEARCH = {
    "BR": "Brasil", "US": "Estados Unidos", "CO": "Colômbia", "IN": "Índia",
    "JP": "Japão", "KR": "Coreia do Sul", "DE": "Alemanha", "FR": "França",
    "GB": "Reino Unido", "CA": "Canadá", "AU": "Austrália", "MX": "México",
    "ES": "Espanha", "AR": "Argentina", "PT": "Portugal", "RU": "Rússia",
    "ZA": "África do Sul", "EG": "Egito", "ID": "Indonésia", "NG": "Nigéria",
    "TR": "Turquia", "CL": "Chile", "PE": "Peru", "IT": "Itália",
    "SE": "Suécia", "NL": "Holanda", "CH": "Suíça", "DK": "Dinamarca",
    "NO": "Noruega", "FI": "Finlândia", "GR": "Grécia", "PL": "Polônia",
    "CZ": "República Tcheca", "HU": "Hungria", "RO": "Romênia", "UA": "Ucrânia",
    "NZ": "Nova Zelândia", "PH": "Filipinas", "VN": "Vietnã", "TH": "Tailândia",
    "MY": "Malásia", "SG": "Singapura", "AE": "Emirados Árabes Unidos",
    "SA": "Arábia Saudita", "IL": "Israel", "IE": "Irlanda", "BE": "Bélgica",
    "AT": "Áustria"
};

// Lista de categorias do YouTube (apenas algumas relevantes para lives)
// IDs obtidos da YouTube Data API (videoCategories.list)
const YOUTUBE_CATEGORIES = [
    { id: "10", name: "Música" },
    { id: "17", name: "Esportes" },
    { id: "20", name: "Jogos" },
    { id: "22", name: "Pessoas e Blogs" },
    { id: "24", name: "Entretenimento" },
    { id: "25", name: "Notícias e Política" },
    { id: "26", name: "Como Fazer e Estilo" },
    { id: "27", name: "Educação" },
    { id: "28", name: "Ciência e Tecnologia" },
    { id: "43", name: "Natureza" } 

];


// --- Funções de Inicialização ---

function onYouTubeIframeAPIReady() {
    console.log("YouTube IFrame API Ready.");
}

function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// Função para popular os checkboxes de categoria
function populateCategoryCheckboxes() {
    categoryCheckboxesContainer.innerHTML = ''; // Limpa qualquer conteúdo existente
    selectedCategoryIds = []; // Reseta a seleção atual

    YOUTUBE_CATEGORIES.forEach(category => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = category.id;
        checkbox.checked = true; // Por padrão, todas vêm selecionadas
        checkbox.name = 'category';

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${category.name}`));
        categoryCheckboxesContainer.appendChild(label);

        selectedCategoryIds.push(category.id); // Adiciona todas as IDs à lista de selecionadas por padrão
    });
}

// Função para atualizar as categorias selecionadas
function updateSelectedCategories() {
    selectedCategoryIds = [];
    const checkboxes = categoryCheckboxesContainer.querySelectorAll('input[name="category"]:checked');
    checkboxes.forEach(checkbox => {
        selectedCategoryIds.push(checkbox.value);
    });
    console.log("Categorias selecionadas:", selectedCategoryIds);

    if (selectedCategoryIds.length === 0) {
        alert("Por favor, selecione pelo menos uma categoria.");
        // Opcional: Reverter para todas selecionadas ou um conjunto padrão.
        // populateCategoryCheckboxes(); // Para re-selecionar todas, por exemplo
        return false;
    }
    return true;
}


// --- Funções Auxiliares de UI ---

function showPlayer() {
    // Apenas garante que o player esteja visível, já que o grid foi removido
    videoPlayerContainer.classList.remove('hidden'); 
}

function updateNavigationButtons() {
    prevLiveBtn.disabled = historyLives.length === 0 || quotaExceeded;
    nextLiveBtn.disabled = (currentLives.length === 0 && currentLiveIndex === -1) || quotaExceeded; 
    applyFiltersBtn.disabled = quotaExceeded; // Desabilita o botão de filtro também
}

function clearPlayer() {
    videoPlayerContainer.innerHTML = '<p>Carregando sua primeira live...</p>';
    if (youtubePlayerInstance) {
        youtubePlayerInstance.destroy();
        youtubePlayerInstance = null;
    }
    // Limpar mensagem de cota se estiver presente
    const quotaMessage = document.getElementById('quota-message');
    if (quotaMessage) quotaMessage.remove();
}

// Função para exibir mensagem de erro de cota
function displayQuotaError() {
    quotaExceeded = true;
    clearPlayer(); // Limpa o player e a mensagem de carregamento
    const errorMessageDiv = document.createElement('div');
    errorMessageDiv.id = 'quota-message';
    errorMessageDiv.style.textAlign = 'center';
    errorMessageDiv.style.color = 'red';
    errorMessageDiv.style.marginTop = '20px';
    errorMessageDiv.innerHTML = `
        <p>Atenção: A cota diária de requisições da API do YouTube foi excedida.</p>
        <p>Por favor, tente novamente em algumas horas ou amanhã.</p>
        <button id="retry-button" style="padding: 10px 20px; margin-top: 15px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Tentar Novamente</button>
    `;
    document.querySelector('main.content').appendChild(errorMessageDiv); // Adiciona a mensagem ao main

    document.getElementById('retry-button').addEventListener('click', () => {
        quotaExceeded = false; // Reseta a flag ao tentar novamente
        clearPlayer(); // Limpa a mensagem de erro
        loadRandomLive(); // Tenta carregar uma live novamente
    });

    // Desabilita os botões de navegação e de filtro enquanto a cota estiver excedida
    prevLiveBtn.disabled = true;
    nextLiveBtn.disabled = true;
    applyFiltersBtn.disabled = true;
}


// --- Funções de Busca na API do YouTube ---

async function fetchLives(regionCode, maxResults = 50, categoryIds = []) {
    // Se a cota já foi excedida, não faz a requisição
    if (quotaExceeded) {
        console.warn("Cota excedida. Abortando requisição.");
        return []; // Retorna um array vazio para não prosseguir
    }

    let url = `${BASE_URL}/search?part=snippet&eventType=live&type=video&videoEmbeddable=true&regionCode=${regionCode}&maxResults=${maxResults}&key=${API_KEY}`;
    
    let selectedCategoryId = '';
    if (categoryIds.length > 0) {
        // Escolhe uma categoria aleatória dentre as selecionadas para a busca
        selectedCategoryId = categoryIds[Math.floor(Math.random() * categoryIds.length)];
        url += `&videoCategoryId=${selectedCategoryId}`;
        console.log(`Buscando em categoria sorteada: ${YOUTUBE_CATEGORIES.find(c => c.id === selectedCategoryId)?.name || selectedCategoryId}`);
    } else {
        // Se nenhuma categoria estiver selecionada (o que deveria ser evitado pelo updateSelectedCategories),ele buscará sem filtro de categoria.
        console.warn("Nenhuma categoria selecionada. Buscando lives sem filtro de categoria.");
    }


    console.log(`Fetching URL for ${regionCode} (Category: ${selectedCategoryId || 'Any'}):`, url);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            // Tenta parsear o erro para verificar se é de cota
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error && errorJson.error.errors && errorJson.error.errors[0] && errorJson.error.errors[0].reason === 'quotaExceeded') {
                    displayQuotaError(); // Exibe a mensagem de cota excedida
                    throw new Error("Quota Exceeded"); // Lança um erro específico para ser pego
                }
            } catch (parseError) {
                // Não é um JSON de erro da API ou não é erro de cota. Apenas loga.
                console.error("Erro ao parsear resposta de erro da API:", parseError);
            }
            throw new Error(`Erro na API do YouTube: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        console.log(`Lives retornadas para ${COUNTRIES_FOR_RANDOM_SEARCH[regionCode] || regionCode}:`, data.items.map(item => item.id.videoId));
        return data.items || [];
    } catch (error) {
        console.error("Erro ao buscar lives:", error);
        // Se o erro foi de cota, a flag já está marcada e a mensagem já foi exibida
        if (error.message === "Quota Exceeded") {
            return []; // Retorna vazio para parar o processamento de lives
        }
        alert("Não foi possível carregar as lives. Por favor, tente novamente mais tarde.");
        return [];
    }
}

// --- Funções de Exibição e Navegação ---

async function loadLive(videoId) {
    if (!videoId) {
        console.warn("Nenhum Video ID fornecido para carregar a live.");
        clearPlayer();
        return false;
    }

    if (youtubePlayerInstance && youtubePlayerInstance.getVideoData() && youtubePlayerInstance.getVideoData().video_id) {
        const previousVideoId = youtubePlayerInstance.getVideoData().video_id;
        if (previousVideoId !== videoId) {
            if (historyLives.length >= HISTORY_MAX_SIZE) {
                historyLives.shift();
            }
            historyLives.push(previousVideoId);
        }
    }
    
    videoPlayerContainer.innerHTML = '';
    const playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-player';
    videoPlayerContainer.appendChild(playerDiv);

    return new Promise((resolve) => {
        if (typeof YT !== 'undefined' && YT.Player) {
            if (youtubePlayerInstance) {
                youtubePlayerInstance.destroy();
            }
            youtubePlayerInstance = new YT.Player('youtube-player', {
                videoId: videoId,
                playerVars: { autoplay: 1, controls: 1, modestbranding: 1, rel: 0 },
                events: {
                    'onReady': (event) => {
                        event.target.playVideo();
                        showPlayer();
                        updateNavigationButtons();
                        console.log(`Live ${videoId} carregada com sucesso.`);
                        resolve(true);
                    },
                    'onError': (event) => {
                        console.error("Erro no player do YouTube para vídeo", videoId, ":", event.data);
                        let errorMessage = "Ocorreu um erro ao carregar o vídeo.";
                        if (event.data === 100) errorMessage = "Este vídeo não existe.";
                        else if (event.data === 101 || event.data === 150) errorMessage = "Este vídeo não pode ser incorporado ou não está disponível nesta região.";
                        
                        videoPlayerContainer.innerHTML = `<p style="color: red; text-align: center;">${errorMessage}</p>`;
                        updateNavigationButtons();
                        resolve(false);
                    }
                }
            });
        } else {
            console.warn("YouTube IFrame API não carregada. Usando fallback de iframe simples.");
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0`;
            iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
            iframe.allowFullscreen = true;
            videoPlayerContainer.appendChild(iframe);
            showPlayer();
            updateNavigationButtons();
            resolve(true);
        }
    });
}


async function displayAndPlayFirstValidLive(lives) {
    if (quotaExceeded) {
        return;
    }

    if (lives.length === 0) {
        clearPlayer();
        videoPlayerContainer.innerHTML = "<p>Nenhuma live encontrada na busca aleatória com as categorias selecionadas. Tentando novamente...</p>";
        currentLives = [];
        currentLiveIndex = -1;
        historyLives = [];
        updateNavigationButtons();
        // Adiciona um pequeno atraso antes de tentar novamente para não martelar a API
        setTimeout(async () => {
            if (!quotaExceeded) {
                await loadRandomLive();
            }
        }, 3000); 
        return;
    }

    currentLives = lives;
    currentLiveIndex = -1; 
    
    let liveLoaded = false;
    for (let i = 0; i < currentLives.length; i++) {
        if (quotaExceeded) {
            console.warn("Cota excedida durante o carregamento de lives. Parando loop.");
            return;
        }
        currentLiveIndex = i;
        const videoId = currentLives[i].id.videoId;
        console.log(`Tentando carregar live inicial: ${videoId} (índice ${i})`);
        const success = await loadLive(videoId);
        if (success) {
            liveLoaded = true;
            break;
        } else {
            console.warn(`Falha ao carregar live ${videoId} (índice ${i}). Tentando próxima na lista...`);
        }
    }

    if (!liveLoaded) {
        clearPlayer();
        videoPlayerContainer.innerHTML = "<p>Nenhuma live válida encontrada entre os resultados da busca aleatória com as categorias selecionadas.</p>";
        currentLives = [];
        currentLiveIndex = -1;
        console.warn("Todas as lives na lista atual falharam. Buscando uma nova live aleatória.");
        setTimeout(async () => {
            if (!quotaExceeded) {
                await loadRandomLive();
            }
        }, 3000);
    }
    
    updateNavigationButtons();
}


async function goToPreviousLive() {
    if (quotaExceeded) {
        return;
    }
    if (historyLives.length > 0) {
        const videoIdToLoad = historyLives.pop();
        currentLiveIndex = -1;
        await loadLive(videoIdToLoad);
    }
    updateNavigationButtons();
}

async function goToNextLive() {
    if (quotaExceeded) {
        return;
    }
    let nextIndex = currentLiveIndex + 1;
    while (nextIndex < currentLives.length) {
        if (quotaExceeded) {
            console.warn("Cota excedida durante o avanço de lives. Parando loop.");
            return;
        }
        const videoId = currentLives[nextIndex].id.videoId;
        console.log(`Tentando carregar próxima live: ${videoId} (índice ${nextIndex})`);
        const success = await loadLive(videoId);
        if (success) {
            currentLiveIndex = nextIndex;
            updateNavigationButtons();
            return;
        } else {
            console.warn(`Falha ao carregar live ${videoId}. Tentando a próxima...`);
            nextIndex++;
        }
    }

    console.log("Fim das lives na lista atual ou todas falharam. Buscando nova live aleatória...");
    setTimeout(async () => {
        if (!quotaExceeded) {
            await loadRandomLive();
        }
    }, 3000);
    updateNavigationButtons();
}

async function loadRandomLive() {
    if (quotaExceeded) {
        console.warn("Cota excedida. Não iniciando nova busca aleatória.");
        return;
    }

    if (!updateSelectedCategories()) {
        return;
    }

    const countryCodes = Object.keys(COUNTRIES_FOR_RANDOM_SEARCH);
    const randomCountryCode = countryCodes[Math.floor(Math.random() * countryCodes.length)];

    const lives = await fetchLives(randomCountryCode, 50, selectedCategoryIds);

    if (quotaExceeded) {
        console.warn("Cota excedida após fetchLives. Abortando loadRandomLive.");
        return;
    }

    if (lives.length > 0) {
        const availableForRandom = lives.filter(live => !historyLives.includes(live.id.videoId));
        
        let liveToLoad = null;
        if (availableForRandom.length > 0) {
            const randomIndexInAvailable = Math.floor(Math.random() * availableForRandom.length);
            liveToLoad = availableForRandom[randomIndexInAvailable];
        } else {
            console.warn("Todas as lives encontradas para o país aleatório já estão no histórico recente. Escolhendo uma aleatória da lista original.");
            const randomIndex = Math.floor(Math.random() * lives.length);
            liveToLoad = lives[randomIndex];
        }

        currentLives = lives;
        currentLiveIndex = currentLives.findIndex(live => live.id.videoId === liveToLoad.id.videoId);
        
        const success = await loadLive(liveToLoad.id.videoId);
        if (quotaExceeded) {
             console.warn("Cota excedida após loadLive. Abortando loadRandomLive.");
             return;
        }

        if (!success) {
            console.warn(`A live aleatória inicial (${liveToLoad.id.videoId}) falhou. Tentando a próxima live na lista...`);
            currentLiveIndex++;
            await goToNextLive();
        }
    } else {
        console.warn(`Não foram encontradas lives para o país aleatório: ${COUNTRIES_FOR_RANDOM_SEARCH[randomCountryCode]} com as categorias selecionadas. Tentando novamente com outro país...`);
        setTimeout(async () => {
            if (!quotaExceeded) {
                await loadRandomLive();
            }
        }, 3000);
    }
    updateNavigationButtons();
}

// REMOVIDO: renderGridThumbnails (função não existe mais)

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    loadYouTubeAPI();
    populateCategoryCheckboxes(); // Popula os checkboxes na inicialização
    updateNavigationButtons();
    loadRandomLive(); // Carrega a primeira live automaticamente ao carregar a página
});

prevLiveBtn.addEventListener('click', goToPreviousLive);
nextLiveBtn.addEventListener('click', goToNextLive);

// Event listener para o botão de aplicar filtros
applyFiltersBtn.addEventListener('click', () => {
    quotaExceeded = false; // Reseta a flag de cota ao aplicar filtros
    clearPlayer(); // Limpa mensagens anteriores e o player
    loadRandomLive(); // Força uma nova busca com as categorias atualizadas
});