/* ==========================================================================
   PShop — Homepage hero slider banners.

   Ye data JS module hai (JSON file nahi) taaki:
   • Website file:// se bhi chale — fetch() ko CORS block nahi karta
   • Ek network request kam lage
   • Bundler/minifier isse optimise kar sake

   Live backend configured ho to ye data use hi nahi hota.
   ========================================================================== */
export const BANNERS = [
  {"id":"b1","title":"Monsoon Mega Sale","subtitle":"Up to 60% off on Electronics","cta":"Shop Electronics","link":"pages/category.html?cat=electronics","image":"assets/img/banners/banner-1.svg","theme":"#1d4ed8"},
  {"id":"b2","title":"Fashion Fiesta","subtitle":"Trending styles from ₹299","cta":"Explore Fashion","link":"pages/category.html?cat=fashion","image":"assets/img/banners/banner-2.svg","theme":"#be185d"},
  {"id":"b3","title":"Home Upgrade Days","subtitle":"Appliances & cookware deals","cta":"Shop Home","link":"pages/category.html?cat=home-kitchen","image":"assets/img/banners/banner-3.svg","theme":"#b45309"},
  {"id":"b4","title":"Flash Sale Live","subtitle":"Extra 18% off — limited hours","cta":"Grab Now","link":"pages/shop.html?tag=flash","image":"assets/img/banners/banner-4.svg","theme":"#047857"}
];

export default BANNERS;
