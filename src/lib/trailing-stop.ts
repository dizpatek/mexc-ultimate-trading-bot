export async function checkTrailingStops() {
    console.log('[trailing-stop] checkTrailingStops called - not implemented');
    return { success: true, triggered: [] };
}

export async function activateTrailingStop(config: any) {
    console.log('[trailing-stop] activateTrailingStop called - not implemented');
    return { success: true, orderId: null };
}

export async function cancelTrailingStop(orderId: string) {
    console.log('[trailing-stop] cancelTrailingStop called - not implemented', { orderId });
    return { success: true };
}
