/* ==========================================================================
   PShop — Discount coupons available at checkout.

   Ye data JS module hai (JSON file nahi) taaki:
   • Website file:// se bhi chale — fetch() ko CORS block nahi karta
   • Ek network request kam lage
   • Bundler/minifier isse optimise kar sake

   Live backend configured ho to ye data use hi nahi hota.
   ========================================================================== */
export const COUPONS = [
  {"code":"PSHOP10","type":"percent","value":10,"minOrder":999,"maxDiscount":300,"expiry":"2026-12-31","active":true,"description":"10% off on orders above ₹999"},
  {"code":"FLAT200","type":"flat","value":200,"minOrder":1499,"maxDiscount":200,"expiry":"2026-12-31","active":true,"description":"Flat ₹200 off above ₹1499"},
  {"code":"NEWUSER","type":"percent","value":15,"minOrder":499,"maxDiscount":500,"expiry":"2026-12-31","active":true,"description":"15% off for first order"},
  {"code":"FREESHIP","type":"shipping","value":0,"minOrder":0,"maxDiscount":79,"expiry":"2026-12-31","active":true,"description":"Free delivery on any order"},
  {"code":"BIGSAVE50","type":"percent","value":50,"minOrder":4999,"maxDiscount":1500,"expiry":"2026-10-31","active":true,"description":"50% off above ₹4999 (max ₹1500)"}
];

export default COUPONS;
