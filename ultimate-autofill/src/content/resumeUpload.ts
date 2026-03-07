/**
 * Resume Upload – detects file input fields and attaches stored resume.
 * Ported from OptimHire patch.
 */
import { getFieldLabel, isVisible } from '../fieldMatcher/smartGuesser';

const LOG = (...a: unknown[]) => console.log('[UA-Resume]', ...a);

/**
 * Try to upload a stored resume to visible file input fields.
 * The resume must be stored in chrome.storage.local as a base64 data URI.
 */
export async function tryResumeUpload(): Promise<boolean> {
    const fileInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
    if (fileInputs.length === 0) return false;

    const { ua_resumeFile, ua_resumeFileName, resumeFile, resumeFileName } =
        await chrome.storage.local.get(['ua_resumeFile', 'ua_resumeFileName', 'resumeFile', 'resumeFileName']);
    const file = ua_resumeFile || resumeFile;
    const fileName = ua_resumeFileName || resumeFileName || 'resume.pdf';
    if (!file) {
        LOG('No stored resume for upload');
        return false;
    }

    let uploaded = false;
    for (const fi of fileInputs) {
        if (fi.files && fi.files.length > 0) continue; // Already has file
        const lbl = getFieldLabel(fi) || fi.name || fi.accept || '';
        const l = lbl.toLowerCase();
        // Only attach to resume/CV fields
        if (/resume|cv|curriculum|document|upload|attach|file/i.test(l) || fi.accept?.includes('.pdf') || fi.accept?.includes('.doc')) {
            try {
                const resp = await fetch(file);
                const blob = await resp.blob();
                const fileObj = new File([blob], fileName, { type: blob.type || 'application/pdf' });
                const dt = new DataTransfer();
                dt.items.add(fileObj);
                fi.files = dt.files;
                fi.dispatchEvent(new Event('change', { bubbles: true }));
                fi.dispatchEvent(new Event('input', { bubbles: true }));
                LOG('Resume uploaded to:', lbl);
                uploaded = true;
            } catch (e) {
                LOG('Resume upload failed:', e);
            }
        }
    }
    return uploaded;
}
