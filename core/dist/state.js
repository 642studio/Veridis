/** Estado inicial del sistema */
const initialState = {
    status: "idle",
    lastEvent: null,
    updatedAt: new Date().toISOString(),
};
let state = { ...initialState };
/**
 * Devuelve una copia del estado actual.
 */
export function getState() {
    return { ...state };
}
/**
 * Registra un evento: lo guarda como lastEvent, pone status en "alert" y actualiza updatedAt.
 */
export function addEvent(event) {
    const now = new Date().toISOString();
    state = {
        status: "alert",
        lastEvent: event,
        updatedAt: now,
    };
}
