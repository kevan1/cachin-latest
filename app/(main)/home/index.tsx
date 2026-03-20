import { StyleSheet, ScrollView, TouchableOpacity, View, Text, RefreshControl, Linking, Switch, Animated, useColorScheme, Platform, StatusBar } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from 'expo-haptics';
import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Transaction } from '@/types/types';
import { getMergedTransactions, startTransactionPolling } from '@/utils/transactionListener';
import { clearTransactions } from '@/utils/transactionStorage';
import { getUsernameByAddress } from '@/services/firestoreService';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { getUsername, saveUsername, getSelectedCurrency, Currency } from '@/utils/userStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMultiChainBalances } from '@/utils/multiChainBalanceService';
import { fetchArsPrice } from '@/utils/priceService';
import { ChainType, getExplorerUrl, getChainSymbol } from '@/constants/chains';
import { ChainFilter, loadSelectedChain, saveSelectedChain } from '@/utils/chainStorage';
import { THEMES, MESH_POINTS } from '@/constants/themes';
import { ThemeSelectorSheet } from '@/components/ThemeSelectorSheet';
import Svg, { Path } from 'react-native-svg';
import {
  getAccessToken,
  useEmbeddedEthereumWallet,
  useEmbeddedSolanaWallet,
  useIdentityToken,
  usePrivy,
  useSessionSigners,
} from '@privy-io/expo';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView } from "@/components/ui/GlassView";
import { ANDROID_GLASS_TAB_HEIGHT } from "@/components/GlassTabBar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PlatformPressable } from "@react-navigation/elements";
import { useToast } from "heroui-native";
import { MeshGradientView } from "@wilmxre/react-native-mesh-gradient/src";
import { buildSolanaPayUri, createSolanaPayReferences, SOLANA_USDC_MINT } from "@/utils/solanaPay";
import {
  isDuplicateSessionSignerError,
  isGaslessAuthorizationRequiredError,
} from "@/utils/privyGasless";
import { ensureSponsoredSolanaWallet } from "@/utils/privySponsorship";
import {
  getEmbeddedSolanaWalletAddress,
  getSolanaProviderAddress,
} from "@/utils/privySolanaWallet";
import { getSponsoredSolanaWallet, setSponsoredSolanaWallet } from "@/utils/sponsoredWalletStorage";
import { Image } from "expo-image";
import { buildAvatarUrl, resolveAvatarSeed } from "@/utils/avatar";

const MESH_DIMENSION = 3;


// Icon components using LineIcons style
function SendIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M12 5l7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ReceiveIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function WalletIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M17 9h4M17 15h4M17 9v6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function UserIcon({ size = 24, color = '#111' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 12a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 20c1.6-3.4 5-5 8-5s6.4 1.6 8 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LinkIcon({ size = 24, color = '#111' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.5 13.5l3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M7 17a4 4 0 010-5.66l3.17-3.17a4 4 0 015.66 5.66l-1.4 1.4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 7a4 4 0 010 5.66l-3.17 3.17a4 4 0 01-5.66-5.66l1.4-1.4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CopyIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v2M16 4v4M16 4h-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ReceiveArrowIcon({ size = 32, color = '#f97316' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v18M5 14l7 7 7-7" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BankIcon({ size = 32, color = '#6d28d9' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 18h18M2 10l10-6 10 6H2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CryptoDot({ size = 32, color = '#f97316' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20a8 8 0 100-16 8 8 0 000 16z" stroke={color} strokeWidth="2.5" />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";
  const [themeId, setThemeId] = useState<string>('blue');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  // Load saved theme
  useEffect(() => {
    AsyncStorage.getItem('user_theme').then((saved) => {
      if (saved) setThemeId(saved);
    });
  }, []);

  const handleThemeSelect = (id: string) => {
    setThemeId(id);
    AsyncStorage.setItem('user_theme', id);
  };

  const currentTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const meshColors = colorScheme === "dark" ? currentTheme.colors.dark : currentTheme.colors.light;
  const supportsMeshGradient = Platform.OS === "ios" && Number(Platform.Version) >= 16;
  
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, StatusBar.currentHeight ?? 0);
  const androidHeaderOffset = Math.max(6, topInset + 6) + 52;
  const { user, isReady } = usePrivy();
  const {
    wallets: ethereumWallets,
    create: createEthereumWallet,
  } = useEmbeddedEthereumWallet();
  const {
    wallets: solanaWallets,
    create: createSolanaWallet,
    status: solanaWalletStatus,
  } = useEmbeddedSolanaWallet();
  const { addSessionSigners, removeSessionSigners } = useSessionSigners();
  const { getIdentityToken } = useIdentityToken();
  const { toast } = useToast();
  const didLogUserJwt = useRef(false);
  const [selectedChain, setSelectedChain] = useState<ChainFilter>('all');
  const [usdBalance, setUsdBalance] = useState<string>('0.00');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [username, setUsername] = useState<string>('User');
  const [avatarError, setAvatarError] = useState(false);
  const [addressToUsername, setAddressToUsername] = useState<{ [address: string]: string }>({});
  const [isBalanceVisible, setIsBalanceVisible] = useState<boolean>(true);
  const [hideWallet, setHideWallet] = useState(false);
  const [receiveAsset, setReceiveAsset] = useState<'usdc' | 'sol'>('usdc');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [arsPrice, setArsPrice] = useState<number>(0);
  const [, setSponsoredWalletId] = useState<string | null>(null);
  const [sponsoredWalletAddress, setSponsoredWalletAddress] = useState<string | null>(null);
  const [sponsoredWalletLoaded, setSponsoredWalletLoaded] = useState(false);

  const keyQuorumId = process.env.EXPO_PUBLIC_PRIVY_KEY_QUORUM_ID;
  const sessionSignerPolicyIds = useMemo(() => {
    const raw = process.env.EXPO_PUBLIC_PRIVY_GAS_SPONSOR_POLICY_IDS;
    if (!raw) return [];
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }, []);

  useEffect(() => {
    console.log("[Home] EXPO_PUBLIC_PRIVY_KEY_QUORUM_ID:", keyQuorumId);
  }, [keyQuorumId]);

  useEffect(() => {
    // Dev-only helper to fetch the Privy user access token (aka "user-jwt") for REST calls like /v1/wallets/authenticate.
    if (!__DEV__) return;
    if (process.env.EXPO_PUBLIC_PRIVY_LOG_USER_JWT !== "true") return;
    if (!isReady || !user?.id) return;
    if (didLogUserJwt.current) return;
    didLogUserJwt.current = true;

    getAccessToken()
      .then(async (accessToken) => {
        // Make it very obvious in Metro logs (colors + a single emoji), and also print a raw copy-safe line.
        const green = "\u001b[32m";
        const cyan = "\u001b[36m";
        const reset = "\u001b[0m";
        console.log(`${green}🔑 [Privy] Tokens${reset}`);
        console.log(`PRIVY_ACCESS_TOKEN=${accessToken}`);

        const idToken = await getIdentityToken().catch(() => null);
        if (idToken) {
          console.log(`PRIVY_ID_TOKEN=${idToken}`);
        } else {
          console.log(`${cyan}[Privy] No identity token available (getIdentityToken returned null)${reset}`);
        }

        // Wallet API endpoints like /v1/wallets/authenticate expect the user's *access token* ("user_jwt") most of the time.
        // Copy the access token by default to avoid confusion. (ID token is still logged above when available.)
        if (accessToken) {
          await Clipboard.setStringAsync(accessToken);
          toast.show("Copied PRIVY_ACCESS_TOKEN to clipboard.");
        }
      })
      .catch((error) => {
        console.warn("[Privy] Failed to fetch access token", error);
      });
  }, [getIdentityToken, isReady, toast, user?.id]);

  const embeddedSolanaAddress = useMemo(() => {
    return getEmbeddedSolanaWalletAddress(solanaWallets);
  }, [solanaWallets]);

  const embeddedAvalancheAddress = useMemo(() => {
    return ethereumWallets[0]?.address ?? null;
  }, [ethereumWallets]);

  const authorizeGaslessForAddress = useCallback(
    async (address: string, options?: { silent?: boolean }) => {
      if (!keyQuorumId) {
        throw new Error(
          "Missing EXPO_PUBLIC_PRIVY_KEY_QUORUM_ID. Add it to .env and restart Metro."
        );
      }

      try {
        console.log("[Home] Adding session signer", {
          address,
          keyQuorumId,
          policyIds: sessionSignerPolicyIds,
        });
        await addSessionSigners({
          address,
          signers: [
            {
              signerId: keyQuorumId,
              policyIds: sessionSignerPolicyIds,
            },
          ],
        });

        if (!options?.silent) {
          toast.show("Gasless authorization enabled for this wallet.");
        }
      } catch (error) {
        if (isDuplicateSessionSignerError(error)) {
          if (!options?.silent) {
            toast.show("Gasless authorization is already enabled for this wallet.");
          }
          return;
        }
        throw error;
      }
    },
    [addSessionSigners, keyQuorumId, sessionSignerPolicyIds, toast]
  );

  const handleAuthorizeGasless = useCallback(async () => {
    try {
      const address = embeddedSolanaAddress;
      if (!address) {
        toast.show("No embedded Solana wallet available.");
        return;
      }
      await authorizeGaslessForAddress(address);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Home] Failed to add session signer", error);
      toast.show(message || "Failed to authorize wallet.");
    }
  }, [
    authorizeGaslessForAddress,
    embeddedSolanaAddress,
    toast,
  ]);

  const handleRevokeGasless = useCallback(async () => {
    try {
      const address = embeddedSolanaAddress;
      if (!address) {
        toast.show("No embedded Solana wallet available.");
        return;
      }
      await removeSessionSigners({ address });
      toast.show("Gasless authorization revoked for this wallet.");
    } catch (error: any) {
      console.error("[Home] Failed to revoke session signers", error);
      toast.show(error instanceof Error ? error.message : "Failed to revoke gasless.");
    }
  }, [
    embeddedSolanaAddress,
    removeSessionSigners,
    toast,
  ]);
  
  const bottomSheetRef = useRef<BottomSheet>(null);
  const sendSheetRef = useRef<BottomSheet>(null);
  const receiveSheetRef = useRef<BottomSheet>(null);
  const cryptoReceiveRef = useRef<BottomSheet>(null);
  const fiatReceiveRef = useRef<BottomSheet>(null);
  const qrScale = useRef(new Animated.Value(1)).current;
  const [fiatCurrency, setFiatCurrency] = useState<'usd' | 'eur'>('usd');
  const snapPoints = useMemo(() => ['75%'], []);
  const sendSnapPoints = useMemo(() => ['45%'], []);
  const receiveSnapPoints = useMemo(() => ['45%'], []);
  const cryptoReceiveSnapPoints = useMemo(() => ['70%'], []);
  const fiatReceiveSnapPoints = useMemo(() => ['75%'], []);
  const isIOS = process.env.EXPO_OS === "ios";
  const tabBarHeight = isIOS ? 49 : ANDROID_GLASS_TAB_HEIGHT;
  const sheetBottomPadding = Math.max(24, insets.bottom + tabBarHeight + 12);
  
  // Load selected chain preference
  useEffect(() => {
    loadSelectedChain().then(setSelectedChain);
  }, []);

  useEffect(() => {
    getSponsoredSolanaWallet()
      .then(({ id, address }) => {
        setSponsoredWalletId(id);
        setSponsoredWalletAddress(address);
      })
      .finally(() => setSponsoredWalletLoaded(true));
  }, []);

  // Load currency and prices on focus
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const storedCurrency = await getSelectedCurrency();
        setCurrency(storedCurrency);
        
        // Fetch ARS price
        try {
          const price = await fetchArsPrice();
          setArsPrice(price);
        } catch (e) {
          console.error('Failed to load ARS price', e);
        }
      };
      
      loadData();
    }, [])
  );

  const formatCompactAddress = (address: string | null, start = 4, end = 4) => {
    if (!address) return null;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  };
  
  // Get display address based on selected chain
  const getDisplayAddress = () => {
    if (selectedChain === ChainType.AVALANCHE) {
      return getAvalancheAddress();
    }

    return getSolanaAddress() ?? getAvalancheAddress();
  };
  
  // Handle chain selection
  const handleChainSelect = (chain: ChainFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChain(chain);
    saveSelectedChain(chain);
  };
  
  // Get full Solana address for username lookup
  const getFullSolanaAddressForUsername = () => {
    if (sponsoredWalletAddress) {
      return sponsoredWalletAddress;
    }
    if (solanaWallets && solanaWallets.length > 0) {
      const wallet = solanaWallets[0];
      return wallet.publicKey || null;
    }
    return null;
  };
  
  // Load username on mount
  useEffect(() => {
    const loadUsername = async () => {
      const solanaAddress = getFullSolanaAddressForUsername();
      console.log('[Home] Loading username for address:', solanaAddress);
      
      // Check if there's a pending username save from registration
      const pendingSave = await AsyncStorage.getItem('pending_username_save');
      const pendingUsername = await AsyncStorage.getItem('user_username');
      
      if (pendingSave === 'true' && pendingUsername && solanaAddress) {
        console.log('[Home] Found pending username save:', pendingUsername);
        try {
          await saveUsername(pendingUsername, solanaAddress);
          console.log('[Home] ✅ Pending username saved to Firebase:', pendingUsername);
          await AsyncStorage.removeItem('pending_username_save');
          setUsername(pendingUsername);
          return;
        } catch {
          console.error('[Home] ❌ Error saving pending username');
        }
      }
      
      // Try to get username (will check AsyncStorage first, then Firestore)
      const storedUsername = await getUsername(solanaAddress || undefined);
      console.log('[Home] Retrieved username:', storedUsername);
      
      if (storedUsername && !storedUsername.startsWith('user-')) {
        setUsername(storedUsername);
        console.log('[Home] Username set to:', storedUsername);
      } else {
        console.log('[Home] No username found, using default "User"');
      }
    };
    loadUsername();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solanaWallets, sponsoredWalletAddress]);

  const walletInitAttempted = useRef(false);
  const walletCreationAttempted = useRef(false);
  const avalancheWalletInitAttempted = useRef(false);

  useEffect(() => {
    walletInitAttempted.current = false;
    walletCreationAttempted.current = false;
    avalancheWalletInitAttempted.current = false;
  }, [user?.id]);

  useEffect(() => {
    if (!isReady || !user?.id || avalancheWalletInitAttempted.current) return;

    if (embeddedAvalancheAddress) {
      avalancheWalletInitAttempted.current = true;
      return;
    }

    if (typeof createEthereumWallet !== 'function') {
      console.warn('[Home] No embedded Avalanche wallet available and create() is unavailable.');
      return;
    }

    let isCancelled = false;
    avalancheWalletInitAttempted.current = true;

    void createEthereumWallet().catch((error) => {
      if (isCancelled) return;
      avalancheWalletInitAttempted.current = false;
      console.error('[Home] Failed to prepare Avalanche wallet', error);
    });

    return () => {
      isCancelled = true;
    };
  }, [createEthereumWallet, embeddedAvalancheAddress, isReady, user?.id]);

  useEffect(() => {
    if (!sponsoredWalletLoaded) return;
    if (!isReady || !user?.id || walletInitAttempted.current) return;

    const walletIsBusy =
      solanaWalletStatus === "creating" ||
      solanaWalletStatus === "connecting" ||
      solanaWalletStatus === "reconnecting";

    let isCancelled = false;

    const prepareSponsoredWallet = async () => {
      let walletAddress = embeddedSolanaAddress;

      if (!walletAddress) {
        if (walletIsBusy) return;
        if (walletCreationAttempted.current) return;
        if (typeof createSolanaWallet !== "function") {
          console.warn("[Home] No embedded Solana wallet available and create() is unavailable.");
          return;
        }

        walletCreationAttempted.current = true;
        console.log("[Home] No embedded Solana wallet found. Creating one...");
        const provider = await createSolanaWallet({ recoveryMethod: "privy" });
        walletAddress = getSolanaProviderAddress(provider);

        if (!walletAddress) {
          console.log("[Home] Embedded Solana wallet created. Waiting for local wallet state to sync.");
          return;
        }
      }

      if (keyQuorumId) {
        await authorizeGaslessForAddress(walletAddress, { silent: true });
      }

      walletInitAttempted.current = true;

      let wallet;
      try {
        wallet = await ensureSponsoredSolanaWallet({
          userId: user.id,
          walletAddress,
        });
      } catch (error) {
        if (keyQuorumId && isGaslessAuthorizationRequiredError(error)) {
          await authorizeGaslessForAddress(walletAddress, { silent: true });
          wallet = await ensureSponsoredSolanaWallet({
            userId: user.id,
            walletAddress,
          });
        } else {
          throw error;
        }
      }

      if (isCancelled) return;

      console.log("[Home] ✅ Sponsored wallet ready", wallet?.address);
      const nextId = wallet?.walletId ?? null;
      const nextAddress = wallet?.publicKey ?? wallet?.address ?? null;
      setSponsoredWalletId(nextId);
      setSponsoredWalletAddress(nextAddress);
      await setSponsoredSolanaWallet({ id: nextId, address: nextAddress });
    };

    void prepareSponsoredWallet().catch((error) => {
      if (isCancelled) return;
      walletInitAttempted.current = false;
      if (!embeddedSolanaAddress) {
        walletCreationAttempted.current = false;
      }
      console.error("[Home] ❌ Failed to prepare sponsored wallet", error);
    });

    return () => {
      isCancelled = true;
    };
  }, [
    createSolanaWallet,
    embeddedSolanaAddress,
    isReady,
    keyQuorumId,
    solanaWalletStatus,
    sponsoredWalletLoaded,
    authorizeGaslessForAddress,
    user?.id,
  ]);

  const getFullSolanaAddress = () => {
    if (sponsoredWalletAddress) {
      return sponsoredWalletAddress;
    }
    if (solanaWallets && solanaWallets.length > 0) {
      const wallet = solanaWallets[0];
      return wallet.publicKey || null;
    }
    return null;
  };

  const getFullAvalancheAddress = () => {
    return embeddedAvalancheAddress;
  };

  const getSolanaAddress = () => {
    return formatCompactAddress(getFullSolanaAddress());
  };

  const getAvalancheAddress = () => {
    return formatCompactAddress(getFullAvalancheAddress(), 6, 4);
  };

  const fullSolanaAddress = getFullSolanaAddress();
  const fullAvalancheAddress = getFullAvalancheAddress();
  const solanaAddress = getSolanaAddress();
  const avalancheAddress = getAvalancheAddress();

  console.log('Solana address to display:', solanaAddress);
  console.log('Avalanche address to display:', avalancheAddress);

  // Fetch all token balances and calculate USD value
  const fetchBalance = async (forceFresh: boolean = false) => {
    try {
      const multiBalances = await fetchMultiChainBalances(
        fullSolanaAddress,
        fullAvalancheAddress,
        forceFresh
      );

      console.log('Multi-chain balances:', multiBalances);

      let totalUsd = 0;
      if (selectedChain === 'all') {
        totalUsd = multiBalances.totalUsd;
      } else if (selectedChain === ChainType.SOLANA && multiBalances.solana) {
        totalUsd = multiBalances.solana.totalUsd;
      } else if (selectedChain === ChainType.AVALANCHE && multiBalances.avalanche) {
        totalUsd = multiBalances.avalanche.totalUsd;
      }

      setUsdBalance(totalUsd.toFixed(2));
      console.log('Total USD balance:', totalUsd.toFixed(2));
    } catch (error) {
      console.error('Error fetching balance:', error);
      setUsdBalance('0.00');
    }
  };

  const avatarSeed = useMemo(
    () =>
      resolveAvatarSeed({
        username,
        userId: user?.id,
        address: fullSolanaAddress,
      }),
    [fullSolanaAddress, user?.id, username]
  );
  const avatarUri = useMemo(() => buildAvatarUrl(avatarSeed, 96), [avatarSeed]);

  useEffect(() => {
    setAvatarError(false);
  }, [avatarUri]);

  const solanaPayReferences = useMemo(
    () => (fullSolanaAddress ? createSolanaPayReferences(1) : []),
    [fullSolanaAddress]
  );

  const solanaPayUri = useMemo(() => {
    if (!fullSolanaAddress) return '';
    return buildSolanaPayUri({
      recipient: fullSolanaAddress,
      splToken: receiveAsset === 'usdc' ? SOLANA_USDC_MINT : undefined,
      references: solanaPayReferences,
      label: 'Cachin',
      message: receiveAsset === 'usdc' ? 'Pay with USDC' : 'Pay with SOL',
      memo: receiveAsset === 'usdc' ? 'cachin-usdc' : 'cachin-sol',
    });
  }, [fullSolanaAddress, receiveAsset, solanaPayReferences]);

  const isAvalancheSelected = selectedChain === ChainType.AVALANCHE;
  const activeReceiveAddress = isAvalancheSelected
    ? fullAvalancheAddress
    : fullSolanaAddress;
  const activeReceiveQrValue = isAvalancheSelected
    ? fullAvalancheAddress || 'No wallet'
    : solanaPayUri || fullSolanaAddress || 'No wallet';
  const activeReceiveSubtitle = isAvalancheSelected
    ? 'Scan with an Avalanche wallet. AVAX is supported in this first pass.'
    : 'Scan with a Solana Pay wallet. USDC is preferred, SOL is supported.';
  
  // Fetch transactions and resolve usernames
  const fetchTransactions = useCallback(async (address: string) => {
    try {
      setIsLoadingTransactions(true);
      const txs = await getMergedTransactions(address);
      setTransactions(txs);
      console.log(`Loaded ${txs.length} transactions`);
      
      // Fetch usernames for all unique addresses in transactions
      const uniqueAddresses = [...new Set(txs.map(tx => tx.address))]
        .filter(addr => addr && addr.trim() !== ''); // Filter out empty/invalid addresses
      const usernameMap: { [address: string]: string } = {};
      
      await Promise.all(
        uniqueAddresses.map(async (addr) => {
          try {
            const username = await getUsernameByAddress(addr);
            if (username) {
              usernameMap[addr] = username;
            }
          } catch {
            // Ignore errors for individual lookups
          }
        })
      );
      
      setAddressToUsername(usernameMap);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);
  
  // Handle pull to refresh
  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const fullAddress = getFullSolanaAddress();
    const avalancheAddress = getFullAvalancheAddress();
    if (!fullAddress && !avalancheAddress) return;
    
    setIsRefreshing(true);
    // Clear cache to force fresh fetch
    await clearTransactions();
    const refreshTasks: Promise<unknown>[] = [
      fetchBalance(true),
    ];
    if (fullAddress) {
      refreshTasks.push(fetchTransactions(fullAddress));
    }
    await Promise.all(refreshTasks);
    setIsRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBalance, fetchTransactions]);
  
  // Fetch balance and transactions when wallet address is available
  useEffect(() => {
    const fullAddress = getFullSolanaAddress();
    const avalancheAddress = getFullAvalancheAddress();
    if (!fullAddress && !avalancheAddress) return;

    // Initial fetch
    fetchBalance();
    if (fullAddress) {
      fetchTransactions(fullAddress);
    }

    const stopPolling = fullAddress
      ? startTransactionPolling(
          fullAddress,
          120000,
          (newTransaction) => {
            console.log('New transaction received:', newTransaction);
            fetchTransactions(fullAddress);
          }
        )
      : () => {};
    
    // Refresh balance every 2 minutes (less aggressive to avoid rate limits)
    const balanceInterval = setInterval(() => {
      fetchBalance();
    }, 120000); // 2 minutes
    
    return () => {
      clearInterval(balanceInterval);
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embeddedAvalancheAddress, solanaWallets, selectedChain, sponsoredWalletAddress]);
  
  // Format transaction for display
  const formatTransaction = (tx: Transaction) => {
    // Check if we have a username for this address
    let addressDisplay = tx.address || 'Unknown';
    if (addressToUsername[tx.address]) {
      addressDisplay = addressToUsername[tx.address];
    } else if (tx.address && tx.address.length >= 12) {
      // Show shortened address if no username
      addressDisplay = `${tx.address.slice(0, 6)}...${tx.address.slice(-6)}`;
    }
    
    return {
      id: tx.id,
      type: tx.type,
      title: addressDisplay,
      subtitle: tx.type === 'send' ? 'Send' : 'Receive',
      amount: tx.type === 'send' ? `-${tx.amount.toFixed(2)}` : `+${tx.amount.toFixed(2)}`,
      currency: tx.currency || 'SOL',
      date: new Date(tx.timestamp).toLocaleDateString(),
    };
  };

  const formatUsdParts = (value: string) => {
    const num = Number.parseFloat(value);
    if (!Number.isFinite(num)) return { dollars: "0", cents: "00" };
    const fixed = num.toFixed(2);
    const [whole, cents] = fixed.split(".");
    const dollars = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return { dollars, cents: cents ?? "00" };
  };

  const getSecondaryBalanceText = () => {
    if (!isBalanceVisible) return "Tap to view balance";
    
    const usdVal = parseFloat(usdBalance);
    if (isNaN(usdVal)) return "Tap to view balance";

    if (currency === 'ARS' && arsPrice > 0) {
      const arsVal = usdVal * arsPrice;
      // Format with thousands separator
      return `≈ AR$ ${arsVal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    } else if (currency === 'EUR') {
      // approx rate
      const eurVal = usdVal * 0.95;
      return `≈ €${eurVal.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    }
    
    return `≈ $${usdBalance}`;
  };

  const selectedChainLabel =
    selectedChain === "all"
      ? "All chains"
      : selectedChain === ChainType.AVALANCHE
        ? "Avalanche"
        : "Solana";

  const getSelectedWalletAddress = () => {
    if (selectedChain === ChainType.AVALANCHE) {
      return fullAvalancheAddress;
    }

    return fullSolanaAddress ?? (selectedChain === 'all' ? fullAvalancheAddress : null);
  };

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    receiveSheetRef.current?.expand();
  };

  const handleWithdraw = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedChain === ChainType.AVALANCHE) {
      showToast('Avalanche withdraw is coming soon. Switch to Solana to continue.');
      return;
    }
    router.push('/withdraw');
  };

  const handleSend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedChain === ChainType.AVALANCHE) {
      showToast('Avalanche send is coming soon. Switch to Solana to continue.');
      return;
    }
    if (isIOS) {
      router.push("/send-options");
      return;
    }

    sendSheetRef.current?.expand();
  };

  const handleBalance = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/balance',
      params: { chain: selectedChain },
    });
  };

  const showToast = useCallback(
    (message: string) => {
      toast.show(message);
    },
    [toast]
  );

  const handleCopyAddress = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const addressToCopy = getSelectedWalletAddress();

    if (addressToCopy) {
      await Clipboard.setStringAsync(addressToCopy);
      showToast('Address copied to clipboard');
      return;
    }

    showToast('Wallet not found. Connect your wallet first.');
  };

  const handleToggleBalanceHidden = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsBalanceVisible((v) => !v);
  };

  const handleCopyReceiveAddress = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!isAvalancheSelected && solanaPayUri) {
      await Clipboard.setStringAsync(solanaPayUri);
      showToast('Payment link copied to clipboard');
    } else if (activeReceiveAddress) {
      await Clipboard.setStringAsync(activeReceiveAddress);
      showToast('Address copied to clipboard');
    } else {
      showToast('Wallet not found. Connect your wallet first.');
    }
  };

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'send':
        return <SendIcon size={24} color="#000" />;
      case 'receive':
        return <ReceiveIcon size={24} color="#000" />;
      default:
      return <WalletIcon size={24} color="#000" />;
    }
  };
  
  const handleTransactionPress = (tx: Transaction) => {
    if (selectedChain === ChainType.AVALANCHE) {
      showToast('Avalanche activity is coming soon. Switch to Solana to view transaction history.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTransaction(tx);
    bottomSheetRef.current?.expand();
  };

  const handleToggleHideWallet = (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHideWallet(value);
    showToast(
      value
        ? 'Hide My Wallet enabled. Incoming transfers will use a masked address.'
        : 'Hide My Wallet disabled. Transfers will use your primary address.'
    );
  };
  
  const handleCloseBottomSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.close();
  };
  
  const formatDetailDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' - ' + date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const shortenSignature = (sig: string) => {
    return `${sig.slice(0, 6)}...${sig.slice(-6)}`;
  };
  
  const copySignature = async (signature: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(signature);
    showToast('Transaction signature copied.');
  };
  
  const openExplorer = (signature: string) => {
    const explorerUrl = getExplorerUrl(selectedTransaction?.chain ?? ChainType.SOLANA, signature);
    Linking.openURL(explorerUrl);
  };
  
  const getInitials = (address: string) => {
    return address.slice(0, 2).toUpperCase();
  };
  
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="none"
      />
    ),
    []
  );

  const renderLockedBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="none"
        onPress={() => {}}
      />
    ),
    []
  );

  // const longPressGesture = Gesture.LongPress()
  //   .minDuration(500)
  //   .maxDistance(12)
  //   .shouldCancelWhenOutside(false)
  //   .onStart(() => {
  //     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //     setShowThemeSelector(true);
  //   })
  //   .runOnJS(true);

  // const rootGesture = Gesture.Simultaneous(
  //   longPressGesture,
  //   Gesture.Native()
  // );

  const renderGlassSurface = (
    content: ReactNode,
    style: any,
    intensity: number,
    _interactive = false
  ) =>
    (
      <GlassView style={style} intensity={intensity}>
        {content}
      </GlassView>
    );

  const recentCardContent = (
    <>
      {selectedChain === ChainType.AVALANCHE ? (
        <View style={styles.emptyStateLiquid}>
          <Text style={styles.emptyTitle}>Avalanche activity soon</Text>
          <Text style={styles.emptySubtitle}>History is still available for Solana only in this version.</Text>
        </View>
      ) : transactions.length === 0 && !isLoadingTransactions ? (
        <View style={styles.emptyStateLiquid}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySubtitle}>Your recent transfers will appear here.</Text>
        </View>
      ) : (
        transactions.slice(0, 6).map((tx) => {
          const item = formatTransaction(tx);
          const status =
            tx.status === "confirmed"
              ? { label: "Successful", dot: "#22C55E" }
              : tx.status === "pending"
                ? { label: "Pending", dot: "#F59E0B" }
                : { label: "Failed", dot: "#EF4444" };

          const dateText = new Date(tx.timestamp).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });

          return (
            <TouchableOpacity
              key={item.id}
              style={styles.recentRow}
              activeOpacity={0.85}
              onPress={() => handleTransactionPress(tx)}
            >
              <View style={styles.recentLeft}>
                <View style={styles.recentIcon}>
                  {getActivityIcon(item.type)}
                </View>
                <View style={styles.recentText}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.recentMeta} numberOfLines={1}>
                    {dateText}
                  </Text>
                </View>
              </View>
              <View style={styles.recentRight}>
                <Text style={styles.recentAmount} numberOfLines={1}>
                  {isBalanceVisible ? `$${tx.amount.toFixed(2)}` : "$••••"}
                </Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
                  <Text style={styles.statusTextLiquid}>{status.label}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </>
  );

  const screenContent = (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {supportsMeshGradient ? (
              <MeshGradientView
                meshWidth={MESH_DIMENSION}
                meshHeight={MESH_DIMENSION}
                points={MESH_POINTS}
                primaryColors={meshColors.primary}
                secondaryColors={meshColors.secondary}
                background={meshColors.background}
                smoothsColors={true}
                colorSpace="device"
                isAnimated={true}
                animationDuration={1800}
                animationType="sine"
                style={styles.background}
                pointerEvents="none"
              />
            ) : (
              <LinearGradient
                colors={[
                  meshColors.primary[0],
                  meshColors.primary[1],
                  meshColors.primary[2],
                ]}
                locations={[0, 0.6, 1]}
                style={styles.background}
                pointerEvents="none"
              />
            )}
            <LinearGradient
              colors={[
                "rgba(255,255,255,0.95)",
                "rgba(255,255,255,0.75)",
                "rgba(255,255,255,0)",
              ]}
              locations={[0, 0.35, 1]}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0.5 }}
              style={styles.backgroundFade}
              pointerEvents="none"
            />
          </View>

          <View style={styles.safeArea}>
            <View style={[styles.topHeader, { paddingTop: Math.max(6, topInset + 6) }]}>
              <TouchableOpacity
                style={styles.headerProfileRow}
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/profile");
                }}
              >
                <GlassView style={styles.headerGlassAvatar} intensity={30}>
                  {avatarError ? (
                    <View style={styles.headerProfileFallback}>
                      <Text style={styles.headerProfileFallbackText}>
                        {(username || "User").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  ) : (
                    <Image
                      source={{ uri: avatarUri }}
                      style={styles.headerGlassAvatarImage}
                      contentFit="cover"
                      onError={() => setAvatarError(true)}
                    />
                  )}
                </GlassView>
                <Text style={styles.headerGreetingText} numberOfLines={1}>
                  Hello, {username || "User"}
                </Text>
              </TouchableOpacity>

              <View style={styles.headerRight}>
                <PlatformPressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleAdd();
                  }}
                  pressOpacity={0.7}
                  style={styles.headerIconHit}
                >
                  <GlassView style={styles.headerIconButton} intensity={30}>
                    <IconSymbol
                      name="plus"
                      size={22}
                      color="rgba(0,0,0,0.72)"
                    />
                  </GlassView>
                </PlatformPressable>

                <PlatformPressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowThemeSelector(true);
                  }}
                  pressOpacity={0.7}
                  style={styles.headerIconHit}
                >
                  <GlassView style={styles.headerIconButton} intensity={30}>
                    <IconSymbol
                      name="paintpalette.fill"
                      size={22}
                      color="rgba(0,0,0,0.72)"
                    />
                  </GlassView>
                </PlatformPressable>
              </View>
            </View>

            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              contentContainerStyle={[
                styles.scrollContent,
                process.env.EXPO_OS === "ios" ? styles.scrollContentIos : null,
                process.env.EXPO_OS !== "ios" ? { paddingTop: androidHeaderOffset } : null,
                styles.safeAreaContent,
              ]}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  tintColor="#FFFFFF"
                />
              }
              showsVerticalScrollIndicator={false}
            >

          <View style={styles.balanceBlock}>
            <TouchableOpacity
              onPress={handleBalance}
              onLongPress={handleToggleBalanceHidden}
              activeOpacity={0.9}
              style={styles.balanceTap}
            >
              {isBalanceVisible ? (
                <View style={styles.balanceRowLiquid}>
                  <Text style={styles.balanceCurrencyLiquid}>$</Text>
                  <Text style={styles.balanceMainLiquid}>{formatUsdParts(usdBalance).dollars}</Text>
                  <Text style={styles.balanceCentsLiquid}>.{formatUsdParts(usdBalance).cents}</Text>
                </View>
              ) : (
                <Text style={styles.balanceHidden}>••••</Text>
              )}
              <Text style={styles.balanceSub}>
                {getSecondaryBalanceText()}
              </Text>
            </TouchableOpacity>

            <View style={styles.pillsRow}>
              <TouchableOpacity onPress={handleCopyAddress} activeOpacity={0.85}>
                {renderGlassSurface(
                  <>
                    <Text style={styles.addressPillText}>{getDisplayAddress() ?? "No wallet"}</Text>
                    <IconSymbol name="doc.on.doc" size={16} color="rgba(0,0,0,0.55)" />
                  </>,
                  styles.addressPill,
                  28,
                  true
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  const next =
                    selectedChain === "all"
                      ? ChainType.SOLANA
                      : selectedChain === ChainType.SOLANA
                        ? ChainType.AVALANCHE
                        : "all";
                  handleChainSelect(next as ChainFilter);
                }}
                onLongPress={() => {
                  if (selectedChain === ChainType.AVALANCHE) {
                    showToast('Gasless sponsorship is only available on Solana.');
                    return;
                  }
                  if (keyQuorumId) {
                    handleRevokeGasless();
                    return;
                  }
                  handleAuthorizeGasless();
                }}
                activeOpacity={0.85}
              >
                {renderGlassSurface(
                  <Text style={styles.chainPillText}>{selectedChainLabel}</Text>,
                  styles.chainPill,
                  22,
                  true
                )}
              </TouchableOpacity>

            </View>
          </View>

          <View style={styles.actionsRowLiquid}>
            <TouchableOpacity style={styles.actionHit} activeOpacity={0.9} onPress={handleAdd}>
              {renderGlassSurface(
                <>
                  <View style={styles.actionIconCircle}>
                    <IconSymbol name="plus" size={24} color="rgba(0,0,0,0.72)" />
                  </View>
                  <Text style={styles.actionLabel}>Deposit</Text>
                </>,
                styles.actionTile,
                30,
                true
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionHit} activeOpacity={0.9} onPress={handleWithdraw}>
              {renderGlassSurface(
                <>
                  <View style={styles.actionIconCircle}>
                    <IconSymbol name="arrow.up" size={24} color="rgba(0,0,0,0.72)" />
                  </View>
                  <Text style={styles.actionLabel}>Withdraw</Text>
                </>,
                styles.actionTile,
                30,
                true
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionHit} activeOpacity={0.9} onPress={handleSend}>
              {renderGlassSurface(
                <>
                  <View style={styles.actionIconCircle}>
                    <IconSymbol name="paperplane.fill" size={24} color="rgba(0,0,0,0.72)" />
                  </View>
                  <Text style={styles.actionLabel}>Send</Text>
                </>,
                styles.actionTile,
                30,
                true
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.recentHeaderRow}>
            <Text style={styles.recentHeaderText}>Recent activity</Text>
            <TouchableOpacity onPress={() => {
                        if (selectedChain === ChainType.AVALANCHE) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          showToast('Avalanche activity is coming soon. Switch to Solana to continue.');
                          return;
                        }
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push("/activity");
                      }} activeOpacity={0.85}>
              <IconSymbol name="info.circle" size={18} color="rgba(0,0,0,0.55)" />
            </TouchableOpacity>
          </View>

          <View style={styles.recentCardWrap}>
            <GlassView style={styles.recentCard} intensity={18}>
              {recentCardContent}
            </GlassView>
          </View>
            </ScrollView>
          </View>
      
      {/* Transaction Detail Bottom Sheet */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {selectedTransaction && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Transaction Summary Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryLeft}>
                  <View style={styles.detailAvatar}>
                    <Text style={styles.detailAvatarText}>
                      {getInitials(selectedTransaction.address)}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryCenter}>
                  <Text style={styles.summaryTitle}>
                    {selectedTransaction.type === 'send' ? '↗ Sent to ' : '↙ Received from '}
                    <Text style={styles.summaryAddressInline}>
                      {addressToUsername[selectedTransaction.address] || 
                       (selectedTransaction.address && selectedTransaction.address.length >= 12
                        ? `${selectedTransaction.address.slice(0, 6)}...${selectedTransaction.address.slice(-6)}`
                        : selectedTransaction.address || 'Unknown')}
                    </Text>
                  </Text>
                  <Text style={styles.detailAmount}>
                    {isBalanceVisible ? `$${selectedTransaction.amount.toFixed(2)}` : '$••••'}
                  </Text>
                </View>
                <View style={styles.summaryRight}>
                  <View style={[
                    styles.statusBadge,
                    selectedTransaction.status === 'confirmed' && styles.statusBadgeConfirmed,
                    selectedTransaction.status === 'pending' && styles.statusBadgePending,
                  ]}>
                    <Text style={styles.statusText}>
                      {selectedTransaction.status === 'confirmed' ? 'Completed' : 
                       selectedTransaction.status === 'pending' ? 'Pending' : 'Failed'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Details Card */}
              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>{formatDetailDate(selectedTransaction.timestamp)}</Text>
                </View>

                <View style={styles.detailDivider} />

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>TX ID</Text>
                  <TouchableOpacity 
                    style={styles.signatureRow} 
                    onPress={() => copySignature(selectedTransaction.signature)}
                  >
                    <Text style={styles.detailValue}>{shortenSignature(selectedTransaction.signature)}</Text>
                    <CopyIcon size={18} color="#000" />
                  </TouchableOpacity>
                </View>

                {selectedTransaction.fee && (
                  <>
                    <View style={styles.detailDivider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Network fee</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.chain === ChainType.SOLANA
                          ? (selectedTransaction.fee / 1000000000).toFixed(6)
                          : selectedTransaction.fee.toFixed(6)}{" "}
                        {getChainSymbol(selectedTransaction.chain)}
                      </Text>
                    </View>
                  </>
                )}

                {selectedTransaction.comment && (
                  <>
                    <View style={styles.detailDivider} />
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Comment</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.comment}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Action Buttons */}
              <TouchableOpacity 
                style={styles.explorerButton} 
                onPress={() => openExplorer(selectedTransaction.signature)}
              >
                <Text style={styles.explorerIcon}>↗</Text>
                <Text style={styles.explorerButtonText}>View on Explorer</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeSheetButton} onPress={handleCloseBottomSheet}>
                <Text style={styles.closeSheetButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </BottomSheetView>
      </BottomSheet>

      {!isIOS ? (
        <>
          {/* Send Options Bottom Sheet */}
          <BottomSheet
            ref={sendSheetRef}
            index={-1}
            snapPoints={sendSnapPoints}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sendSheetBackground}
            handleIndicatorStyle={styles.sendSheetIndicator}
          >
            <BottomSheetView style={styles.sendSheetContent}>
              <View style={styles.sendSheetHeader}>
                <View style={styles.sendArrow}>
                  <SendIcon size={28} color="#2563EB" />
                </View>
                <TouchableOpacity
                  style={styles.sendClose}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    sendSheetRef.current?.close();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.sendCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sendTitle}>Send</Text>
              <Text style={styles.sendSubtitle}>
                Choose how you want to send money
              </Text>

              <View style={styles.sendOptions}>
                <TouchableOpacity
                  style={styles.sendOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    sendSheetRef.current?.close();
                    setTimeout(() => router.push('/send-amount'), 150);
                  }}
                >
                  <View style={styles.sendOptionLeft}>
                    <View style={styles.sendIcon}>
                      <UserIcon size={22} color="#2563EB" />
                    </View>
                    <View>
                      <Text style={styles.sendOptionTitle}>Send to username</Text>
                      <Text style={styles.sendOptionSubtitle}>
                        Send to a Cachin username or Solana address
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sendChevron}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sendOption}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    sendSheetRef.current?.close();
                    setTimeout(() => router.push('/send-link'), 150);
                  }}
                >
                  <View style={styles.sendOptionLeft}>
                    <View style={[styles.sendIcon, styles.sendIconLink]}>
                      <LinkIcon size={22} color="#0F766E" />
                    </View>
                    <View>
                      <Text style={styles.sendOptionTitle}>Create payment link</Text>
                      <Text style={styles.sendOptionSubtitle}>
                        Share a link that anyone can claim
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.sendChevron}>›</Text>
                </TouchableOpacity>
              </View>
            </BottomSheetView>
          </BottomSheet>
        </>
      ) : null}

      {/* Receive Options Bottom Sheet */}
      <BottomSheet
        ref={receiveSheetRef}
        index={-1}
        snapPoints={receiveSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.receiveSheetBackground}
        handleIndicatorStyle={styles.receiveSheetIndicator}
      >
        <BottomSheetView style={styles.receiveSheetContent}>
          <View style={styles.receiveSheetHeader}>
            <View style={styles.receiveArrow}>
              <ReceiveArrowIcon />
            </View>
            <TouchableOpacity
              style={styles.receiveClose}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                receiveSheetRef.current?.close();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.receiveCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.receiveTitle}>Receive</Text>
          <Text style={styles.receiveSubtitle}>
            Choose one of the options below to deposit crypto
          </Text>

          <View style={styles.receiveOptions}>
            <TouchableOpacity
              style={styles.receiveOption}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                receiveSheetRef.current?.close();
                setTimeout(() => fiatReceiveRef.current?.expand(), 150);
              }}
            >
              <View style={styles.receiveOptionLeft}>
                <View style={styles.receiveIcon}>
                  <BankIcon size={28} />
                </View>
                <View>
                  <Text style={styles.receiveOptionTitle}>Fiat</Text>
                  <Text style={styles.receiveOptionSubtitle}>Receive assets via US bank account</Text>
                </View>
              </View>
              <Text style={styles.receiveChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.receiveOption}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                receiveSheetRef.current?.close();
                setTimeout(() => cryptoReceiveRef.current?.expand(), 150);
              }}
            >
              <View style={styles.receiveOptionLeft}>
                <View style={[styles.receiveIcon, styles.receiveIconCrypto]}>
                  <CryptoDot size={24} />
                </View>
                <View>
                  <Text style={styles.receiveOptionTitle}>Crypto</Text>
                  <Text style={styles.receiveOptionSubtitle}>Receive assets via wallet address</Text>
                </View>
              </View>
              <Text style={styles.receiveChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Crypto Receive Bottom Sheet */}
      <BottomSheet
        ref={cryptoReceiveRef}
        index={-1}
        snapPoints={cryptoReceiveSnapPoints}
        enablePanDownToClose
        backdropComponent={renderLockedBackdrop}
        backgroundStyle={styles.cryptoSheetBackground}
        handleIndicatorStyle={styles.cryptoSheetIndicator}
        enableDismissOnClose={false}
      >
        <BottomSheetView
          style={[styles.cryptoSheetContent, { paddingBottom: sheetBottomPadding }]}
        >
          <View style={styles.cryptoHeader}>
            <TouchableOpacity
              style={styles.cryptoClose}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                cryptoReceiveRef.current?.close();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cryptoCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cryptoTitle}>Receive</Text>
          <Text style={styles.cryptoSubtitle}>{activeReceiveSubtitle}</Text>

          {!isAvalancheSelected ? (
            <View style={styles.cryptoAssetToggle}>
              <TouchableOpacity
                style={[styles.cryptoAssetButton, receiveAsset === 'usdc' && styles.cryptoAssetButtonActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setReceiveAsset('usdc');
                }}
              >
                <Text style={[styles.cryptoAssetText, receiveAsset === 'usdc' && styles.cryptoAssetTextActive]}>
                  USDC
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cryptoAssetButton, receiveAsset === 'sol' && styles.cryptoAssetButtonActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setReceiveAsset('sol');
                }}
              >
                <Text style={[styles.cryptoAssetText, receiveAsset === 'sol' && styles.cryptoAssetTextActive]}>
                  SOL
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.cryptoQrCard}>
            <Animated.View
              style={[
                styles.cryptoQrFrame,
                {
                  transform: [{ scale: qrScale }],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPressIn={() => {
                  Animated.spring(qrScale, {
                    toValue: 0.96,
                    useNativeDriver: true,
                    friction: 6,
                  }).start();
                }}
                onPressOut={() => {
                  Animated.spring(qrScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    friction: 6,
                  }).start();
                }}
                onPress={handleCopyReceiveAddress}
              >
                <QRCode
                  value={activeReceiveQrValue}
                  size={220}
                  color="#000000"
                  backgroundColor="#ffffff"
                />
              </TouchableOpacity>
            </Animated.View>
            <Text selectable style={styles.cryptoAddress}>{(() => {
              const addr = activeReceiveAddress;
              if (!addr) return 'No address available';
              const midpoint = Math.ceil(addr.length / 2);
              return `${addr.slice(0, midpoint)}\n${addr.slice(midpoint)}`;
            })()}</Text>
          </View>

          <View style={styles.cryptoBottomSection}>
            {!isAvalancheSelected ? (
              <View style={styles.cryptoToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cryptoToggleLabel}>Receive with Hide My Wallet</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      showToast(
                        'Hide My Wallet routes deposits through a masked address for extra privacy.'
                      );
                    }}
                  >
                    <Text style={styles.cryptoToggleHelp}>
                      How it works? <Text style={styles.cryptoToggleHelpIcon}>?</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
                <Switch
                  value={hideWallet}
                  onValueChange={handleToggleHideWallet}
                  trackColor={{ false: '#E5E7EB', true: '#2563EB' }}
                  thumbColor="#ffffff"
                />
              </View>
            ) : null}

            <TouchableOpacity style={styles.cryptoCopyButton} onPress={handleCopyReceiveAddress}>
              <CopyIcon size={18} color="#111827" />
              <Text style={styles.cryptoCopyButtonText}>
                {isAvalancheSelected ? 'Copy address' : 'Copy payment link'}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheet>

      {/* Fiat Receive Bottom Sheet */}
      <BottomSheet
        ref={fiatReceiveRef}
        index={-1}
        snapPoints={fiatReceiveSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.cryptoSheetBackground}
        handleIndicatorStyle={styles.cryptoSheetIndicator}
      >
        <BottomSheetView
          style={[styles.cryptoSheetContent, { paddingBottom: sheetBottomPadding }]}
        >
          <View style={styles.cryptoHeader}>
            <TouchableOpacity
              style={styles.cryptoClose}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                fiatReceiveRef.current?.close();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.cryptoCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cryptoTitle}>Receive</Text>
          <Text style={styles.cryptoSubtitle}>Receive stablecoins via Virtual Bank Account</Text>

          <View style={styles.fiatToggleRow}>
            <TouchableOpacity
              style={[styles.fiatToggleChip, fiatCurrency === 'usd' && styles.fiatToggleChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setFiatCurrency('usd');
              }}
            >
              <Text style={[styles.fiatFlag]}>🇺🇸</Text>
              <Text style={[styles.fiatToggleText, fiatCurrency === 'usd' && styles.fiatToggleTextActive]}>USD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fiatToggleChip, fiatCurrency === 'eur' && styles.fiatToggleChipActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setFiatCurrency('eur');
              }}
            >
              <Text style={[styles.fiatFlag]}>🇪🇺</Text>
              <Text style={[styles.fiatToggleText, fiatCurrency === 'eur' && styles.fiatToggleTextActive]}>EUR</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fiatCard}>
            <View style={styles.fiatCardHeader}>
              <View style={styles.fiatFlagCircle}>
                <Text style={styles.fiatFlag}>{fiatCurrency === 'usd' ? '🇺🇸' : '🇪🇺'}</Text>
              </View>
              <View>
                <Text style={styles.fiatCardTitle}>
                  {fiatCurrency === 'usd' ? 'Virtual US Bank Account' : 'Virtual EU Bank Account'}
                </Text>
                <Text style={styles.fiatCardSubtitle}>
                  {fiatCurrency === 'usd' ? 'Accept ACH Payments' : 'Accept SEPA Payments'}
                </Text>
              </View>
            </View>

            <View style={styles.fiatDivider} />

            <View style={styles.fiatBulletRow}>
              <View style={[styles.fiatBulletIcon, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.fiatBulletText}>
                Get paid in {fiatCurrency === 'usd' ? 'USD' : 'EUR'} and automatically receive USDC in your Fuse wallet
              </Text>
            </View>
            <View style={styles.fiatBulletRow}>
              <View style={[styles.fiatBulletIcon, { backgroundColor: '#8b5cf6' }]} />
              <Text style={styles.fiatBulletText}>
                Receive payments from anyone with a bank account.
              </Text>
            </View>
            <View style={styles.fiatBulletRow}>
              <View style={[styles.fiatBulletIcon, { backgroundColor: '#fb923c' }]} />
              <Text style={styles.fiatBulletText}>
                Quick setup through Bridge with standard KYC verification
              </Text>
            </View>
          </View>

          <Text style={styles.fiatFootnote}>Unavailable for NY residents.</Text>

          <TouchableOpacity
            style={styles.fiatCta}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                fiatReceiveRef.current?.close();
                showToast('Fiat account creation coming soon');
              }}
          >
            <Text style={styles.fiatCtaText}>Create with Fuse+</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      <ThemeSelectorSheet 
        isVisible={showThemeSelector}
        onClose={() => setShowThemeSelector(false)}
        currentThemeId={themeId}
        onSelectTheme={handleThemeSelect}
        toggleThemeMode={() => {}} 
      />
    </View>
  );

  return screenContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundFade: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  safeAreaContent: {
    flexGrow: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 110,
  },
  scrollContentIos: {
    paddingTop: 112,
  },
  topHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 10,
    zIndex: 20,
    elevation: 20,
  },
  centerProfileWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    alignItems: "center",
    zIndex: 30,
    elevation: 30,
    transform: [{ translateY: -18 }],
  },
  headerProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 1,
    maxWidth: "62%",
  },
  headerGreetingText: {
    fontSize: 19,
    fontWeight: "700",
    color: "rgba(2,44,68,0.92)",
    maxWidth: 180,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconHit: {
    borderRadius: 999,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerGlassButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  headerProfileFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  headerProfileFallbackText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(0,0,0,0.72)",
  },
  headerGlassAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headerGlassAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  badge: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(0,0,0,0.72)",
  },
  balanceBlock: {
    alignItems: "center",
    paddingTop: 50,
    paddingBottom: 22,
  },
  balanceTap: {
    alignItems: "center",
  },
  balanceRowLiquid: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  balanceCurrencyLiquid: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.92)",
    marginBottom: 10,
    marginRight: 4,
  },
  balanceMainLiquid: {
    fontSize: 72,
    fontWeight: "800",
    letterSpacing: 0.2,
    color: "rgba(255,255,255,0.95)",
  },
  balanceCentsLiquid: {
    fontSize: 34,
    fontWeight: "800",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 10,
  },
  balanceHidden: {
    fontSize: 72,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
  },
  balanceSub: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.82)",
  },
  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  glassButtonSurface: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    boxShadow: "0 14px 26px rgba(12, 24, 46, 0.22)",
  },
  addressPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  addressPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(0,0,0,0.60)",
  },
  chainPill: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  chainPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(0,0,0,0.60)",
  },
  ctaWrap: {
    marginTop: 10,
  },
  ctaCard: {
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  ctaLeft: {
    flex: 1,
  },
  ctaTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "rgba(0,0,0,0.70)",
  },
  ctaSubtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(0,0,0,0.42)",
  },
  ctaIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  actionsRowLiquid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
  },
  actionHit: {
    flex: 1,
  },
  actionTile: {
    borderRadius: 24,
    minHeight: 136,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "rgba(0,0,0,0.62)",
  },
  recentHeaderRow: {
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentHeaderText: {
    fontSize: 18,
    fontWeight: "800",
    color: "rgba(0,0,0,0.55)",
  },
  recentCardWrap: {
    marginBottom: 8,
  },
  recentCard: {
    borderRadius: 26,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderCurve: "continuous",
  },
  recentCardGlass: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    boxShadow: "0 16px 32px rgba(13, 28, 54, 0.2)",
  },
  emptyStateLiquid: {
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(0,0,0,0.60)",
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(0,0,0,0.40)",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 9,
    borderRadius: 18,
  },
  recentLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 12,
  },
  recentIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  recentText: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(0,0,0,0.65)",
  },
  recentMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(0,0,0,0.38)",
  },
  recentRight: {
    alignItems: "flex-end",
  },
  recentAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: "rgba(0,0,0,0.68)",
  },
  statusRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusTextLiquid: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(0,0,0,0.40)",
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 20,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#B8A5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  verifiedBadge: {
    fontSize: 18,
    color: '#10b981',
  },
  addressBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 15,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginVertical: 15,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  balanceAmount: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#000000',
  },
  balanceCurrency: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#666666',
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#60A5FA',
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#000000',
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  activityTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityArrow: {
    fontSize: 32,
    color: '#000000',
  },
  activityList: {
    flex: 1,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 15,
    marginBottom: 10,
  },
  activityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFD580',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityItemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  activityDate: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  bottomSheetBackground: {
    backgroundColor: '#F5E6D3',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: '#000000',
    width: 40,
    height: 5,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  summaryLeft: {
    marginRight: 16,
  },
  summaryCenter: {
    flex: 1,
  },
  summaryRight: {
    marginLeft: 8,
  },
  detailAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFB380',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailAvatarText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  summaryTitle: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  summaryAddressInline: {
    color: '#000000',
    fontWeight: '600',
  },
  detailAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  statusBadge: {
    backgroundColor: '#999999',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  statusBadgeConfirmed: {
    backgroundColor: '#10b981',
  },
  statusBadgePending: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 16,
    marginBottom: 15,
  },
  detailRow: {
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    color: '#000000',
    fontWeight: '600',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  explorerButton: {
    flexDirection: 'row',
    backgroundColor: '#E8B5E8',
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    boxShadow: '3px 3px 0px rgba(0, 0, 0, 1)',
  },
  explorerIcon: {
    fontSize: 18,
  },
  explorerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  closeSheetButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 2,
    borderColor: '#000000',
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    boxShadow: '3px 3px 0px rgba(0, 0, 0, 1)',
  },
  closeSheetButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  activityAmountPositive: {
    color: '#10b981',
  },
  activityCurrency: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  chainSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 4,
    marginBottom: 15,
  },
  chainTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  chainTabActive: {
    backgroundColor: '#60A5FA',
  },
  chainTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  chainTabTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  sendSheetBackground: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sendSheetIndicator: {
    backgroundColor: '#E5E7EB',
    width: 40,
    height: 5,
  },
  sendSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sendSheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 8,
  },
  sendArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendClose: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
  sendCloseText: {
    fontSize: 20,
    color: '#777777',
  },
  sendTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
  },
  sendSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  sendOptions: {
    gap: 12,
  },
  sendOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sendIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIconLink: {
    backgroundColor: '#CCFBF1',
  },
  sendOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sendOptionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  sendChevron: {
    fontSize: 26,
    color: '#9CA3AF',
  },
  receiveSheetBackground: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  receiveSheetIndicator: {
    backgroundColor: '#E5E7EB',
    width: 40,
    height: 5,
  },
  receiveSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  receiveSheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 8,
  },
  receiveArrow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveClose: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
  receiveCloseText: {
    fontSize: 20,
    color: '#777777',
  },
  receiveTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000000',
  },
  receiveSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  receiveOptions: {
    gap: 12,
  },
  receiveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  receiveOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiveIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveIconCrypto: {
    backgroundColor: '#FFF3E6',
  },
  receiveOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  receiveOptionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  receiveChevron: {
    fontSize: 26,
    color: '#9CA3AF',
  },
  cryptoSheetBackground: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cryptoSheetIndicator: {
    backgroundColor: '#E5E7EB',
    width: 40,
    height: 5,
  },
  cryptoSheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  cryptoHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
  },
  cryptoClose: {
    position: 'absolute',
    right: 4,
    top: 0,
    padding: 8,
  },
  cryptoCloseText: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  cryptoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  cryptoSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  cryptoAssetToggle: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    padding: 6,
    borderRadius: 999,
  },
  cryptoAssetButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
  },
  cryptoAssetButtonActive: {
    backgroundColor: '#ffffff',
    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.06)',
  },
  cryptoAssetText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  cryptoAssetTextActive: {
    color: '#111827',
  },
  cryptoQrCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: 12,
    boxShadow: '0 6px 10px rgba(0, 0, 0, 0.06)',
    gap: 12,
  },
  cryptoQrFrame: {
    backgroundColor: '#f5f5f7',
    padding: 16,
    borderRadius: 24,
  },
  cryptoAddress: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18,
  },
  cryptoBottomSection: {
    gap: 16,
    paddingTop: 8,
  },
  cryptoToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cryptoToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  cryptoToggleHelp: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  cryptoToggleHelpIcon: {
    fontWeight: '700',
  },
  cryptoCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEFF4',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  cryptoCopyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  fiatToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  fiatToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fiatToggleChipActive: {
    backgroundColor: '#E0E7FF',
    borderColor: '#C7D2FE',
  },
  fiatToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  fiatToggleTextActive: {
    color: '#111827',
  },
  fiatFlag: {
    fontSize: 16,
  },
  fiatCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderCurve: 'continuous',
    padding: 16,
    boxShadow: '0 6px 10px rgba(0, 0, 0, 0.04)',
    gap: 12,
  },
  fiatCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fiatFlagCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fiatCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  fiatCardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  fiatDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  fiatBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fiatBulletIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fiatBulletText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
  },
  fiatFootnote: {
    marginTop: 12,
    marginBottom: 12,
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
  },
  fiatCta: {
    backgroundColor: '#000000',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fiatCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
