import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { BUENOS_AIRES_COFFEE_PROSPECT_SHOPS } from "@/constants/prospectShops";

const SHOPS_COLLECTION = "shops";
const DEFAULT_SHOP_IMAGE_URL =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop";
const SHOULD_USE_LOCAL_FALLBACK =
  typeof __DEV__ !== "undefined" && __DEV__;

export type CachinShop = {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  acceptsCachin: boolean;
  status?: "onboarded" | "prospect";
  cachinUsername?: string;
  solanaAddress?: string;
  imageUrl?: string;
  logoUrl?: string;
  openStatus?: string;
  hoursLabel?: string;
  featured?: boolean;
  sortOrder?: number;
};

type RawShopData = Partial<Omit<CachinShop, "id" | "acceptsCachin">> & {
  acceptsCachin?: unknown;
  coordinate?: {
    latitude?: unknown;
    longitude?: unknown;
  };
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeShop(id: string, data: RawShopData): CachinShop | null {
  const name = cleanString(data.name);
  const category = cleanString(data.category);
  const address = cleanString(data.address);
  const latitude = cleanNumber(data.latitude) ?? cleanNumber(data.coordinate?.latitude);
  const longitude = cleanNumber(data.longitude) ?? cleanNumber(data.coordinate?.longitude);
  const acceptsCachin = data.acceptsCachin === true;
  const rawStatus = cleanString(data.status);
  const status =
    rawStatus === "prospect" ? "prospect" : acceptsCachin ? "onboarded" : undefined;

  if (!name || !category || !address || latitude === null || longitude === null || !status) {
    return null;
  }

  return {
    id,
    name,
    category,
    address,
    latitude,
    longitude,
    acceptsCachin,
    status,
    cachinUsername: cleanString(data.cachinUsername) || undefined,
    solanaAddress: cleanString(data.solanaAddress) || undefined,
    imageUrl: cleanString(data.imageUrl) || DEFAULT_SHOP_IMAGE_URL,
    logoUrl: cleanString(data.logoUrl) || undefined,
    openStatus: cleanString(data.openStatus) || undefined,
    hoursLabel: cleanString(data.hoursLabel) || undefined,
    featured: data.featured === true,
    sortOrder: cleanNumber(data.sortOrder) ?? undefined,
  };
}

function sortShops(a: CachinShop, b: CachinShop): number {
  if (a.status !== b.status) {
    if (a.status === "onboarded") return -1;
    if (b.status === "onboarded") return 1;
  }

  const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (aOrder !== bOrder) return aOrder - bOrder;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function getShopDedupeKey(shop: CachinShop): string {
  return `${shop.name.trim().toLowerCase()}:${shop.latitude.toFixed(5)}:${shop.longitude.toFixed(5)}`;
}

function mergeWithProspects(shops: CachinShop[]): CachinShop[] {
  const merged = [...shops, ...BUENOS_AIRES_COFFEE_PROSPECT_SHOPS].sort(sortShops);
  const deduped = new Map<string, CachinShop>();

  for (const shop of merged) {
    const key = getShopDedupeKey(shop);
    const existing = deduped.get(key);
    if (!existing || (shop.acceptsCachin && !existing.acceptsCachin)) {
      deduped.set(key, shop);
    }
  }

  return Array.from(deduped.values()).sort(sortShops);
}

export const FALLBACK_CACHIN_SHOPS: CachinShop[] = [
  {
    id: "jevi-1",
    name: "El Jevi Kiosco - Charcas",
    category: "Kiosko",
    address: "Charcas 3405, CABA",
    latitude: -34.5903433,
    longitude: -58.4139933,
    acceptsCachin: true,
    status: "onboarded",
    imageUrl: DEFAULT_SHOP_IMAGE_URL,
    openStatus: "Abierto 24hs",
    featured: true,
    sortOrder: 10,
  },
  {
    id: "jevi-2",
    name: "El Jevi Kiosco - Pueyrredon",
    category: "Kiosko",
    address: "Av. Pueyrredon 1270, CABA",
    latitude: -34.5959475,
    longitude: -58.4030948,
    acceptsCachin: true,
    status: "onboarded",
    imageUrl: DEFAULT_SHOP_IMAGE_URL,
    openStatus: "Abierto 24hs",
    featured: true,
    sortOrder: 20,
  },
  {
    id: "jevi-3",
    name: "El Jevi Kiosco - Cabrera",
    category: "Kiosko",
    address: "Cabrera 3501, CABA",
    latitude: -34.5966556,
    longitude: -58.4156186,
    acceptsCachin: true,
    status: "onboarded",
    imageUrl: DEFAULT_SHOP_IMAGE_URL,
    openStatus: "Abierto 24hs",
    featured: true,
    sortOrder: 30,
  },
  {
    id: "jevi-4",
    name: "El Jevi Kiosco - Scalabrini Ortiz",
    category: "Kiosko",
    address: "Av. Raul Scalabrini Ortiz 1602, CABA",
    latitude: -34.5907049,
    longitude: -58.4250183,
    acceptsCachin: true,
    status: "onboarded",
    imageUrl: DEFAULT_SHOP_IMAGE_URL,
    openStatus: "Abierto 24hs",
    featured: true,
    sortOrder: 40,
  },
];

export async function getOnboardedShops(): Promise<CachinShop[]> {
  try {
    const shopsRef = collection(db, SHOPS_COLLECTION);
    const [onboardedResult, prospectResult] = await Promise.allSettled([
      getDocs(query(shopsRef, where("acceptsCachin", "==", true))),
      getDocs(query(shopsRef, where("status", "==", "prospect"))),
    ]);
    const remoteDocs = [
      ...(onboardedResult.status === "fulfilled" ? onboardedResult.value.docs : []),
      ...(prospectResult.status === "fulfilled" ? prospectResult.value.docs : []),
    ];
    const shops = remoteDocs
      .map((shopDoc) => normalizeShop(shopDoc.id, shopDoc.data() as RawShopData))
      .filter((shop): shop is CachinShop => shop !== null)
      .sort(sortShops);

    const fallbackShops = SHOULD_USE_LOCAL_FALLBACK ? FALLBACK_CACHIN_SHOPS : [];
    const sourceShops = shops.length > 0 ? shops : fallbackShops;

    return shops.length > 0 || SHOULD_USE_LOCAL_FALLBACK
      ? mergeWithProspects(sourceShops)
      : mergeWithProspects([]);
  } catch (error) {
    console.error("[ShopService] Failed to load onboarded shops", error);
    return SHOULD_USE_LOCAL_FALLBACK
      ? mergeWithProspects(FALLBACK_CACHIN_SHOPS)
      : mergeWithProspects([]);
  }
}
