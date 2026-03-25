// ==UserScript==
// @name         Noita Wiki Wand Embed Evaluator
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Embeds wand evaluation results (tree + shot info) directly below wand templates on Noita Wiki (Optimized with MutationObserver)
// @author       Antigravity
// @match        https://noita.wiki.gg/wiki/*
// @match        https://noita.wiki.gg/zh/wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wiki.gg
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SIMULATOR_BASE_URL = 'https://asmallhamis.github.io/TheWebWandEngine/';

    function utf8_to_b64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    /**
     * 创建嵌入评估结果的容器
     */
    function createEmbedContainer(wandText) {
        const wrapper = document.createElement('div');
        wrapper.className = 'twwe-embed-wrapper';
        wrapper.style.cssText = `
            margin: 12px 0;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px;
            overflow: hidden;
            background: rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            width: 100%;
            max-width: 100vw;
            box-sizing: border-box;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 12px;
            background: rgba(255,255,255,0.03);
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        `;

        const titleSpan = document.createElement('span');
        titleSpan.style.cssText = `
            font-size: 11px;
            font-weight: 700;
            color: #a78bfa;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        `;
        titleSpan.textContent = '⚡ Wand Evaluation';

        const toggleBtn = document.createElement('span');
        toggleBtn.style.cssText = `
            font-size: 10px;
            color: #71717a;
            font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        `;
        toggleBtn.textContent = '▶';

        header.appendChild(titleSpan);
        header.appendChild(toggleBtn);

        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = 'overflow: hidden; transition: height 0.3s ease; display: none;';

        const b64 = utf8_to_b64(wandText);
        const url = `${SIMULATOR_BASE_URL}?embed&wand=${b64}`;

        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.style.cssText = `
            width: 100%;
            border: none;
            min-height: 100px;
            height: 400px;
            display: block;
            background: transparent;
        `;
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

        const loadingPlaceholder = document.createElement('div');
        loadingPlaceholder.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 16px;
            color: #71717a;
            font-size: 12px;
            font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        `;
        loadingPlaceholder.innerHTML = `
            <div style="
                width: 14px; height: 14px;
                border: 2px solid #3f3f46;
                border-top-color: #a78bfa;
                border-radius: 50%;
                animation: twwe-spin 0.8s linear infinite;
            "></div>
            Loading evaluation...
        `;

        iframeContainer.appendChild(loadingPlaceholder);
        iframeContainer.appendChild(iframe);

        iframe.onload = () => {
            loadingPlaceholder.style.display = 'none';
        };

        let isCollapsed = true;
        header.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            iframeContainer.style.display = isCollapsed ? 'none' : 'block';
            toggleBtn.textContent = isCollapsed ? '▶' : '▼';
        });

        wrapper.appendChild(header);
        wrapper.appendChild(iframeContainer);

        return { wrapper };
    }

    function insertAfterWandCard(cardElement, wrapper) {
        const outerCard = cardElement.closest('.wand2-card, .wand2-mini') || cardElement;
        if (outerCard.nextSibling) {
            outerCard.parentNode.insertBefore(wrapper, outerCard.nextSibling);
        } else {
            outerCard.parentNode.appendChild(wrapper);
        }
    }

    window.addEventListener('message', (event) => {
        // Security check
        if (event.origin !== new URL(SIMULATOR_BASE_URL).origin) return;
        
        if (event.data && event.data.type === 'TWWE_EMBED_RESIZE') {
            const iframes = document.querySelectorAll('.twwe-embed-wrapper iframe');
            iframes.forEach(iframe => {
                if (iframe.contentWindow === event.source) {
                    const newHeight = Math.max(100, event.data.height + 16);
                    iframe.style.height = newHeight + 'px';
                }
            });
        }
    });

    function injectEmbeds(container = document) {
        // --- 1. Chinese Wiki: wand-sim-link ---
        const zhSimLinks = container.querySelectorAll('.wand-sim-link a:not([data-twwe-embed])');
        zhSimLinks.forEach(a => {
            const originalUrl = a.href;
            if (originalUrl.includes('spells=')) {
                const card = a.closest('.wand2-card, .wand2-mini, .wand2-inner') || a.parentNode.parentNode;
                if (card && !card.getAttribute('data-twwe-embed')) {
                    const { wrapper } = createEmbedContainer(originalUrl);
                    insertAfterWandCard(card, wrapper);
                    card.setAttribute('data-twwe-embed', 'true');
                }
                a.setAttribute('data-twwe-embed', 'true');
            }
        });

        // --- 2. pre.w2copy (standard wand cards) ---
        const preElements = container.querySelectorAll('pre.w2copy:not([data-twwe-embed])');
        preElements.forEach(pre => {
            const card = pre.closest('.wand2-card, .wand2-mini, .wand2-inner') || pre.parentNode;
            if (card.getAttribute('data-twwe-embed')) return;

            const wandData = pre.textContent.trim();
            if (wandData.includes('{{Wand2') || wandData.includes('{{Wand')) {
                const { wrapper } = createEmbedContainer(wandData);
                insertAfterWandCard(card, wrapper);
                card.setAttribute('data-twwe-embed', 'true');
            }
            pre.setAttribute('data-twwe-embed', 'true');
        });

        // --- 3. data-template attributes ---
        const templateDivs = container.querySelectorAll('[data-template*="{{Wand"]:not([data-twwe-embed])');
        templateDivs.forEach(div => {
            const wandData = div.getAttribute('data-template');
            if (wandData) {
                const { wrapper } = createEmbedContainer(wandData);
                insertAfterWandCard(div, wrapper);
                div.setAttribute('data-twwe-embed', 'true');
            }
        });

        // --- 4. Fallback: copy buttons with data-text ---
        const fallbackBtns = container.querySelectorAll('.copy-to-clipboard-button:not([data-twwe-embed])');
        fallbackBtns.forEach(btn => {
            const wandData = btn.getAttribute('data-text');
            if (wandData && (wandData.includes('{{Wand2') || wandData.includes('{{Wand'))) {
                const card = btn.closest('.wand2-card, .wand2-mini, .wand2-inner') || btn.parentNode;
                if (card && !card.getAttribute('data-twwe-embed')) {
                    const { wrapper } = createEmbedContainer(wandData);
                    insertAfterWandCard(card, wrapper);
                    card.setAttribute('data-twwe-embed', 'true');
                }
                btn.setAttribute('data-twwe-embed', 'true');
            }
        });
    }

    // 注入全局样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes twwe-spin { to { transform: rotate(360deg); } }
        .twwe-embed-wrapper:hover { border-color: rgba(167, 139, 250, 0.2) !important; }
        .twwe-embed-wrapper { clear: both; }
    `;
    document.head.appendChild(style);

    // Initial injection
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectEmbeds());
    } else {
        injectEmbeds();
    }

    // MutationObserver to handle dynamic content
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
        }
        if (shouldCheck) {
            // Simple debounce or just call it (injectEmbeds filters out injected ones)
            injectEmbeds();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log('Noita Wiki Wand Embed Evaluator (MutationObserver) loaded.');
})();
