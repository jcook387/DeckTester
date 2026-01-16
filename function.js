// MTG Deck Tester JavaScript Functions
        // Deck storage
        let deck = [];
        
        // Game state
        let library = [];
        let hand = [];
        let battlefield = [];
        let graveyard = [];
        let commandZone = [];
        let commanderTaxCount = 0;
        let manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
        let mulliganCount = 0;
        let lifeTotal = 40; // Commander starts at 40 life

        // Autocomplete state
        let autocompleteTimeout = null;
        let selectedCardData = null;

        // Drag and drop state
        let draggedCard = null;
        let draggedFromZone = null;

        // Context menu state
        let contextMenuCard = null;
        let contextMenuZone = null;

        // Mana selector state
        let manaSelectorCard = null;
        let manaSelectorCallback = null;

        // Counter manager state
        let counterManagerCard = null;
        let selectedCounterType = 'plus-one';
        let customCounterName = '';

        // Initialize autocomplete
        document.getElementById('cardName').addEventListener('input', handleCardSearch);
        document.getElementById('cardName').addEventListener('blur', () => {
            setTimeout(() => hideAutocomplete(), 200);
        });

        // Close context menu on click outside
        document.addEventListener('click', closeContextMenu);
        document.addEventListener('contextmenu', (e) => {
            // Only prevent default if not on a card
            if (!e.target.closest('.card')) {
                closeContextMenu();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyPress);

        function handleKeyPress(e) {
            // Don't trigger if typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(e.key.toLowerCase()) {
                case 'd':
                    drawCard();
                    break;
                case 'm':
                    mulligan();
                    break;
                case 'n':
                    startGame();
                    break;
                case 'r':
                    resetGame();
                    break;
                case 't':
                    // Tap/untap all selected or hovered cards
                    tapLastPlayedCard();
                    break;
                case 'u':
                    // Untap all cards
                    untapAll();
                    break;
                case 'f':
                    // Flip last played card
                    flipLastPlayedCard();
                    break;
                case 'b':
                    toggleDeckBuilder();
                    break;
                case 's':
                    runSimulation();
                    break;
                case 'x':
                    // Mill cards
                    showMillPrompt();
                    break;
                case 'l':
                    // Search library
                    openLibrarySearch();
                    break;
                case 'c':
                    // Cast commander or set commander
                    if (commandZone.length > 0) {
                        castCommander(commandZone[0]);
                    } else {
                        setCommanderFromHand();
                    }
                    break;
                case ' ':
                    // Space bar - Next turn
                    e.preventDefault(); // Prevent page scroll
                    nextTurn();
                    break;
                case 'escape':
                    closeContextMenu();
                    closeCardPreview();
                    closeLibrarySearch();
                    const deckBuilder = document.getElementById('deckBuilder');
                    deckBuilder.classList.remove('open');
                    break;
            }
        }

        // Flip the most recently played card
        function flipLastPlayedCard() {
            if (battlefield.length > 0) {
                const lastCard = battlefield[battlefield.length - 1];
                if (lastCard.hasMultipleFaces) {
                    lastCard.isFlipped = !lastCard.isFlipped;
                    
                    // Update card properties
                    if (lastCard.isFlipped && lastCard.backFace) {
                        lastCard.imageUrl = lastCard.backFace.imageUrl;
                        lastCard.name = lastCard.backFace.name;
                        lastCard.type = getCardType(lastCard.backFace.typeLine);
                        lastCard.manaCost = lastCard.backFace.manaCost;
                    } else if (lastCard.frontFace) {
                        lastCard.imageUrl = lastCard.frontFace.imageUrl;
                        lastCard.name = lastCard.frontFace.name;
                        lastCard.type = getCardType(lastCard.frontFace.typeLine);
                        lastCard.manaCost = lastCard.frontFace.manaCost;
                    }
                    
                    updateZones();
                    const faceName = lastCard.isFlipped ? 'back' : 'front';
                    showNotification(`🔄 Flipped to ${faceName} face`);
                } else {
                    showNotification('⚠️ Card cannot be flipped');
                }
            }
        }

        // Tap the most recently played card
        function tapLastPlayedCard() {
            if (battlefield.length > 0) {
                const lastCard = battlefield[battlefield.length - 1];
                lastCard.tapped = !lastCard.tapped;
                updateZones();
            }
        }

        // Untap all cards on battlefield
        function untapAll() {
            battlefield.forEach(card => {
                card.tapped = false;
            });
            updateZones();
        }

        // Next turn - untap all and draw
        function nextTurn() {
            // Untap all permanents
            battlefield.forEach(card => {
                card.tapped = false;
            });
            
            // Clear mana pool
            manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
            
            // Draw a card
            if (library.length > 0) {
                drawCard();
            }
            
            // Visual feedback
            showNotification('⏭️ Next Turn - Untapped All, Cleared Mana & Drew Card');
            updateZones();
            updateManaDisplay();
        }

        // Show temporary notification
        function showNotification(message) {
            const existing = document.getElementById('turnNotification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.id = 'turnNotification';
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(42, 82, 152, 0.95);
                color: white;
                padding: 20px 40px;
                border-radius: 12px;
                font-size: 18px;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                animation: fadeInOut 1.5s ease;
            `;

            document.body.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, 1500);
        }

        // Mill cards from library to graveyard
        function showMillPrompt() {
            const count = prompt('How many cards to mill from the top of library?', '1');
            if (count !== null) {
                const numCards = parseInt(count);
                if (numCards > 0 && numCards <= library.length) {
                    millCards(numCards);
                } else if (numCards > library.length) {
                    alert(`Only ${library.length} cards remaining in library!`);
                } else {
                    alert('Please enter a valid number.');
                }
            }
        }

        function millCards(count) {
            const milled = [];
            for (let i = 0; i < count && library.length > 0; i++) {
                const card = library.pop();
                graveyard.push(card);
                milled.push(card.name);
            }
            
            updateZones();
            showNotification(`⚰️ Milled ${count} card(s): ${milled.join(', ')}`);
        }

        // Show card preview
        function showCardPreview(card) {
            const modal = document.getElementById('cardPreviewModal');
            const container = document.getElementById('cardPreviewImageContainer');
            
            container.innerHTML = '';
            
            if (card.hasMultipleFaces && card.frontFace && card.backFace) {
                // Show both faces for double-faced cards
                const frontImg = document.createElement('img');
                frontImg.src = card.frontFace.imageUrl || '';
                frontImg.className = 'card-preview-image';
                frontImg.alt = card.frontFace.name;
                frontImg.style.marginRight = '20px';
                
                const backImg = document.createElement('img');
                backImg.src = card.backFace.imageUrl || '';
                backImg.className = 'card-preview-image';
                backImg.alt = card.backFace.name;
                
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.gap = '20px';
                wrapper.style.alignItems = 'center';
                wrapper.style.justifyContent = 'center';
                
                if (card.frontFace.imageUrl) wrapper.appendChild(frontImg);
                if (card.backFace.imageUrl) wrapper.appendChild(backImg);
                
                if (wrapper.children.length > 0) {
                    container.appendChild(wrapper);
                } else {
                    // Fallback if no images
                    const placeholder = document.createElement('div');
                    placeholder.className = 'card-preview-placeholder';
                    placeholder.innerHTML = `
                        <div style="margin-bottom: 20px;">
                            <strong>Front:</strong> ${card.frontFace.name}<br>
                            ${card.frontFace.typeLine}<br>
                            ${card.frontFace.manaCost || 'No mana cost'}
                        </div>
                        <div style="border-top: 2px solid white; padding-top: 20px;">
                            <strong>Back:</strong> ${card.backFace.name}<br>
                            ${card.backFace.typeLine}<br>
                            ${card.backFace.manaCost || 'No mana cost'}
                        </div>
                    `;
                    container.appendChild(placeholder);
                }
            } else if (card.imageUrl) {
                // Single-faced card with image
                const img = document.createElement('img');
                img.src = card.imageUrl;
                img.className = 'card-preview-image';
                img.alt = card.name;
                container.appendChild(img);
            } else {
                // Single-faced card without image
                const placeholder = document.createElement('div');
                placeholder.className = 'card-preview-placeholder';
                placeholder.innerHTML = `
                    <div>${card.name}</div>
                    <div style="font-size: 16px; margin-top: 20px; opacity: 0.8;">${card.type}</div>
                    <div style="font-size: 14px; margin-top: 10px; opacity: 0.7;">${card.manaCost || 'No mana cost'}</div>
                `;
                container.appendChild(placeholder);
            }
            
            modal.classList.add('active');
        }

        // Close card preview
        function closeCardPreview() {
            const modal = document.getElementById('cardPreviewModal');
            modal.classList.remove('active');
        }

        // Open library search
        function openLibrarySearch() {
            if (library.length === 0) {
                alert('Library is empty!');
                return;
            }

            const modal = document.getElementById('librarySearchModal');
            const input = document.getElementById('librarySearchInput');
            
            input.value = '';
            modal.classList.add('active');
            
            displayLibraryCards(library);
            
            // Focus on search input
            setTimeout(() => input.focus(), 100);
        }

        // Close library search
        function closeLibrarySearch() {
            const modal = document.getElementById('librarySearchModal');
            modal.classList.remove('active');
        }

        // Display library cards
        function displayLibraryCards(cards) {
            const grid = document.getElementById('libraryCardsGrid');
            grid.innerHTML = '';

            if (cards.length === 0) {
                grid.innerHTML = '<div class="no-results">No cards found</div>';
                return;
            }

            cards.forEach(card => {
                const cardItem = document.createElement('div');
                cardItem.className = 'library-card-item';
                
                const imageHtml = card.imageUrl
                    ? `<img src="${card.imageUrl}" alt="${card.name}">`
                    : `<div class="library-card-item-placeholder">${card.name}</div>`;
                
                cardItem.innerHTML = `
                    ${imageHtml}
                    <div class="library-card-name">${card.name}</div>
                    <div class="library-card-type">${card.type}</div>
                `;
                
                cardItem.onclick = () => selectLibraryCard(card);
                grid.appendChild(cardItem);
            });
        }

        // Filter library cards based on search
        function filterLibraryCards() {
            const query = document.getElementById('librarySearchInput').value.toLowerCase();
            
            if (query === '') {
                displayLibraryCards(library);
                return;
            }

            const filtered = library.filter(card => 
                card.name.toLowerCase().includes(query) ||
                card.type.toLowerCase().includes(query)
            );

            displayLibraryCards(filtered);
        }

        // Select a card from library
        function selectLibraryCard(card) {
            const action = confirm(`Found "${card.name}"\n\nClick OK to move to hand, or Cancel to just close search.`);
            
            if (action) {
                const index = library.findIndex(c => c.id === card.id);
                if (index !== -1) {
                    library.splice(index, 1);
                    hand.push(card);
                    updateZones();
                    showNotification(`📤 Added ${card.name} to hand`);
                }
            }
            
            closeLibrarySearch();
        }

        // Add ESC key to close preview and library search
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeCardPreview();
                closeLibrarySearch();
                closeManaSelector();
                closeCounterManager();
            }
        });

        // Add CSS for notification animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);

        // Toggle keyboard help
        function toggleKeyboardHelp() {
            const helpPanel = document.getElementById('keyboardHelp');
            helpPanel.classList.toggle('visible');
        }

        // Toggle deck builder panel
        function toggleDeckBuilder() {
            const deckBuilder = document.getElementById('deckBuilder');
            deckBuilder.classList.toggle('open');
        }

        // Search Scryfall API
        async function handleCardSearch(e) {
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                hideAutocomplete();
                return;
            }

            clearTimeout(autocompleteTimeout);
            autocompleteTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`);
                    const data = await response.json();
                    
                    if (data.data && data.data.length > 0) {
                        await showAutocomplete(data.data.slice(0, 8));
                    } else {
                        hideAutocomplete();
                    }
                } catch (error) {
                    console.error('Error fetching cards:', error);
                    hideAutocomplete();
                }
            }, 300);
        }

        // Show autocomplete dropdown
        async function showAutocomplete(cardNames) {
            const dropdown = document.getElementById('autocompleteDropdown');
            dropdown.innerHTML = '';
            
            for (const cardName of cardNames) {
                try {
                    const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
                    const cardData = await response.json();
                    
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    
                    const imageUrl = cardData.image_uris?.small || cardData.card_faces?.[0]?.image_uris?.small || '';
                    
                    item.innerHTML = `
                        ${imageUrl ? `<img src="${imageUrl}" alt="${cardData.name}">` : '<div style="width:40px;height:56px;background:#ddd;border-radius:4px;"></div>'}
                        <div class="autocomplete-item-info">
                            <div class="autocomplete-item-name">${cardData.name}</div>
                            <div class="autocomplete-item-type">${cardData.type_line}</div>
                        </div>
                    `;
                    
                    item.addEventListener('click', () => selectCard(cardData));
                    dropdown.appendChild(item);
                } catch (error) {
                    console.error('Error fetching card details:', error);
                }
            }
            
            dropdown.style.display = 'block';
        }

        // Hide autocomplete
        function hideAutocomplete() {
            document.getElementById('autocompleteDropdown').style.display = 'none';
        }

        // Select card from autocomplete
        function selectCard(cardData) {
            selectedCardData = cardData;
            document.getElementById('cardName').value = cardData.name;
            
            // Auto-fill type and mana cost
            document.getElementById('cardType').value = getCardType(cardData.type_line);
            document.getElementById('manaCost').value = cardData.mana_cost || '';
            
            hideAutocomplete();
        }

        // Get simplified card type
        function getCardType(typeLine) {
            if (typeLine.includes('Creature')) return 'Creature';
            if (typeLine.includes('Instant')) return 'Instant';
            if (typeLine.includes('Sorcery')) return 'Sorcery';
            if (typeLine.includes('Enchantment')) return 'Enchantment';
            if (typeLine.includes('Artifact')) return 'Artifact';
            if (typeLine.includes('Planeswalker')) return 'Planeswalker';
            if (typeLine.includes('Land')) return 'Land';
            return 'Creature';
        }

        // Add card to deck
        async function addCard() {
            const name = document.getElementById('cardName').value.trim();
            const type = document.getElementById('cardType').value;
            const manaCost = document.getElementById('manaCost').value.trim();
            const quantity = parseInt(document.getElementById('quantity').value);

            if (!name) {
                alert('Please enter a card name');
                return;
            }

            // If we don't have card data, fetch it
            if (!selectedCardData || selectedCardData.name !== name) {
                try {
                    const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                    selectedCardData = await response.json();
                } catch (error) {
                    console.error('Error fetching card:', error);
                }
            }

            const imageUrl = selectedCardData?.image_uris?.normal || 
                           selectedCardData?.card_faces?.[0]?.image_uris?.normal || 
                           null;

            for (let i = 0; i < quantity; i++) {
                deck.push({ 
                    name, 
                    type, 
                    manaCost, 
                    id: Date.now() + i,
                    imageUrl: imageUrl,
                    scryfallData: selectedCardData
                });
            }

            document.getElementById('cardName').value = '';
            document.getElementById('manaCost').value = '';
            document.getElementById('quantity').value = '1';
            selectedCardData = null;

            updateDeckDisplay();
        }

        // Update deck display
        function updateDeckDisplay() {
            const decklistEl = document.getElementById('decklist');
            const deckMap = new Map();

            // Count cards and keep one reference with image
            deck.forEach(card => {
                const key = `${card.name}|${card.type}|${card.manaCost}`;
                const existing = deckMap.get(key);
                if (existing) {
                    existing.count++;
                } else {
                    deckMap.set(key, { ...card, count: 1 });
                }
            });

            // Display cards
            decklistEl.innerHTML = '';
            deckMap.forEach((cardData, key) => {
                const item = document.createElement('div');
                item.className = 'decklist-item';
                
                const imageHtml = cardData.imageUrl 
                    ? `<img src="${cardData.imageUrl}" class="decklist-thumbnail" alt="${cardData.name}">`
                    : '<div class="decklist-placeholder"></div>';
                
                item.innerHTML = `
                    ${imageHtml}
                    <div class="card-info">
                        <div>
                            <span class="card-name">${cardData.count}x ${cardData.name}</span>
                            <span class="card-mana">${cardData.manaCost || 'N/A'}</span>
                        </div>
                        <div class="card-type">${cardData.type}</div>
                    </div>
                    <button class="btn-danger remove-btn" onclick="removeCard('${cardData.name}', '${cardData.type}', '${cardData.manaCost}')">Remove</button>
                `;
                decklistEl.appendChild(item);
            });

            updateDeckStats();
        }

        // Remove card from deck
        function removeCard(name, type, manaCost) {
            const index = deck.findIndex(c => c.name === name && c.type === type && c.manaCost === manaCost);
            if (index !== -1) {
                deck.splice(index, 1);
                updateDeckDisplay();
            }
        }

        // Update deck statistics
        function updateDeckStats() {
            const total = deck.length;
            const creatures = deck.filter(c => c.type === 'Creature').length;
            const lands = deck.filter(c => c.type === 'Land').length;
            const spells = total - creatures - lands;

            // Calculate average CMC
            const nonLands = deck.filter(c => c.type !== 'Land');
            const totalCMC = nonLands.reduce((sum, card) => {
                const cmc = calculateCMC(card.manaCost);
                return sum + cmc;
            }, 0);
            const avgCMC = nonLands.length > 0 ? (totalCMC / nonLands.length).toFixed(1) : 0;

            document.getElementById('totalCards').textContent = total;
            document.getElementById('creatureCount').textContent = creatures;
            document.getElementById('spellCount').textContent = spells;
            document.getElementById('landCount').textContent = lands;
            document.getElementById('avgCMC').textContent = avgCMC;
        }

        // Calculate converted mana cost
        function calculateCMC(manaCost) {
            if (!manaCost) return 0;
            let total = 0;
            const matches = manaCost.match(/\d+|[WUBRGC]/g) || [];
            matches.forEach(symbol => {
                if (/\d+/.test(symbol)) {
                    total += parseInt(symbol);
                } else {
                    total += 1;
                }
            });
            return total;
        }

        // Start new game
        function startGame() {
            if (deck.length === 0) {
                alert('Please add cards to your deck first!');
                return;
            }

            resetGame();
            
            // Draw opening hand
            for (let i = 0; i < 7; i++) {
                drawCard();
            }

            document.getElementById('mulliganTracker').style.display = 'block';
        }

        // Mulligan
        function mulligan() {
            if (hand.length === 0) return;

            mulliganCount++;
            const newHandSize = Math.max(7 - mulliganCount, 0);

            // Put hand back into library
            library.push(...hand);
            hand = [];
            shuffleLibrary();

            // Draw new hand
            for (let i = 0; i < newHandSize; i++) {
                drawCard();
            }

            document.getElementById('mulliganCount').textContent = mulliganCount;
            document.getElementById('handSize').textContent = newHandSize;
            updateZones();
        }

        // Draw card
        function drawCard() {
            if (library.length === 0) {
                alert('Library is empty!');
                return;
            }

            const card = library.pop();
            hand.push(card);
            updateZones();
        }

        // Reset game
        function resetGame() {
            library = [...deck].map((card, i) => ({ ...card, id: Date.now() + i }));
            hand = [];
            battlefield = [];
            graveyard = [];
            manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
            mulliganCount = 0;
            lifeTotal = 40;

            // Keep commander in command zone but reset tax
            commanderTaxCount = 0;

            shuffleLibrary();
            updateZones();
            updateCommandZone();
            updateManaDisplay();
            updateLifeDisplay();

            document.getElementById('mulliganCount').textContent = '0';
            document.getElementById('sampleHands').style.display = 'none';
        }

        // Shuffle library
        function shuffleLibrary() {
            for (let i = library.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [library[i], library[j]] = [library[j], library[i]];
            }
        }

        // Update game zones
        function updateZones() {
            updateZone('hand', hand);
            updateZone('battlefield', battlefield);
            updateMiniGraveyard();

            document.getElementById('handCount').textContent = hand.length;
            document.getElementById('graveyardCount').textContent = graveyard.length;
            document.getElementById('libraryCount').textContent = library.length;

            // Update mulligan tracker if visible
            const handSizeEl = document.getElementById('handSize');
            const librarySizeEl = document.getElementById('librarySize');
            const graveyardSizeEl = document.getElementById('graveyardSize');
            
            if (handSizeEl) handSizeEl.textContent = hand.length;
            if (librarySizeEl) librarySizeEl.textContent = library.length;
            if (graveyardSizeEl) graveyardSizeEl.textContent = graveyard.length;
        }

        // Update mini graveyard display
        function updateMiniGraveyard() {
            const miniGY = document.getElementById('graveyardMini');
            miniGY.innerHTML = '';

            // Show all cards, most recent first
            const recentCards = [...graveyard].reverse();
            
            recentCards.forEach(card => {
                const miniCard = document.createElement('div');
                miniCard.className = 'mini-card';
                miniCard.textContent = card.name;
                
                // Click to view
                miniCard.onclick = (e) => {
                    e.stopPropagation();
                    showCardPreview(card);
                };
                
                // Right-click to return to hand
                miniCard.oncontextmenu = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const index = graveyard.findIndex(c => c.id === card.id);
                    if (index !== -1) {
                        graveyard.splice(index, 1);
                        hand.push(card);
                        updateZones();
                        showNotification(`📤 Returned ${card.name} to hand`);
                    }
                };
                
                miniGY.appendChild(miniCard);
            });

            // Add drop target for graveyard mini zone parent
            const graveyardZone = miniGY.parentElement;
            
            graveyardZone.ondragover = (e) => {
                e.preventDefault();
                graveyardZone.style.background = 'rgba(42, 82, 152, 0.3)';
            };

            graveyardZone.ondragleave = (e) => {
                if (!graveyardZone.contains(e.relatedTarget)) {
                    graveyardZone.style.background = 'rgba(0,0,0,0.7)';
                }
            };

            graveyardZone.ondrop = (e) => {
                e.preventDefault();
                graveyardZone.style.background = 'rgba(0,0,0,0.7)';
                
                if (draggedCard && draggedFromZone) {
                    const fromArray = getZoneArray(draggedFromZone);
                    const index = fromArray.findIndex(c => c.id === draggedCard.id);
                    
                    if (index !== -1) {
                        const [card] = fromArray.splice(index, 1);
                        card.tapped = false;
                        graveyard.push(card);
                        updateZones();
                    }
                    
                    draggedCard = null;
                    draggedFromZone = null;
                }
            };
        }

        // Update specific zone
        function updateZone(zoneName, cards) {
            if (zoneName === 'battlefield') {
                updateBattlefield(cards);
                return;
            }

            const zoneEl = document.getElementById(zoneName);
            zoneEl.innerHTML = '';

            // Make zone a drop target
            zoneEl.ondragover = (e) => {
                e.preventDefault();
                zoneEl.parentElement.classList.add('drag-over');
            };

            zoneEl.ondragleave = (e) => {
                if (e.target === zoneEl) {
                    zoneEl.parentElement.classList.remove('drag-over');
                }
            };

            zoneEl.ondrop = (e) => {
                e.preventDefault();
                zoneEl.parentElement.classList.remove('drag-over');
                handleCardDrop(zoneName);
            };

            cards.forEach(card => {
                const cardEl = createCardElement(card, zoneName);
                zoneEl.appendChild(cardEl);
            });
        }

        // Update battlefield with free positioning
        function updateBattlefield(cards) {
            const mainZone = document.getElementById('battlefieldMain');
            const landZone = document.getElementById('battlefieldLands');
            
            // Clear existing cards
            mainZone.querySelectorAll('.card').forEach(el => el.remove());
            landZone.querySelectorAll('.card').forEach(el => el.remove());

            // Setup drop zones
            setupDropZone(mainZone);
            setupDropZone(landZone);

            // Render cards in appropriate zones
            cards.forEach(card => {
                const isLand = card.type === 'Land';
                const targetZone = isLand ? landZone : mainZone;
                
                // Auto-position if no position set or position is invalid
                if (!card.position || !card.position.zone) {
                    card.position = getAutoPosition(targetZone, isLand, cards);
                    card.position.zone = isLand ? 'lands' : 'main';
                }

                // If card type changed or moved zones, reposition
                if ((isLand && card.position.zone !== 'lands') || (!isLand && card.position.zone !== 'main')) {
                    card.position = getAutoPosition(targetZone, isLand, cards);
                    card.position.zone = isLand ? 'lands' : 'main';
                }

                const actualZone = card.position.zone === 'lands' ? landZone : mainZone;
                const cardEl = createCardElement(card, 'battlefield');
                cardEl.style.left = card.position.x + 'px';
                cardEl.style.top = card.position.y + 'px';
                
                actualZone.appendChild(cardEl);
            });
        }

        // Setup drop zone
        function setupDropZone(zone) {
            zone.ondragover = (e) => {
                e.preventDefault();
                zone.style.background = 'rgba(42, 82, 152, 0.2)';
            };

            zone.ondragleave = (e) => {
                // Only remove highlight if we're actually leaving the zone
                if (!zone.contains(e.relatedTarget)) {
                    zone.style.background = '';
                }
            };

            zone.ondrop = (e) => {
                e.preventDefault();
                zone.style.background = '';
                
                if (draggedCard && draggedFromZone) {
                    const rect = zone.getBoundingClientRect();
                    const scrollLeft = zone.scrollLeft || 0;
                    const scrollTop = zone.scrollTop || 0;
                    
                    // Calculate position relative to zone, accounting for scroll
                    let x = e.clientX - rect.left + scrollLeft - 80; // Center card on cursor
                    let y = e.clientY - rect.top + scrollTop - 140;

                    // Constrain to zone boundaries
                    const maxX = zone.offsetWidth - 180;
                    const maxY = zone.offsetHeight - 300;
                    x = Math.max(10, Math.min(x, maxX));
                    y = Math.max(10, Math.min(y, maxY));

                    const isLandZone = zone.id === 'battlefieldLands';
                    const fromArray = getZoneArray(draggedFromZone);
                    
                    if (draggedFromZone === 'battlefield') {
                        // Moving within battlefield
                        draggedCard.position = { 
                            x, 
                            y, 
                            zone: isLandZone ? 'lands' : 'main' 
                        };
                    } else {
                        // Moving from another zone
                        const index = fromArray.findIndex(c => c.id === draggedCard.id);
                        if (index !== -1) {
                            const [card] = fromArray.splice(index, 1);
                            card.position = { 
                                x, 
                                y, 
                                zone: isLandZone ? 'lands' : 'main' 
                            };
                            battlefield.push(card);
                            
                            if (card.type === 'Land') {
                                addManaFromLand(card);
                            }
                        }
                    }

                    updateZones();
                    updateManaDisplay();
                    draggedCard = null;
                    draggedFromZone = null;
                }
            };
        }

        // Get auto position for new cards
        function getAutoPosition(zone, isLand, allCards) {
            // Count cards already in this zone
            const zoneType = isLand ? 'lands' : 'main';
            const cardsInZone = allCards.filter(c => c.position && c.position.zone === zoneType).length;
            
            const zoneWidth = zone.offsetWidth || 800;
            const columns = Math.floor((zoneWidth - 40) / 175);
            const index = cardsInZone;
            
            const col = index % columns;
            const row = Math.floor(index / columns);
            
            return {
                x: col * 175 + 10,
                y: row * 150 + 10,
                zone: zoneType
            };
        }

        // Create card element
        function createCardElement(card, zoneName) {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            if (card.tapped) cardEl.classList.add('tapped');
            if (card.hasMultipleFaces) cardEl.classList.add('has-flip');
            if (card.isFlipped) cardEl.classList.add('flipped');
            if (card.entersTapped && zoneName === 'hand') cardEl.classList.add('enters-tapped');
            cardEl.draggable = true;
            
            // Determine which face to show
            let currentImageUrl = card.imageUrl;
            let currentName = card.name;
            let currentType = card.type;
            let currentMana = card.manaCost;
            
            if (card.isFlipped && card.backFace) {
                currentImageUrl = card.backFace.imageUrl;
                currentName = card.backFace.name;
                currentType = getCardType(card.backFace.typeLine);
                currentMana = card.backFace.manaCost;
            } else if (card.frontFace) {
                currentImageUrl = card.frontFace.imageUrl;
                currentName = card.frontFace.name;
                currentType = getCardType(card.frontFace.typeLine);
                currentMana = card.frontFace.manaCost;
            }
            
            const imageHtml = currentImageUrl
                ? `<div class="card-image-container"><img src="${currentImageUrl}" class="card-image" alt="${currentName}"></div>`
                : `<div class="card-image-container"><div class="card-image-placeholder">${currentName}</div></div>`;
            
            const flipIndicator = card.hasMultipleFaces 
                ? `<div class="card-flip-indicator" onclick="event.stopPropagation(); flipCard(event, '${card.id}', '${zoneName}')">🔄 FLIP</div>`
                : '';
            
            const etbIndicator = card.entersTapped && zoneName === 'hand'
                ? `<div class="card-etb-indicator">ETB TAPPED</div>`
                : '';
            
            // Build counter badges
            let counterBadges = '';
            if (card.counters && Object.keys(card.counters).length > 0) {
                counterBadges = '<div class="card-counters">';
                for (const [type, count] of Object.entries(card.counters)) {
                    if (count > 0) {
                        const displayName = type === 'plus-one' ? '+1/+1' :
                                          type === 'minus-one' ? '-1/-1' :
                                          type === 'loyalty' ? 'Loyalty' :
                                          type === 'charge' ? 'Charge' :
                                          type.charAt(0).toUpperCase() + type.slice(1);
                        counterBadges += `<div class="counter-badge ${type}">${count} ${displayName}</div>`;
                    }
                }
                counterBadges += '</div>';
            }
            
            cardEl.innerHTML = `
                <div class="card-tap-indicator">TAPPED</div>
                ${etbIndicator}
                ${flipIndicator}
                ${counterBadges}
                ${imageHtml}
                <div class="card-info-compact">
                    <div class="card-display-name">${currentName}</div>
                    <div class="card-display-type">${currentType}</div>
                    <div class="card-display-mana">${currentMana || '-'}</div>
                </div>
            `;

            // Click to preview (single click)
            cardEl.onclick = (e) => {
                // Only show preview if not dragging and not double-clicking
                if (!cardEl.classList.contains('dragging')) {
                    clearTimeout(cardEl.clickTimer);
                    cardEl.clickTimer = setTimeout(() => {
                        showCardPreview(card);
                    }, 250); // Delay to distinguish from double-click
                }
            };

            // Drag events
            cardEl.ondragstart = (e) => {
                clearTimeout(cardEl.clickTimer); // Cancel click timer if dragging
                draggedCard = card;
                draggedFromZone = zoneName;
                cardEl.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            };

            cardEl.ondragend = (e) => {
                cardEl.classList.remove('dragging');
                document.querySelectorAll('.drag-over').forEach(el => {
                    el.classList.remove('drag-over');
                });
            };

            // Right-click for tap/untap (battlefield only)
            cardEl.oncontextmenu = (e) => {
                e.preventDefault();
                clearTimeout(cardEl.clickTimer); // Cancel click timer
                if (zoneName === 'battlefield') {
                    showContextMenu(e, card, zoneName);
                }
            };

            // Double-click behavior
            cardEl.ondblclick = (e) => {
                clearTimeout(cardEl.clickTimer); // Cancel click timer
                
                if (zoneName === 'hand') {
                    handleCardClick(zoneName, card);
                } else if (zoneName === 'battlefield') {
                    // Shift + double-click = tap for mana (choose color)
                    if (e.shiftKey && (card.type === 'Creature' || card.type === 'Artifact')) {
                        tapForMana(card, e);
                    } 
                    // Regular double-click on land = tap for mana (auto-detect)
                    else if (card.type === 'Land' && !card.tapped) {
                        tapLandForMana(card, e);
                    }
                    // Regular double-click on non-land = toggle tap
                    else {
                        card.tapped = !card.tapped;
                        updateZones();
                    }
                }
            };

            return cardEl;
        }

        // Tap a land for mana (auto-detect color)
        function tapLandForMana(card, event) {
            if (card.tapped) {
                showNotification('⚠️ Land is already tapped');
                return;
            }

            const name = card.name.toLowerCase();
            let color = null;
            
            // Auto-detect basic lands
            if (name.includes('plains')) color = 'W';
            else if (name.includes('island')) color = 'U';
            else if (name.includes('swamp')) color = 'B';
            else if (name.includes('mountain')) color = 'R';
            else if (name.includes('forest')) color = 'G';
            
            if (color) {
                // Basic land - tap immediately
                card.tapped = true;
                manaPool[color]++;
                updateZones();
                updateManaDisplay();
                showNotification(`💎 Tapped ${card.name} for {${color}}`);
            } else {
                // Non-basic land - show selector
                showManaSelector(event || { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }, card, (selectedColor) => {
                    card.tapped = true;
                    manaPool[selectedColor]++;
                    updateZones();
                    updateManaDisplay();
                    showNotification(`💎 Tapped ${card.name} for {${selectedColor}}`);
                });
            }
        }

        // Tap a permanent for mana
        function tapForMana(card, event) {
            if (card.tapped) {
                showNotification('⚠️ Card is already tapped');
                return;
            }

            // Show mana selector near the card
            showManaSelector(event || { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 }, card, (color) => {
                card.tapped = true;
                manaPool[color]++;
                updateZones();
                updateManaDisplay();
                showNotification(`💎 Tapped ${card.name} for {${color}}`);
            });
        }

        // Show mana selector popup
        function showManaSelector(event, card, callback) {
            const selector = document.getElementById('manaSelector');
            const title = document.getElementById('manaSelectorTitle');
            
            manaSelectorCard = card;
            manaSelectorCallback = callback;
            
            title.textContent = `Tap ${card.name} for...`;
            
            // Position near the click/card
            let x = event.clientX || event.pageX || window.innerWidth / 2;
            let y = event.clientY || event.pageY || window.innerHeight / 2;
            
            // Adjust to keep on screen
            const selectorWidth = 280;
            const selectorHeight = 250;
            
            if (x + selectorWidth > window.innerWidth) {
                x = window.innerWidth - selectorWidth - 20;
            }
            if (y + selectorHeight > window.innerHeight) {
                y = window.innerHeight - selectorHeight - 20;
            }
            
            selector.style.left = x + 'px';
            selector.style.top = y + 'px';
            selector.classList.add('active');
        }

        // Select mana color from selector
        function selectManaColor(color) {
            if (manaSelectorCallback) {
                manaSelectorCallback(color);
            }
            closeManaSelector();
        }

        // Close mana selector
        function closeManaSelector() {
            const selector = document.getElementById('manaSelector');
            selector.classList.remove('active');
            manaSelectorCard = null;
            manaSelectorCallback = null;
        }

        // Open counter manager
        function openCounterManager(card, event) {
            const manager = document.getElementById('counterManager');
            const title = document.getElementById('counterManagerTitle');
            const customInput = document.getElementById('customCounterInput');
            
            counterManagerCard = card;
            if (!card.counters) card.counters = {};
            
            title.textContent = `Counters - ${card.name}`;
            customInput.style.display = 'none';
            
            // Select default counter type
            selectedCounterType = 'plus-one';
            updateCounterTypeButtons();
            updateCounterDisplay();
            
            // Position near the card
            let x = event.clientX || event.pageX || window.innerWidth / 2;
            let y = event.clientY || event.pageY || window.innerHeight / 2;
            
            const managerWidth = 350;
            const managerHeight = 300;
            
            if (x + managerWidth > window.innerWidth) {
                x = window.innerWidth - managerWidth - 20;
            }
            if (y + managerHeight > window.innerHeight) {
                y = window.innerHeight - managerHeight - 20;
            }
            
            manager.style.left = x + 'px';
            manager.style.top = y + 'px';
            manager.classList.add('active');
        }

        // Open counter manager from context menu
        function openCounterManagerFromMenu() {
            if (contextMenuCard) {
                const menu = document.getElementById('cardContextMenu');
                const event = menu ? { clientX: parseInt(menu.style.left), clientY: parseInt(menu.style.top) } : { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
                openCounterManager(contextMenuCard, event);
            }
            closeContextMenu();
        }

        // Select counter type
        function selectCounterType(type) {
            selectedCounterType = type;
            const customInput = document.getElementById('customCounterInput');
            
            if (type === 'custom') {
                customInput.style.display = 'block';
                document.getElementById('customCounterName').focus();
            } else {
                customInput.style.display = 'none';
            }
            
            updateCounterTypeButtons();
            updateCounterDisplay();
        }

        // Update counter type button highlights
        function updateCounterTypeButtons() {
            const buttons = document.querySelectorAll('.counter-type-btn');
            buttons.forEach(btn => {
                btn.classList.remove('selected');
            });
            
            const types = ['plus-one', 'minus-one', 'loyalty', 'charge', 'custom'];
            const index = types.indexOf(selectedCounterType);
            if (index >= 0 && buttons[index]) {
                buttons[index].classList.add('selected');
            }
        }

        // Modify counter value
        function modifyCounter(delta) {
            if (!counterManagerCard) return;
            
            let counterKey = selectedCounterType;
            
            // Handle custom counters
            if (selectedCounterType === 'custom') {
                const customName = document.getElementById('customCounterName').value.trim();
                if (!customName) {
                    showNotification('⚠️ Please enter a counter name');
                    return;
                }
                counterKey = customName.toLowerCase().replace(/\s+/g, '-');
                customCounterName = customName;
            }
            
            if (!counterManagerCard.counters) {
                counterManagerCard.counters = {};
            }
            
            const current = counterManagerCard.counters[counterKey] || 0;
            const newValue = Math.max(0, current + delta);
            
            if (newValue === 0) {
                delete counterManagerCard.counters[counterKey];
            } else {
                counterManagerCard.counters[counterKey] = newValue;
            }
            
            updateCounterDisplay();
            updateZones();
        }

        // Update counter display in manager
        function updateCounterDisplay() {
            if (!counterManagerCard) return;
            
            let counterKey = selectedCounterType;
            if (selectedCounterType === 'custom') {
                const customName = document.getElementById('customCounterName').value.trim();
                if (customName) {
                    counterKey = customName.toLowerCase().replace(/\s+/g, '-');
                }
            }
            
            const value = counterManagerCard.counters?.[counterKey] || 0;
            document.getElementById('currentCounterValue').textContent = value;
        }

        // Close counter manager
        function closeCounterManager() {
            const manager = document.getElementById('counterManager');
            manager.classList.remove('active');
            counterManagerCard = null;
            selectedCounterType = 'plus-one';
            customCounterName = '';
            document.getElementById('customCounterName').value = '';
        }

        // Flip a card between front and back face
        function flipCard(event, cardId, zoneName) {
            event.stopPropagation();
            
            const zoneArray = getZoneArray(zoneName);
            const card = zoneArray.find(c => c.id == cardId);
            
            if (card && card.hasMultipleFaces) {
                card.isFlipped = !card.isFlipped;
                
                // Update card properties to reflect current face
                if (card.isFlipped && card.backFace) {
                    card.imageUrl = card.backFace.imageUrl;
                    card.name = card.backFace.name;
                    card.type = getCardType(card.backFace.typeLine);
                    card.manaCost = card.backFace.manaCost;
                } else if (card.frontFace) {
                    card.imageUrl = card.frontFace.imageUrl;
                    card.name = card.frontFace.name;
                    card.type = getCardType(card.frontFace.typeLine);
                    card.manaCost = card.frontFace.manaCost;
                }
                
                if (zoneName === 'battlefield') {
                    updateBattlefield(battlefield);
                } else {
                    updateZones();
                }
                
                const faceName = card.isFlipped ? 'back' : 'front';
                showNotification(`🔄 Flipped to ${faceName} face`);
            }
        }

        // Handle card drop
        function handleCardDrop(toZone) {
            if (!draggedCard || !draggedFromZone) return;

            const fromArray = getZoneArray(draggedFromZone);
            const toArray = getZoneArray(toZone);

            const index = fromArray.findIndex(c => c.id === draggedCard.id);
            if (index !== -1) {
                const [card] = fromArray.splice(index, 1);
                
                // Reset tap state when moving from battlefield
                if (draggedFromZone === 'battlefield') {
                    card.tapped = false;
                }

                // Add mana if playing land to battlefield
                if (toZone === 'battlefield' && card.type === 'Land') {
                    addManaFromLand(card);
                }

                toArray.push(card);
                updateZones();
                updateManaDisplay();
            }

            draggedCard = null;
            draggedFromZone = null;
        }

        // Get zone array by name
        function getZoneArray(zoneName) {
            switch(zoneName) {
                case 'hand': return hand;
                case 'battlefield': return battlefield;
                case 'graveyard': return graveyard;
                case 'library': return library;
                case 'command': return commandZone;
                default: return [];
            }
        }

        // Show context menu
        function showContextMenu(e, card, zone) {
            closeContextMenu();
            
            contextMenuCard = card;
            contextMenuZone = zone;

            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.id = 'cardContextMenu';
            menu.style.left = e.pageX + 'px';
            menu.style.top = e.pageY + 'px';

            const isTapped = card.tapped;
            const isCommander = card.isCommander;
            const canFlip = card.hasMultipleFaces;
            const canTapForMana = (card.type === 'Creature' || card.type === 'Artifact' || card.type === 'Land') && !isTapped;
            const canHaveCounters = (card.type === 'Creature' || card.type === 'Artifact' || card.type === 'Planeswalker' || card.type === 'Enchantment');
            
            let menuHTML = `
                <div class="context-menu-item" onclick="toggleTap()">${isTapped ? 'Untap' : 'Tap'} Card</div>`;
            
            if (canTapForMana) {
                const tapText = card.type === 'Land' ? '💎 Tap for Mana' : '💎 Tap for Mana';
                menuHTML += `<div class="context-menu-item" onclick="tapForManaFromMenu()">${tapText}</div>`;
            }
            
            if (canHaveCounters) {
                menuHTML += `<div class="context-menu-item" onclick="openCounterManagerFromMenu()">🔢 Manage Counters</div>`;
            }
            
            if (canFlip) {
                menuHTML += `<div class="context-menu-item" onclick="flipFromMenu()">🔄 Flip Card</div>`;
            }
            
            menuHTML += `
                <div class="context-menu-item" onclick="moveToGraveyard()">Move to Graveyard</div>
                <div class="context-menu-item" onclick="moveToHand()">Move to Hand</div>
            `;

            if (isCommander) {
                menuHTML += `<div class="context-menu-item" onclick="returnToCommandZone()" style="color: #8b0000; font-weight: 600;">⚔️ Return to Command Zone</div>`;
            }

            menu.innerHTML = menuHTML;

            document.body.appendChild(menu);
            
            // Prevent menu from closing immediately
            setTimeout(() => {
                menu.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }, 0);
        }

        // Tap for mana from context menu
        function tapForManaFromMenu() {
            if (contextMenuCard) {
                // Get approximate position of the card (use last known menu position)
                const menu = document.getElementById('cardContextMenu');
                const event = menu ? { clientX: parseInt(menu.style.left), clientY: parseInt(menu.style.top) } : { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
                
                if (contextMenuCard.type === 'Land') {
                    tapLandForMana(contextMenuCard, event);
                } else {
                    tapForMana(contextMenuCard, event);
                }
            }
            closeContextMenu();
        }

        // Flip card from context menu
        function flipFromMenu() {
            if (contextMenuCard && contextMenuCard.hasMultipleFaces) {
                contextMenuCard.isFlipped = !contextMenuCard.isFlipped;
                
                // Update card properties
                if (contextMenuCard.isFlipped && contextMenuCard.backFace) {
                    contextMenuCard.imageUrl = contextMenuCard.backFace.imageUrl;
                    contextMenuCard.name = contextMenuCard.backFace.name;
                    contextMenuCard.type = getCardType(contextMenuCard.backFace.typeLine);
                    contextMenuCard.manaCost = contextMenuCard.backFace.manaCost;
                } else if (contextMenuCard.frontFace) {
                    contextMenuCard.imageUrl = contextMenuCard.frontFace.imageUrl;
                    contextMenuCard.name = contextMenuCard.frontFace.name;
                    contextMenuCard.type = getCardType(contextMenuCard.frontFace.typeLine);
                    contextMenuCard.manaCost = contextMenuCard.frontFace.manaCost;
                }
                
                updateZones();
                const faceName = contextMenuCard.isFlipped ? 'back' : 'front';
                showNotification(`🔄 Flipped to ${faceName} face`);
            }
            closeContextMenu();
        }

        // Return commander to command zone
        function returnToCommandZone() {
            if (!contextMenuCard || !contextMenuCard.isCommander) return;
            
            const fromArray = getZoneArray(contextMenuZone);
            const index = fromArray.findIndex(c => c.id === contextMenuCard.id);
            
            if (index !== -1) {
                const [card] = fromArray.splice(index, 1);
                card.tapped = false;
                card.position = null;
                commandZone.push(card);
                updateCommandZone();
                updateZones();
                showNotification(`⚔️ ${card.name} returned to Command Zone`);
            }
            closeContextMenu();
        }

        // Move to hand from context menu
        function moveToHand() {
            if (!contextMenuCard || !contextMenuZone) return;
            
            const fromArray = getZoneArray(contextMenuZone);
            const index = fromArray.findIndex(c => c.id === contextMenuCard.id);
            
            if (index !== -1) {
                const [card] = fromArray.splice(index, 1);
                card.tapped = false;
                hand.push(card);
                updateZones();
            }
            closeContextMenu();
        }

        // Close context menu
        function closeContextMenu() {
            const menu = document.getElementById('cardContextMenu');
            if (menu) {
                menu.remove();
            }
            contextMenuCard = null;
            contextMenuZone = null;
        }

        // Toggle tap state
        function toggleTap() {
            if (!contextMenuCard || contextMenuZone !== 'battlefield') return;
            
            const card = battlefield.find(c => c.id === contextMenuCard.id);
            if (card) {
                card.tapped = !card.tapped;
                updateZones();
            }
            closeContextMenu();
        }

        // Move to graveyard from context menu
        function moveToGraveyard() {
            if (!contextMenuCard || !contextMenuZone) return;
            
            const fromArray = getZoneArray(contextMenuZone);
            const index = fromArray.findIndex(c => c.id === contextMenuCard.id);
            
            if (index !== -1) {
                const [card] = fromArray.splice(index, 1);
                card.tapped = false;
                graveyard.push(card);
                updateZones();
            }
            closeContextMenu();
        }

        // Set commander from hand
        function setCommanderFromHand() {
            if (hand.length === 0) {
                alert('No cards in hand! Draw some cards first.');
                return;
            }

            if (commandZone.length > 0) {
                const replace = confirm('Replace current commander?');
                if (!replace) return;
                
                // Return current commander to hand
                hand.push(...commandZone);
                commandZone = [];
            }

            // Show hand to select commander
            const cardNames = hand.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
            const selection = prompt(`Select your commander:\n\n${cardNames}\n\nEnter number (1-${hand.length}):`);
            
            if (selection) {
                const index = parseInt(selection) - 1;
                if (index >= 0 && index < hand.length) {
                    const commander = hand.splice(index, 1)[0];
                    commander.isCommander = true;
                    commandZone.push(commander);
                    commanderTaxCount = 0;
                    updateCommandZone();
                    updateZones();
                    showNotification(`⚔️ ${commander.name} set as Commander!`);
                } else {
                    alert('Invalid selection!');
                }
            }
        }

        // Update command zone display
        function updateCommandZone() {
            const container = document.getElementById('commandZoneCards');
            const taxDisplay = document.getElementById('commanderTax');
            const taxCostDisplay = document.getElementById('commanderTaxCost');
            
            container.innerHTML = '';
            
            if (commandZone.length === 0) {
                container.innerHTML = '<div class="command-zone-empty">No commander set</div>';
                taxDisplay.textContent = '0';
                taxCostDisplay.textContent = '+{0} to cast';
                return;
            }

            // Update tax display
            const additionalCost = commanderTaxCount * 2;
            taxDisplay.textContent = commanderTaxCount;
            taxCostDisplay.textContent = `+{${additionalCost}} to cast`;

            commandZone.forEach(commander => {
                const commanderEl = document.createElement('div');
                commanderEl.className = 'commander-card';
                
                const imageHtml = commander.imageUrl
                    ? `<img src="${commander.imageUrl}" alt="${commander.name}">`
                    : `<div class="commander-card-placeholder">${commander.name}</div>`;
                
                commanderEl.innerHTML = `
                    ${imageHtml}
                    <div class="commander-card-name">${commander.name}</div>
                `;
                
                // Click to cast
                commanderEl.onclick = () => castCommander(commander);
                
                // Right-click for options
                commanderEl.oncontextmenu = (e) => {
                    e.preventDefault();
                    showCommanderMenu(e, commander);
                };
                
                container.appendChild(commanderEl);
            });
        }

        // Cast commander from command zone
        function castCommander(commander) {
            const additionalCost = commanderTaxCount * 2;
            const totalCost = calculateTotalCommanderCost(commander.manaCost, additionalCost);
            
            const confirm = window.confirm(
                `Cast ${commander.name}?\n\n` +
                `Base Cost: ${commander.manaCost || '0'}\n` +
                `Commander Tax: +{${additionalCost}}\n` +
                `Total Cost: ${totalCost}\n\n` +
                `This will increase the tax counter and spend mana.`
            );
            
            if (confirm) {
                // Try to spend mana
                const canAfford = trySpendMana(totalCost);
                if (!canAfford) {
                    const forceCast = window.confirm(
                        `Not enough mana!\n\nCast anyway?`
                    );
                    if (!forceCast) {
                        return;
                    }
                }
                
                const index = commandZone.findIndex(c => c.id === commander.id);
                if (index !== -1) {
                    commandZone.splice(index, 1);
                    commander.position = null;
                    
                    // Check if commander enters tapped
                    if (commander.entersTapped) {
                        commander.tapped = true;
                        showNotification(`⚔️ Cast ${commander.name} (Tax: ${commanderTaxCount}) - Enters tapped`);
                    } else {
                        commander.tapped = false;
                        showNotification(`⚔️ Cast ${commander.name} (Tax: ${commanderTaxCount})`);
                    }
                    
                    battlefield.push(commander);
                    commanderTaxCount++;
                    updateCommandZone();
                    updateZones();
                    updateManaDisplay();
                }
            }
        }

        // Calculate total commander cost including tax
        function calculateTotalCommanderCost(baseCost, additionalGeneric) {
            if (!baseCost) return `{${additionalGeneric}}`;
            
            // Parse base cost
            const parsed = parseManaCost(baseCost);
            const totalGeneric = parsed.generic + additionalGeneric;
            
            // Rebuild cost string
            let result = '';
            if (totalGeneric > 0) {
                result += `{${totalGeneric}}`;
            }
            
            for (const color in parsed.colored) {
                const count = parsed.colored[color];
                for (let i = 0; i < count; i++) {
                    result += `{${color}}`;
                }
            }
            
            return result || '{0}';
        }

        // Show commander context menu
        function showCommanderMenu(e, commander) {
            closeContextMenu();
            
            contextMenuCard = commander;
            contextMenuZone = 'command';

            const menu = document.createElement('div');
            menu.className = 'context-menu';
            menu.id = 'cardContextMenu';
            menu.style.left = e.pageX + 'px';
            menu.style.top = e.pageY + 'px';

            menu.innerHTML = `
                <div class="context-menu-item" onclick="castCommander(contextMenuCard)">Cast Commander</div>
                <div class="context-menu-item" onclick="viewCommanderCard()">View Card</div>
                <div class="context-menu-item" onclick="resetCommanderTax()">Reset Tax to 0</div>
                <div class="context-menu-item" onclick="removeCommander()">Remove Commander</div>
            `;

            document.body.appendChild(menu);
            
            setTimeout(() => {
                menu.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }, 0);
        }

        function viewCommanderCard() {
            if (contextMenuCard) {
                showCardPreview(contextMenuCard);
            }
            closeContextMenu();
        }

        function resetCommanderTax() {
            commanderTaxCount = 0;
            updateCommandZone();
            showNotification('⚔️ Commander Tax reset to 0');
            closeContextMenu();
        }

        function removeCommander() {
            if (contextMenuCard) {
                const index = commandZone.findIndex(c => c.id === contextMenuCard.id);
                if (index !== -1) {
                    const commander = commandZone.splice(index, 1)[0];
                    hand.push(commander);
                    commanderTaxCount = 0;
                    updateCommandZone();
                    updateZones();
                    showNotification(`${commander.name} returned to hand`);
                }
            }
            closeContextMenu();
        }

        // Handle card clicks (double-click for hand to battlefield)
        function handleCardClick(zone, card) {
            if (zone === 'hand') {
                // Try to spend mana when playing card (but not for lands)
                if (card.type !== 'Land') {
                    const canAfford = trySpendMana(card.manaCost);
                    if (!canAfford) {
                        const result = confirm(
                            `Not enough mana to cast ${card.name}!\n\n` +
                            `Cost: ${card.manaCost || '0'}\n\n` +
                            `Cast anyway?`
                        );
                        if (!result) {
                            return; // Don't play the card
                        }
                    }
                }

                // Play card to battlefield
                const index = hand.findIndex(c => c.id === card.id);
                if (index !== -1) {
                    hand.splice(index, 1);
                    card.position = null; // Will auto-position
                    
                    // Check if card enters tapped
                    if (card.entersTapped) {
                        card.tapped = true;
                        showNotification(`⚠️ ${card.name} enters tapped`);
                    } else {
                        card.tapped = false;
                    }
                    
                    battlefield.push(card);
                }
            }

            updateZones();
            updateManaDisplay();
        }

        // Try to spend mana for a card
        function trySpendMana(manaCostString) {
            if (!manaCostString) return true; // No cost = free
            
            // Parse mana cost
            const cost = parseManaCost(manaCostString);
            const tempPool = {...manaPool};
            
            // Try to pay colored mana first
            for (const color in cost.colored) {
                const needed = cost.colored[color];
                if (tempPool[color] < needed) {
                    return false; // Can't afford
                }
                tempPool[color] -= needed;
            }
            
            // Pay generic mana with any remaining mana
            let remaining = cost.generic;
            const colors = ['W', 'U', 'B', 'R', 'G', 'C'];
            for (const color of colors) {
                while (tempPool[color] > 0 && remaining > 0) {
                    tempPool[color]--;
                    remaining--;
                }
            }
            
            if (remaining > 0) {
                return false; // Not enough mana total
            }
            
            // Actually spend the mana
            manaPool = tempPool;
            return true;
        }

        // Parse mana cost string into colored and generic costs
        function parseManaCost(manaCostString) {
            const cost = {
                generic: 0,
                colored: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
            };
            
            if (!manaCostString) return cost;
            
            // Remove braces and split
            const symbols = manaCostString.replace(/[{}]/g, '').match(/\d+|[WUBRGC]/g) || [];
            
            symbols.forEach(symbol => {
                if (/\d+/.test(symbol)) {
                    cost.generic += parseInt(symbol);
                } else if (cost.colored.hasOwnProperty(symbol)) {
                    cost.colored[symbol]++;
                }
            });
            
            return cost;
        }

        // Clear mana pool
        function clearManaPool() {
            manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
            updateManaDisplay();
            showNotification('💧 Mana pool cleared');
        }

        // Modify life total
        function modifyLife(amount) {
            lifeTotal += amount;
            updateLifeDisplay();
            
            if (amount > 0) {
                showNotification(`❤️ Gained ${amount} life`);
            } else {
                showNotification(`💔 Lost ${Math.abs(amount)} life`);
            }
            
            // Check for game over
            if (lifeTotal <= 0) {
                showNotification('💀 You have been defeated!');
            }
        }

        // Reset life to 40
        function resetLife() {
            lifeTotal = 40;
            updateLifeDisplay();
            showNotification('❤️ Life reset to 40');
        }

        // Update life display
        function updateLifeDisplay() {
            const lifeEl = document.getElementById('lifeTotal');
            lifeEl.textContent = lifeTotal;
            
            // Color coding based on life total
            if (lifeTotal <= 10) {
                lifeEl.style.color = '#ff6b6b';
            } else if (lifeTotal <= 20) {
                lifeEl.style.color = '#ffa726';
            } else {
                lifeEl.style.color = 'white';
            }
        }

        // Manually add mana (for mana rocks, etc.)
        function addMana(color) {
            if (manaPool.hasOwnProperty(color)) {
                manaPool[color]++;
                updateManaDisplay();
            }
        }

        // Update mana display
        function updateManaDisplay() {
            document.getElementById('manaW').textContent = manaPool.W;
            document.getElementById('manaU').textContent = manaPool.U;
            document.getElementById('manaB').textContent = manaPool.B;
            document.getElementById('manaR').textContent = manaPool.R;
            document.getElementById('manaG').textContent = manaPool.G;
            document.getElementById('manaC').textContent = manaPool.C;
        }

        // Run simulation
        function runSimulation() {
            if (deck.length === 0) {
                alert('Please add cards to your deck first!');
                return;
            }

            const results = [];
            for (let i = 0; i < 10; i++) {
                const testLibrary = [...deck];
                shuffleArray(testLibrary);
                const testHand = testLibrary.slice(0, 7);
                
                const lands = testHand.filter(c => c.type === 'Land').length;
                const creatures = testHand.filter(c => c.type === 'Creature').length;
                const spells = testHand.filter(c => c.type !== 'Land' && c.type !== 'Creature').length;
                
                results.push({ hand: testHand, lands, creatures, spells });
            }

            displaySimulationResults(results);
        }

        // Display simulation results
        function displaySimulationResults(results) {
            const container = document.getElementById('sampleHandsContent');
            container.innerHTML = '';

            results.forEach((result, i) => {
                const handEl = document.createElement('div');
                handEl.className = 'sample-hand';
                
                const cardNames = result.hand.map(c => c.name).join(', ');
                handEl.innerHTML = `
                    <div class="hand-label">Hand ${i + 1}: ${result.lands} Lands, ${result.creatures} Creatures, ${result.spells} Spells</div>
                    <div style="font-size: 12px; color: #666;">${cardNames}</div>
                `;
                container.appendChild(handEl);
            });

            document.getElementById('sampleHands').style.display = 'block';
        }

        // Shuffle array utility
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        // Import deck from text
        async function importDeck() {
            const text = document.getElementById('decklistText').value;
            const lines = text.split('\n').filter(l => l.trim());

            deck = [];
            let detectedCommander = null;
            let inCommanderSection = false;
            
            for (const line of lines) {
                // Check for Commander section header
                if (line.match(/^Commander.*:/i)) {
                    inCommanderSection = true;
                    continue;
                }

                // Check for other section headers (exit commander section)
                if (line.match(/^[A-Za-z\s]+:$/) && !line.match(/^Commander.*:/i)) {
                    inCommanderSection = false;
                    continue;
                }

                // Check for commander designation with asterisks: 1 *Card Name*
                const commanderMatch = line.match(/^(\d+)\s+\*(.+)\*/);
                if (commanderMatch) {
                    const name = commanderMatch[2].trim();
                    detectedCommander = await fetchAndCreateCard(name, true);
                    continue; // Don't add to main deck
                }

                // If in commander section, treat first card as commander
                if (inCommanderSection && !detectedCommander) {
                    const match = line.match(/^(\d+)\s+(.+)$/);
                    if (match) {
                        const name = match[2].trim();
                        detectedCommander = await fetchAndCreateCard(name, true);
                        inCommanderSection = false; // Got the commander, exit section
                        continue;
                    }
                }

                // Regular card match
                const match = line.match(/^(\d+)\s+(.+)$/);
                if (match) {
                    const quantity = parseInt(match[1]);
                    const name = match[2].trim();
                    
                    for (let i = 0; i < quantity; i++) {
                        const card = await fetchAndCreateCard(name, false);
                        deck.push({...card, id: Date.now() + deck.length + i});
                    }
                }
            }

            updateDeckDisplay();
            document.getElementById('decklistText').value = '';

            // Auto-set commander if detected
            if (detectedCommander) {
                commandZone = [detectedCommander];
                commanderTaxCount = 0;
                updateCommandZone();
                return `Commander: ${detectedCommander.name}`;
            }

            return null;
        }

        // Helper function to fetch and create a card
        async function fetchAndCreateCard(name, isCommander) {
            let imageUrl = null;
            let scryfallData = null;
            let type = 'Creature';
            let manaCost = '';
            let hasMultipleFaces = false;
            let frontFace = null;
            let backFace = null;
            let entersTapped = false;
            
            try {
                const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
                scryfallData = await response.json();
                
                // Check if card enters the battlefield tapped
                const oracleText = scryfallData.oracle_text || '';
                if (oracleText.toLowerCase().includes('enters the battlefield tapped') ||
                    oracleText.toLowerCase().includes('enters tapped')) {
                    entersTapped = true;
                }
                
                // Check if card has multiple faces (DFC, MDFC, transform, etc.)
                if (scryfallData.card_faces && scryfallData.card_faces.length > 1) {
                    hasMultipleFaces = true;
                    frontFace = {
                        name: scryfallData.card_faces[0].name,
                        imageUrl: scryfallData.card_faces[0].image_uris?.normal || null,
                        typeLine: scryfallData.card_faces[0].type_line,
                        manaCost: scryfallData.card_faces[0].mana_cost || '',
                        oracleText: scryfallData.card_faces[0].oracle_text || ''
                    };
                    backFace = {
                        name: scryfallData.card_faces[1].name,
                        imageUrl: scryfallData.card_faces[1].image_uris?.normal || null,
                        typeLine: scryfallData.card_faces[1].type_line,
                        manaCost: scryfallData.card_faces[1].mana_cost || '',
                        oracleText: scryfallData.card_faces[1].oracle_text || ''
                    };
                    
                    // Check front face for ETB tapped
                    if (frontFace.oracleText.toLowerCase().includes('enters the battlefield tapped') ||
                        frontFace.oracleText.toLowerCase().includes('enters tapped')) {
                        entersTapped = true;
                    }
                    
                    // Use front face as default
                    imageUrl = frontFace.imageUrl;
                    type = getCardType(frontFace.typeLine);
                    manaCost = frontFace.manaCost;
                } else {
                    // Single-faced card
                    imageUrl = scryfallData.image_uris?.normal || null;
                    type = getCardType(scryfallData.type_line);
                    manaCost = scryfallData.mana_cost || '';
                }
            } catch (error) {
                console.error(`Error fetching ${name}:`, error);
            }
            
            return {
                name,
                type,
                manaCost,
                imageUrl,
                scryfallData,
                isCommander: isCommander,
                hasMultipleFaces,
                frontFace,
                backFace,
                isFlipped: false,
                entersTapped,
                counters: {},
                id: Date.now()
            };
        }

        // Import with loading feedback
        async function importDeckWithFeedback() {
            const statusEl = document.getElementById('importStatus');
            statusEl.innerHTML = '<span class="loading-spinner"></span>Importing cards and fetching images...';
            
            try {
                const commanderInfo = await importDeck();
                let message = '✓ Import complete!';
                if (commanderInfo) {
                    message += ` ${commanderInfo} auto-detected!`;
                }
                statusEl.innerHTML = message;
                setTimeout(() => { statusEl.innerHTML = ''; }, 4000);
            } catch (error) {
                statusEl.innerHTML = '✗ Import failed. Please try again.';
                console.error(error);
            }
        }

        // Export deck to text
        function exportDeck() {
            const deckMap = new Map();
            deck.forEach(card => {
                deckMap.set(card.name, (deckMap.get(card.name) || 0) + 1);
            });

            let text = '';
            deckMap.forEach((count, name) => {
                text += `${count} ${name}\n`;
            });

            document.getElementById('decklistText').value = text;
        }

        // Clear deck
        function clearDeck() {
            if (confirm('Are you sure you want to clear the entire deck?')) {
                deck = [];
                updateDeckDisplay();
            }
        }