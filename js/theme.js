/**
 * theme.js
 * ========
 * Manajemen tema Terang (light) & Gelap (dark) dengan persistensi localStorage,
 * deteksi preferensi sistem (prefers-color-scheme), sinkronisasi meta theme-color,
 * dan notifikasi callback agar komponen Canvas (chart.js) ikut menyesuaikan warna.
 */

import { ICONS } from './utils.js';

const THEME_KEY = 'score_tracker_theme';
const listeners = new Set();

function resolveInitialTheme() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
        // ignore storage errors
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
    }
    return 'dark';
}

let currentTheme = resolveInitialTheme();

export function getTheme() {
    return currentTheme;
}

export function onThemeChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
}

function updateMetaThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', theme === 'light' ? '#f4f4f5' : '#09090b');
    }
}

function updateToggleButton(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    btn.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
    const label = theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
}

export function applyTheme(theme, persist = true) {
    currentTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateMetaThemeColor(currentTheme);
    updateToggleButton(currentTheme);

    if (persist) {
        try {
            localStorage.setItem(THEME_KEY, currentTheme);
        } catch (e) {
            // ignore
        }
    }

    listeners.forEach((fn) => {
        try {
            fn(currentTheme);
        } catch (e) {
            // ignore listener error
        }
    });
}

export function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
}

// Terapkan tema saat modul diload
applyTheme(currentTheme, false);

const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', toggleTheme);
}
