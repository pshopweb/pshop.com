/* ==========================================================================
   PShop — order-related UI helpers (orders, order-details, track, profile
   sab isse import karte hain — kisi page ke side-effects trigger kiye bina)
   ========================================================================== */

/** Order status ke hisab se badge ka colour class deta hai. */
export function statusBadge(status) {
  if (status === 'Delivered') return 'badge-success';
  if (status === 'Cancelled') return 'badge-danger';
  if (/Return|Replacement/.test(status)) return 'badge-warning';
  if (status === 'Out for Delivery' || status === 'Shipped') return 'badge-info';
  return 'badge-muted';
}
