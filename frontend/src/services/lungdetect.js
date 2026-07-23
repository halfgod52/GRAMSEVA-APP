/**
 * GramSeva Health — Chest X-Ray Detection Service
 * ==================================================
 * Connects the frontend to the FastAPI CNN service (Port 8001).
 */

const CNN_SERVER = import.meta.env.VITE_SKIN_SERVER_URL || 'http://localhost:8001';

/**
 * detectChestAnomaly — sends a chest X-Ray file to the CNN backend
 */
export async function detectChestAnomaly(imageFile) {
    const formData = new FormData();
    formData.append('file', imageFile);

    try {
        const response = await fetch(`${CNN_SERVER}/api/chest-detect`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(30000), // 30s timeout for image processing
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.detail || `Server error ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError' || error.name === 'TypeError' || error.message.includes('fetch')) {
            console.warn('⚠️ Chest X-Ray detection server unreachable');
            throw new Error('Chest X-Ray detection server is offline. Please start it with: ./start.sh');
        }
        throw error;
    }
}

/**
 * checkChestServerHealth — ping the chest server
 */
export async function checkChestServerHealth() {
    try {
        const res = await fetch(`${CNN_SERVER}/api/chest-health`, {
            signal: AbortSignal.timeout(3000),
        });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}
