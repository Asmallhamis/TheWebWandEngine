// ==UserScript==
// @name         Noita Wiki Wand Embed Evaluator
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Embeds wand evaluation results (tree + shot info) directly below wand templates on Noita Wiki
// @author       Antigravity
// @match        https://noita.wiki.gg/wiki/*
// @match        https://noita.wiki.gg/zh/wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wiki.gg
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SIMULATOR_BASE_URL = 'https://asmallhamis.github.io/TheWebWandEngine/';
    // const SIMULATOR_BASE_URL = 'https://asmallhamis.github.io/TheWebWandEngine/';

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

        // 头部：标题 + 折叠按钮
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
        toggleBtn.textContent = '▼';

        header.appendChild(titleSpan);
        header.appendChild(toggleBtn);

        // iframe 容器
        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = 'overflow: hidden; transition: height 0.3s ease;';

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

        // 加载占位符
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

        // iframe 加载完成后移除占位符
        iframe.onload = () => {
            loadingPlaceholder.style.display = 'none';
        };

        // 折叠/展开
        let isCollapsed = false;
        header.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            iframeContainer.style.display = isCollapsed ? 'none' : 'block';
            toggleBtn.textContent = isCollapsed ? '▶' : '▼';
        });

        wrapper.appendChild(header);
        wrapper.appendChild(iframeContainer);

        return { wrapper, iframe };
    }

    /**
     * 将 embed wrapper 插入到法杖卡片的外部（更宽的父容器之后）
     * 这样可以获得完整的页面宽度，而不是被卡片的窄宽度限制
     */
    function insertAfterWandCard(cardElement, wrapper) {
        // 向上查找最外层的法杖卡片容器
        const outerCard = cardElement.closest('.wand2-card, .wand2-mini') || cardElement;

        // 插入到最外层容器之后
        if (outerCard.nextSibling) {
            outerCard.parentNode.insertBefore(wrapper, outerCard.nextSibling);
        } else {
            outerCard.parentNode.appendChild(wrapper);
        }
    }

    /**
     * 监听 iframe 的高度消息
     */
    window.addEventListener('message', (event) => {
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

    /**
     * 注入嵌入式评估结果
     */
    function injectEmbeds() {
        // --- 1. Chinese Wiki: wand-sim-link ---
        const zhSimLinks = document.querySelectorAll('.wand-sim-link a:not([data-twwe-embed])');
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
        const preElements = document.querySelectorAll('pre.w2copy');
        preElements.forEach(pre => {
            const card = pre.closest('.wand2-card, .wand2-mini, .wand2-inner') || pre.parentNode;
            if (card.getAttribute('data-twwe-embed')) return;

            const wandData = pre.textContent.trim();
            if (wandData.includes('{{Wand2') || wandData.includes('{{Wand')) {
                const { wrapper } = createEmbedContainer(wandData);
                insertAfterWandCard(card, wrapper);
                card.setAttribute('data-twwe-embed', 'true');
            }
        });

        // --- 3. data-template attributes ---
        const templateDivs = document.querySelectorAll('[data-template*="{{Wand"]');
        templateDivs.forEach(div => {
            if (div.getAttribute('data-twwe-embed')) return;

            const wandData = div.getAttribute('data-template');
            if (wandData) {
                const { wrapper } = createEmbedContainer(wandData);
                insertAfterWandCard(div, wrapper);
                div.setAttribute('data-twwe-embed', 'true');
            }
        });

        // --- 4. Fallback: copy buttons with data-text ---
        const fallbackBtns = document.querySelectorAll('.copy-to-clipboard-button:not([data-twwe-embed])');
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
        @keyframes twwe-spin {
            to { transform: rotate(360deg); }
        }
        .twwe-embed-wrapper:hover {
            border-color: rgba(167, 139, 250, 0.2) !important;
        }
        /* 确保 embed 不被 wiki 布局压窄 */
        .twwe-embed-wrapper {
            clear: both;
        }
    `;
    document.head.appendChild(style);

    // 运行注入（延迟以等待 wiki 动态内容加载）
    setTimeout(injectEmbeds, 1500);
    // 定期检查新增法杖（处理动态加载的内容）
    setInterval(injectEmbeds, 3000);

    console.log('Noita Wiki Wand Embed Evaluator loaded.');
})();
