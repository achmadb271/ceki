/**
 * feedback-modal.js
 * =================
 * Modal Masukan & Lapor Bug Pengguna via FormSubmit AJAX.
 */

import { showAppToast } from './toast.js';

const DESTINATION_EMAIL = 'kangc3nd0l@gmail.com';

const feedbackModal = document.getElementById('feedback-modal');
const feedbackModalContent = document.getElementById('feedback-modal-content');
const btnOpenFeedback = document.getElementById('btn-open-feedback');
const btnCloseFeedback = document.getElementById('btn-close-feedback');
const btnCancelFeedback = document.getElementById('btn-cancel-feedback');

const feedbackForm = document.getElementById('feedback-form');
const feedbackName = document.getElementById('feedback-name');
const feedbackCategory = document.getElementById('feedback-category');
const feedbackMessage = document.getElementById('feedback-message');
const btnSubmitFeedback = document.getElementById('btn-submit-feedback');

export function openFeedbackModal() {
    if (!feedbackModal) return;
    feedbackModal.classList.remove('hidden');
    void feedbackModalContent.offsetWidth;
    feedbackModal.classList.add('is-visible');
    setTimeout(() => {
        if (feedbackMessage) feedbackMessage.focus();
    }, 150);
}

export function closeFeedbackModal() {
    if (!feedbackModal) return;
    feedbackModal.classList.remove('is-visible');
    setTimeout(() => feedbackModal.classList.add('hidden'), 200);
}

if (btnOpenFeedback) btnOpenFeedback.addEventListener('click', openFeedbackModal);
if (btnCloseFeedback) btnCloseFeedback.addEventListener('click', closeFeedbackModal);
if (btnCancelFeedback) btnCancelFeedback.addEventListener('click', closeFeedbackModal);
if (feedbackModal) {
    feedbackModal.addEventListener('click', (e) => {
        if (e.target === feedbackModal) closeFeedbackModal();
    });
}

if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const message = feedbackMessage.value.trim();
        if (!message) {
            showAppToast('Pesan masukan tidak boleh kosong.', 'info');
            return;
        }

        const senderName = feedbackName.value.trim() || 'Pemain Ceki';
        const category = feedbackCategory.value || 'Masukan Umum';

        if (btnSubmitFeedback) {
            btnSubmitFeedback.disabled = true;
            btnSubmitFeedback.textContent = 'Mengirim...';
        }

        try {
            const response = await fetch(`https://formsubmit.co/ajax/${DESTINATION_EMAIL}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    Nama: senderName,
                    Kategori: category,
                    Pesan: message,
                    _subject: `[Ceki Score Tracker] ${category} dari ${senderName}`,
                    _template: 'table',
                    _captcha: 'false',
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data.success !== 'false' && data.success !== false) {
                showAppToast('Terima kasih! Masukan kamu berhasil dikirim.', 'success');
                feedbackForm.reset();
                closeFeedbackModal();
            } else {
                throw new Error(data.message || 'Gagal mengirim');
            }
        } catch (err) {
            showAppToast('Gagal terkirim otomatis. Mengalihkan ke aplikasi Email...', 'info');
            const mailtoUrl = `mailto:${DESTINATION_EMAIL}?subject=${encodeURIComponent(`[Ceki Score Tracker] ${category}`)}&body=${encodeURIComponent(`Dari: ${senderName}\n\nPesan:\n${message}`)}`;
            window.location.href = mailtoUrl;
        } finally {
            if (btnSubmitFeedback) {
                btnSubmitFeedback.disabled = false;
                btnSubmitFeedback.textContent = 'Kirim Masukan';
            }
        }
    });
}
