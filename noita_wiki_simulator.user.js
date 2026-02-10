// ==UserScript==
// @name         Noita Wiki to Wand Simulator (Compatible)
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Adds a "Open in Simulator" link to all wand templates on Noita Wiki (wiki.gg)
// @author       Antigravity
// @match        https://noita.wiki.gg/wiki/*
// @match        https://noita.wiki.gg/zh/wiki/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=wiki.gg
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const SIMULATOR_BASE_URL = 'https://asmallhamis.github.io/TheWebWandEngine/';
    // const SIMULATOR_BASE_URL = 'http://localhost:3000/';

    function utf8_to_b64(str) {
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    function createSimButton(wandText) {
        const span = document.createElement('span');
        span.className = 'simulator-link-container';
        span.style.marginLeft = '8px';
        span.style.display = 'inline-block';
        span.style.verticalAlign = 'middle';

        const b64 = utf8_to_b64(wandText);
        const url = `${SIMULATOR_BASE_URL}?wand=${b64}`;

        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.textContent = '[在模拟器中打开]';
        link.title = 'Open this wand in the Noita Wand Simulator';
        link.style.fontSize = '12px';
        link.style.color = '#ffd700';
        link.style.fontWeight = 'bold';
        link.style.textDecoration = 'none';
        link.style.fontFamily = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';

        link.onmouseover = () => link.style.textDecoration = 'underline';
        link.onmouseout = () => link.style.textDecoration = 'none';

        span.appendChild(link);
        return span;
    }

    function injectLinks() {
        // --- 1. Chinese Wiki Specific: wand-sim-link ---
        // These are the "法杖模拟器" links often found on the Chinese Wiki
        const zhSimLinks = document.querySelectorAll('.wand-sim-link a:not([data-twwe-injected])');
        zhSimLinks.forEach(a => {
            const originalUrl = a.href;
            if (originalUrl.includes('spells=')) {
                const simBtn = createSimButton(originalUrl);
                simBtn.style.marginLeft = '4px';
                a.parentNode.appendChild(simBtn);
                a.setAttribute('data-twwe-injected', 'true');
            }
        });

        // --- 2. English Wiki & Standard Templates ---
        // High priority: actual text hidden in <pre class="w2copy">
        const preElements = document.querySelectorAll('pre.w2copy');

        preElements.forEach(pre => {
            // Find the logical container (standard card or mini variant)
            const container = pre.closest('.wand2-card, .wand2-mini, .wand2-inner') || pre.parentNode;
            if (container.getAttribute('data-twwe-injected')) return;

            const wandData = pre.textContent.trim();
            if (wandData.includes('{{Wand2') || wandData.includes('{{Wand')) {
                const simBtn = createSimButton(wandData);

                // Usually there's a <button> (Copy) at the end of the container
                const copyBtn = container.querySelector('button');
                if (copyBtn) {
                    copyBtn.parentNode.insertBefore(simBtn, copyBtn.nextSibling);
                } else {
                    container.appendChild(simBtn);
                }

                container.setAttribute('data-twwe-injected', 'true');
            }
        });

        // Search for data-template attributes (often on the main div)
        const templateDivs = document.querySelectorAll('[data-template*="{{Wand"]');
        templateDivs.forEach(div => {
            if (div.getAttribute('data-twwe-injected')) return;

            const wandData = div.getAttribute('data-template');
            if (wandData) {
                const simBtn = createSimButton(wandData);
                const copyBtn = div.querySelector('button');
                if (copyBtn) {
                    copyBtn.parentNode.insertBefore(simBtn, copyBtn.nextSibling);
                } else {
                    div.appendChild(simBtn);
                }
                div.setAttribute('data-twwe-injected', 'true');
            }
        });

        // Final fallback: standard copy buttons with data-text
        const fallbackBtns = document.querySelectorAll('.copy-to-clipboard-button:not([data-twwe-injected])');
        fallbackBtns.forEach(btn => {
            if (btn.nextSibling && btn.nextSibling.className === 'simulator-link-container') return;

            const wandData = btn.getAttribute('data-text');
            if (wandData && (wandData.includes('{{Wand2') || wandData.includes('{{Wand'))) {
                const simBtn = createSimButton(wandData);
                btn.parentNode.insertBefore(simBtn, btn.nextSibling);
                btn.setAttribute('data-twwe-injected', 'true');
            }
        });
    }

    // Run periodically to catch dynamically loaded content
    setInterval(injectLinks, 1000);
    injectLinks();

    console.log('Noita Wiki to Wand Simulator (Compatible) loaded.');
})();
