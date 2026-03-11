// Dados das paletas
const palettes = {
    paleta1: {
        primary: '#4CAF50',
        secondary: '#FF5722',
        background: '#FFFFFF',
        card: '#F4F4F4',
        buttonBg: '#FF9800',
        buttonText: '#FFFFFF',
        warning: '#FFEB3B',
        danger: '#F44336'
    },
    paleta2: {
        primary: '#2196F3',
        secondary: '#FFC107',
        background: '#FAFAFA',
        card: '#E3F2FD',
        buttonBg: '#673AB7',
        buttonText: '#FFFFFF',
        warning: '#FFEB3B',
        danger: '#F44336'
    },
    custom: {
        primary: '#000000',
        secondary: '#000000',
        background: '#000000',
        card: '#000000',
        buttonBg: '#000000',
        buttonText: '#000000',
        warning: '#000000',
        danger: '#000000'
    }
};

// Seleção de paleta
const paletteCards = document.querySelectorAll('.palette-card');

paletteCards.forEach(card => {
    card.addEventListener('click', () => {
        const paletteName = card.getAttribute('data-palette');
        const selectedPalette = palettes[paletteName];

        // Atualiza as variáveis de CSS com as cores selecionadas
        const root = document.documentElement;
        Object.keys(selectedPalette).forEach(key => {
            root.style.setProperty(`--${key}`, selectedPalette[key]);
        });

        // Atualiza os quadrados das cores da paleta customizada
        if (paletteName === 'custom') {
            const customColorBoxes = card.querySelectorAll('.color-box');
            customColorBoxes.forEach(box => {
                box.addEventListener('click', () => {
                    const newColor = prompt('Escolha uma nova cor em formato hexadecimal (#RRGGBB):', box.style.backgroundColor);
                    if (newColor && /^#[0-9A-F]{6}$/i.test(newColor)) {
                        box.style.backgroundColor = newColor;
                    }
                });
            });
       