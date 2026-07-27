/* ==========================================================================
   PShop — Help centre questions grouped by category.

   Ye data JS module hai (JSON file nahi) taaki:
   • Website file:// se bhi chale — fetch() ko CORS block nahi karta
   • Ek network request kam lage
   • Bundler/minifier isse optimise kar sake

   Live backend configured ho to ye data use hi nahi hota.
   ========================================================================== */
export const FAQS = [
  {"category":"Orders","question":"How do I place an order on PShop?","answer":"Add products to your cart, open the cart page, apply a coupon if you have one, then continue to checkout. Choose a delivery address, pick a payment method and confirm. You will receive an order ID instantly."},
  {"category":"Orders","question":"Can I cancel my order after placing it?","answer":"Yes. Orders can be cancelled free of charge any time before they are marked Shipped. Open Orders → Order Details → Cancel Order and select a reason."},
  {"category":"Orders","question":"How do I track my shipment?","answer":"Every order has a live timeline. Go to Orders → Track Order to see Placed, Packed, Shipped, Out for Delivery and Delivered stages with timestamps."},
  {"category":"Payments","question":"Which payment methods are supported?","answer":"We support Cash on Delivery, UPI (any UPI app), Razorpay cards/netbanking/wallets, and PShop wallet refunds."},
  {"category":"Payments","question":"When will I get my refund?","answer":"Refunds for prepaid orders are initiated within 24 hours of return pickup and reach your source account in 3–5 business days. COD refunds go to your bank account in 5–7 business days."},
  {"category":"Payments","question":"Is it safe to pay online?","answer":"Yes. Payments are processed by PCI-DSS compliant gateways. PShop never stores your full card number or UPI PIN."},
  {"category":"Delivery","question":"What are the delivery charges?","answer":"Delivery is free on orders above ₹499. Below that a flat ₹79 shipping fee applies. Express delivery costs ₹129."},
  {"category":"Delivery","question":"Do you deliver to my pincode?","answer":"We deliver to 19,000+ pincodes across India. Enter your pincode on any product page to check serviceability and the expected delivery date."},
  {"category":"Returns","question":"What is the return policy?","answer":"Most products carry a 7–30 day return window depending on category. The exact window is shown on the product page and in your order details."},
  {"category":"Returns","question":"How does replacement work?","answer":"Choose Replace Order from Order Details within the return window. A pickup is scheduled and the replacement ships once the original item is picked up."},
  {"category":"Account","question":"How do I reset my password?","answer":"Go to Login → Forgot Password, enter your registered email or mobile, verify the OTP and set a new password."},
  {"category":"Account","question":"How does OTP login work?","answer":"Enter your mobile number on the OTP Verification page. We send a 6-digit code valid for 5 minutes. Enter it to sign in without a password."},
  {"category":"Account","question":"How do I delete my account?","answer":"Open Settings → Danger Zone → Delete Account. This permanently removes your profile, addresses and cart. Order history is retained for legal compliance."},
  {"category":"Products","question":"Are the products genuine?","answer":"All products are sourced from brand-authorised sellers and pass a quality check before dispatch."},
  {"category":"Products","question":"How do I compare products?","answer":"Click the compare icon on any product card. You can compare up to 4 products side by side including price, rating, brand and specifications."}
];

export default FAQS;
