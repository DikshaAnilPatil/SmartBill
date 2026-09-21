// Comprehensive Business Types & Categories Configuration for SmartBill

export const BUSINESS_TYPES = ["Retail", "Wholesale"];

export const RETAIL_CATEGORIES = [
  "Kirana & Grocery Store",
  "Supermarket & Departmental",
  "Pharmacy & Medical Store",
  "Clothing, Garments & Fashion",
  "Footwear & Leather Goods",
  "Electronics & Mobile Store",
  "Hardware, Paints & Sanitary",
  "Electrical & Home Appliances",
  "Restaurant, Cafe & Bakery",
  "Stationery & Book Store",
  "Cosmetics & Personal Care",
  "Jewelry & Watches",
  "Automobile Spares & Garage",
  "Fruits, Vegetables & Daily Essentials",
  "General Retail / Other",
];

export const WHOLESALE_CATEGORIES = [
  "FMCG & Food Products Wholesale",
  "Textiles, Fabrics & Garments Distribution",
  "Pharma, Drugs & Surgical Supplies",
  "Electronics, IT & Appliances Wholesale",
  "Building Materials, Timber & Cement",
  "Hardware, Tools & Industrial Supplies",
  "Agriculture, Seeds & Fertilizers",
  "Auto Parts & Accessories Distribution",
  "Chemicals, Polymers & Packaging",
  "Electrical Goods & Lighting Wholesale",
  "Stationery & Office Supplies Wholesale",
  "General Wholesale / Distributor",
];

export const INDUSTRY_CATEGORIES_PRESETS = {
  // Retail Categories
  "Kirana & Grocery Store": [
    "Grains, Pulses & Atta", "Edible Oils & Ghee", "Spices & Masalas", "Packaged Snacks & Biscuits", "Beverages & Cold Drinks", "Dairy & Bakery", "Personal Hygiene & Soaps", "Household Cleaners"
  ],
  "Supermarket & Departmental": [
    "Staples & Groceries", "Packaged Foods", "Dairy & Frozen", "Beverages", "Personal Care & Cosmetics", "Cleaning & Household", "Snacks & Confectionery"
  ],
  "Pharmacy & Medical Store": [
    "Tablets & Capsules", "Syrups & Suspensions", "Injections & IV Fluids", "Ointments & Creams", "Ayurvedic & Herbal", "Baby & Mother Care", "Surgical & Diagnostic Devices", "Vitamins & Supplements"
  ],
  "Clothing, Garments & Fashion": [
    "Men's Casual Wear", "Men's Formal Wear", "Women's Ethnic & Sarees", "Women's Western", "Kids Wear", "Innerwear & Loungewear", "Winter Wear & Jackets"
  ],
  "Footwear & Leather Goods": [
    "Men's Casual Shoes", "Men's Formal Shoes", "Women's Footwear & Heels", "Sports & Running Shoes", "Kids Footwear", "Belts, Wallets & Bags"
  ],
  "Electronics & Mobile Store": [
    "Smartphones & Tablets", "Mobile Accessories & Cases", "Audio, Headphones & TWS", "Laptops & Computer Peripherals", "Smart Watches & Wearables", "Cables, Chargers & Adapters", "Power Banks & Storage"
  ],
  "Hardware, Paints & Sanitary": [
    "Hand & Power Tools", "Plumbing & Pipes", "Paints & Primers", "Bathroom & Sanitary Fittings", "Fasteners, Screws & Nails", "Adhesives & Sealants", "Door & Window Hardware"
  ],
  "Electrical & Home Appliances": [
    "Wires & Cables", "Switches & Sockets", "LED Bulbs & Lighting", "Fans & Exhausts", "Small Home Appliances", "Circuit Breakers & MCBs", "Inverters & Batteries"
  ],
  "Restaurant, Cafe & Bakery": [
    "Hot Beverages & Coffee", "Cold Drinks & Shakes", "Fast Food & Snacks", "Main Course Dishes", "Breads, Cakes & Pastries", "Desserts & Ice Cream"
  ],
  "Stationery & Book Store": [
    "Notebooks & Registers", "Pens, Pencils & Art Supplies", "Office Files & Folders", "School Textbooks & Guides", "Adhesives & Tapes", "Calculators & Desk Accessories", "Paper Reams (A4/A3)"
  ],
  "Cosmetics & Personal Care": [
    "Skincare & Moisturizers", "Hair Care & Shampoos", "Makeup & Lipsticks", "Fragrances & Deodorants", "Body Wash & Soaps", "Oral Care & Toothpastes"
  ],
  "Jewelry & Watches": [
    "Gold & Diamond Jewelry", "Silver & Imitation Jewelry", "Men's Luxury Watches", "Women's Fashion Watches", "Smartwatches & Bands", "Gemstones & Rings"
  ],
  "Automobile Spares & Garage": [
    "Engine Oils & Lubricants", "Brake Pads & Liners", "Spark Plugs & Ignition", "Filters (Oil/Air/Fuel)", "Batteries & Horns", "Tires & Tubes", "Clutch & Transmission"
  ],
  "Fruits, Vegetables & Daily Essentials": [
    "Fresh Fruits", "Green & Leafy Vegetables", "Root Vegetables & Potatoes", "Exotic & Organic Veggies", "Daily Dairy & Eggs", "Herbs & Fresh Seasonings"
  ],
  "General Retail / Other": [
    "General Goods", "Packaged Essentials", "Daily Utility Items", "Seasonal Products", "Household Accessories"
  ],

  // Wholesale Categories
  "FMCG & Food Products Wholesale": [
    "Bulk Grains & Pulses (Bags)", "Cooking Oils (Tins/Boxes)", "Sugar & Jaggery (Sacks)", "Packaged FMCG Cartons", "Bulk Beverages & Juices", "Confectionery Master Cases"
  ],
  "Textiles, Fabrics & Garments Distribution": [
    "Cotton Fabric Rolls", "Synthetic & Rayon Bales", "Men's Garment Bundles", "Sarees & Dress Materials Lot", "Denim Fabrics", "Bed Linen & Curtains"
  ],
  "Pharma, Drugs & Surgical Supplies": [
    "Ethical Formulations", "Generic Medicines (Strip Lots)", "Surgical Disposables (Cases)", "Hospital Consumables", "IV Fluids & Injectables (Boxes)", "Diagnostic Kits"
  ],
  "Electronics, IT & Appliances Wholesale": [
    "Mobile Phones Master Cartons", "Computer Hardware Bulk", "Home Appliances Wholesale", "CCTV & Security Systems", "Solar & Inverter Systems"
  ],
  "Building Materials, Timber & Cement": [
    "Cement Bags (PPC/OPC)", "TMT Steel Bars & Rods", "Bricks & AAC Blocks", "Plywood & Laminates", "Sand & Aggregates", "Pipes & Fittings"
  ],
  "Hardware, Tools & Industrial Supplies": [
    "Industrial Fasteners Bulk", "Welding Rods & Machines", "Power Tools & Cutting Blades", "Pumps & Motors", "Safety Equipment & PPE"
  ],
  "Agriculture, Seeds & Fertilizers": [
    "Crop Seeds (Hybrid/Organic)", "NPK & Organic Fertilizers", "Pesticides & Fungicides", "Sprayers & Irrigation Tools", "Plant Growth Regulators", "Animal & Cattle Feed"
  ],
  "Auto Parts & Accessories Distribution": [
    "Engine Oils & Lubricants Bulk", "Tires & Tubes Master Packs", "Brake & Clutch Kits", "Batteries & Electricals", "Filters & Belts"
  ],
  "Chemicals, Polymers & Packaging": [
    "Industrial Solvents & Acids", "Polymer Granules & Resin", "Corrugated Boxes & Master Cartons", "Bubble Wrap & Stretch Films", "Plastic Bottles & Containers", "Adhesive Tapes & Straps"
  ],
  "Electrical Goods & Lighting Wholesale": [
    "Industrial Cables (Rolls)", "Switchgears, MCBs & DBs", "Commercial LED Panels & Floodlights", "Conduit Pipes & Accessories", "Fans & Ventilation Units", "Transformers & Voltage Stabilizers"
  ],
  "Stationery & Office Supplies Wholesale": [
    "Copier Paper Pallets (A4/FS)", "Office Filing Systems Bulk", "Writing Instruments Cartons", "Packaging & Binding Materials", "Desk Supplies Master Lots", "School Stationery Packs"
  ],
  "General Wholesale / Distributor": [
    "FMCG Cartons", "Consumer Durables", "Commodity Lots", "Bulk Packaging Goods", "General Merchandise"
  ]
};

export function getCategoriesForBusinessType(businessType) {
  return String(businessType).toLowerCase() === "wholesale"
    ? WHOLESALE_CATEGORIES
    : RETAIL_CATEGORIES;
}

export function getProductCategoriesForIndustry(businessCategory, businessType) {
  if (businessCategory && INDUSTRY_CATEGORIES_PRESETS[businessCategory]) {
    return [...INDUSTRY_CATEGORIES_PRESETS[businessCategory]];
  }
  const catLower = String(businessCategory || "").toLowerCase();
  for (const [key, list] of Object.entries(INDUSTRY_CATEGORIES_PRESETS)) {
    if (key.toLowerCase().includes(catLower) || catLower.includes(key.toLowerCase())) {
      return [...list];
    }
  }
  const isWholesale = String(businessType || "").toLowerCase() === "wholesale";
  return isWholesale
    ? ["Bulk Grains & Staples", "Packaged Master Cartons", "Bulk Oils & Liquids", "General Wholesale Goods"]
    : ["Groceries & Staples", "Snacks & Packaged", "Personal Care", "General Store Items"];
}

export function isWholesaleBusiness(user) {
  if (!user) return false;
  const bType = user.businessType || user.type || "";
  return String(bType).toLowerCase() === "wholesale";
}

export function getIndustryBadgeConfig(user) {
  const isWholesale = isWholesaleBusiness(user);
  const cat = user?.businessCategory || "";
  const catLower = cat.toLowerCase();

  if (isWholesale) {
    return {
      type: "Wholesale",
      label: "🏢 Wholesale B2B",
      category: cat || "Distribution",
      badgeColor: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
      accent: "purple",
      isB2B: true,
    };
  }

  if (catLower.includes("pharmacy") || catLower.includes("medical")) {
    return {
      type: "Retail",
      label: "💊 Pharmacy & Healthcare",
      category: cat || "Medical Store",
      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
      accent: "emerald",
      isPharmacy: true,
    };
  }

  if (catLower.includes("clothing") || catLower.includes("garment") || catLower.includes("fashion") || catLower.includes("footwear")) {
    return {
      type: "Retail",
      label: "👗 Fashion & Apparel",
      category: cat || "Clothing Store",
      badgeColor: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800",
      accent: "pink",
      isApparel: true,
    };
  }

  if (catLower.includes("electronic") || catLower.includes("mobile")) {
    return {
      type: "Retail",
      label: "⚡ Electronics & Gadgets",
      category: cat || "Electronics Store",
      badgeColor: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800",
      accent: "cyan",
      isElectronics: true,
    };
  }

  return {
    type: "Retail",
    label: "🛒 Retail Counter",
    category: cat || "General Store",
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
    accent: "blue",
    isRetail: true,
  };
}
