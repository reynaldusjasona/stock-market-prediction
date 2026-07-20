export function formatPrice(value) {
    if (value === null || value === undefined || value === '') return 'N/A'
    const num = Number(value)
    if (Number.isNaN(num)) return 'N/A'
    return num.toFixed(2)
}
