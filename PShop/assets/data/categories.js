/* ==========================================================================
   PShop — Product categories with sub-categories and brands.

   Ye data JS module hai (JSON file nahi) taaki:
   • Website file:// se bhi chale — fetch() ko CORS block nahi karta
   • Ek network request kam lage
   • Bundler/minifier isse optimise kar sake

   Live backend configured ho to ye data use hi nahi hota.
   ========================================================================== */
export const CATEGORIES = [
  {"id":"c1","name":"Electronics","slug":"electronics","description":"Phones, laptops, audio & smart gear","color":"#2563eb","icon":"assets/img/categories/electronics.svg","banner":"assets/img/categories/electronics-banner.svg","subCategories":["Smartphones","Laptops","Headphones","Smart Watches","Cameras","Accessories"],"brands":["Nexon","Volta","AuraTech","Kiro","Zenix","Pulsewave"],"productCount":12},
  {"id":"c2","name":"Fashion","slug":"fashion","description":"Clothing, footwear & accessories","color":"#db2777","icon":"assets/img/categories/fashion.svg","banner":"assets/img/categories/fashion-banner.svg","subCategories":["Men's Wear","Women's Wear","Footwear","Watches","Bags","Jewellery"],"brands":["Urbanix","Métro","Denimo","Stridewell","Lumea","Craftline"],"productCount":12},
  {"id":"c3","name":"Home & Kitchen","slug":"home-kitchen","description":"Appliances, cookware & decor","color":"#f59e0b","icon":"assets/img/categories/home-kitchen.svg","banner":"assets/img/categories/home-kitchen-banner.svg","subCategories":["Cookware","Appliances","Furniture","Decor","Storage","Bedding"],"brands":["HomeNest","Chefline","CasaVia","Ironhaus","Bloomly","Nordika"],"productCount":12},
  {"id":"c4","name":"Beauty","slug":"beauty","description":"Skincare, grooming & fragrance","color":"#8b5cf6","icon":"assets/img/categories/beauty.svg","banner":"assets/img/categories/beauty-banner.svg","subCategories":["Skincare","Haircare","Makeup","Fragrance","Grooming","Wellness"],"brands":["Glowen","Botanika","Purelis","Aromé","Sheen","Vitalya"],"productCount":12},
  {"id":"c5","name":"Sports","slug":"sports","description":"Fitness, outdoor & sportswear","color":"#10b981","icon":"assets/img/categories/sports.svg","banner":"assets/img/categories/sports-banner.svg","subCategories":["Fitness","Cricket","Cycling","Footwear","Outdoor","Yoga"],"brands":["Kinetiq","Strider","Peakform","Vantage","Rallye","Zenflow"],"productCount":12},
  {"id":"c6","name":"Grocery","slug":"grocery","description":"Daily essentials & packaged food","color":"#ef4444","icon":"assets/img/categories/grocery.svg","banner":"assets/img/categories/grocery-banner.svg","subCategories":["Staples","Snacks","Beverages","Dairy","Personal Care","Household"],"brands":["Farmly","DailyGood","Harvestly","Nutrio","Pantrix","Freshkart"],"productCount":12},
  {"id":"c7","name":"Toys & Baby","slug":"toys-baby","description":"Toys, games & baby care","color":"#06b6d4","icon":"assets/img/categories/toys-baby.svg","banner":"assets/img/categories/toys-baby-banner.svg","subCategories":["Action Figures","Board Games","Soft Toys","Baby Care","Learning","Outdoor Play"],"brands":["Playnest","Brickly","Cuddlo","Tinybean","Brainy","Zoomies"],"productCount":12},
  {"id":"c8","name":"Books","slug":"books","description":"Fiction, academics & stationery","color":"#64748b","icon":"assets/img/categories/books.svg","banner":"assets/img/categories/books-banner.svg","subCategories":["Fiction","Non-Fiction","Academics","Comics","Stationery","Exam Prep"],"brands":["Inkwell","PagePress","Scholarix","Panelverse","Notely","RankUp"],"productCount":12}
];

export default CATEGORIES;
