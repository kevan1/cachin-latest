import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  AndroidConfig,
  withAndroidManifest,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withPodfile,
} from "@expo/config-plugins";
import { mergeContents, removeContents } from "@expo/config-plugins/build/utils/generateCode";
import type { ConfigContext, ExpoConfig } from "expo/config";

const normalizeEnvValue = (value?: string) =>
  value?.trim().replace(/^['"]|['"]$/g, "");

const normalizeExtraValue = (value: unknown) =>
  typeof value === "string" ? normalizeEnvValue(value) : undefined;

const googleMapsApiKey = normalizeEnvValue(
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY
);
const apiUrl = normalizeEnvValue(process.env.EXPO_PUBLIC_API_URL);
const LOCATION_USAGE_DESCRIPTION =
  "Allow Cachin to use your location to show nearby shops on the map.";

const isValidGoogleApiKey = (key?: string) =>
  !!key && /^AIza[A-Za-z0-9_-]{35}$/.test(key);

const APP_DELEGATE_RETURN =
  /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/g;
const PODFILE_ANCHOR = /use_native_modules!/;
const MAPS_IMPORT_TAG = "react-native-maps-import";
const MAPS_INIT_TAG = "react-native-maps-init";
const MAPS_PODFILE_TAG = "react-native-maps-google";
const BROKEN_SWIFT_LIBRARY_SEARCH_PATH =
  'LIBRARY_SEARCH_PATHS = "$(SDKROOT)/usr/lib/swift\\"$(inherited)\\"";';
const FIXED_SWIFT_LIBRARY_SEARCH_PATH = [
  "LIBRARY_SEARCH_PATHS = (",
  '\t\t\t\t\t"$(SDKROOT)/usr/lib/swift",',
  '\t\t\t\t\t"$(inherited)",',
  "\t\t\t\t);",
].join("\n");

type AndroidActivityAlias = {
  $: Record<string, string>;
  "intent-filter"?: unknown[];
};

type AndroidIntentFilter = {
  $?: Record<string, string>;
  action?: { $: Record<string, string> }[];
  category?: { $: Record<string, string> }[];
  data?: { $: Record<string, string> }[];
};

const stripLegacyMapsConfig = <
  T extends ExpoConfig["ios"] | ExpoConfig["android"]
>(
  config?: T
) => {
  if (!config?.config) {
    return config;
  }

  const { googleMapsApiKey, googleMaps, ...rest } = config.config as Record<
    string,
    unknown
  >;

  if (!googleMapsApiKey && !googleMaps) {
    return config;
  }

  return {
    ...config,
    config: Object.keys(rest).length > 0 ? rest : undefined,
  } as T;
};

const addGoogleMapsAppDelegateImport = (src: string) =>
  mergeContents({
    tag: MAPS_IMPORT_TAG,
    src,
    newSrc: ["#if canImport(GoogleMaps)", "import GoogleMaps", "#endif"].join("\n"),
    anchor: /@main/,
    offset: 0,
    comment: "//",
  });

const removeGoogleMapsAppDelegateImport = (src: string) =>
  removeContents({
    tag: MAPS_IMPORT_TAG,
    src,
  });

const addGoogleMapsAppDelegateInit = (src: string, apiKey: string) =>
  mergeContents({
    tag: MAPS_INIT_TAG,
    src,
    newSrc: [
      "#if canImport(GoogleMaps)",
      `GMSServices.provideAPIKey("${apiKey}")`,
      "#endif",
    ].join("\n"),
    anchor: APP_DELEGATE_RETURN,
    offset: 0,
    comment: "//",
  });

const removeGoogleMapsAppDelegateInit = (src: string) =>
  removeContents({
    tag: MAPS_INIT_TAG,
    src,
  });

const addGoogleMapsPod = (src: string) =>
  mergeContents({
    tag: MAPS_PODFILE_TAG,
    src,
    newSrc: [
      '  rn_maps_path = File.dirname(`node --print "require.resolve(\'react-native-maps/package.json\')"`)',
      "  pod 'react-native-maps/Google', :path => rn_maps_path",
    ].join("\n"),
    anchor: PODFILE_ANCHOR,
    offset: 0,
    comment: "#",
  });

const removeGoogleMapsPod = (src: string) =>
  removeContents({
    tag: MAPS_PODFILE_TAG,
    src,
  });

const withGoogleMapsNativeConfig = (config: ExpoConfig, apiKey?: string) => {
  config = withInfoPlist(config, (currentConfig) => {
    if (!apiKey) {
      delete currentConfig.modResults.GMSApiKey;
      return currentConfig;
    }

    currentConfig.modResults.GMSApiKey = apiKey;
    return currentConfig;
  });

  config = withPodfile(config, (currentConfig) => {
    const results = apiKey
      ? addGoogleMapsPod(currentConfig.modResults.contents)
      : removeGoogleMapsPod(currentConfig.modResults.contents);

    if (results.didMerge || results.didClear) {
      currentConfig.modResults.contents = results.contents;
    }

    return currentConfig;
  });

  config = withAppDelegate(config, (currentConfig) => {
    if (!apiKey) {
      currentConfig.modResults.contents = removeGoogleMapsAppDelegateImport(
        currentConfig.modResults.contents
      ).contents;
      currentConfig.modResults.contents = removeGoogleMapsAppDelegateInit(
        currentConfig.modResults.contents
      ).contents;
      return currentConfig;
    }

    if (currentConfig.modResults.language !== "swift") {
      throw new Error(
        `Cannot setup Google Maps because the project AppDelegate is not a supported language: ${currentConfig.modResults.language}`
      );
    }

    currentConfig.modResults.contents = addGoogleMapsAppDelegateImport(
      currentConfig.modResults.contents
    ).contents;
    currentConfig.modResults.contents = addGoogleMapsAppDelegateInit(
      currentConfig.modResults.contents,
      apiKey
    ).contents;

    return currentConfig;
  });

  config = withAndroidManifest(config, (currentConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      currentConfig.modResults
    );

    if (apiKey) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        "com.google.android.geo.API_KEY",
        apiKey
      );
    } else {
      AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(
        mainApplication,
        "com.google.android.geo.API_KEY"
      );
    }

    return currentConfig;
  });

  return config;
};

const withLocationUsageDescriptions = (config: ExpoConfig) =>
  withInfoPlist(config, (currentConfig) => {
    currentConfig.modResults.NSLocationWhenInUseUsageDescription =
      LOCATION_USAGE_DESCRIPTION;
    currentConfig.modResults.NSLocationAlwaysAndWhenInUseUsageDescription =
      LOCATION_USAGE_DESCRIPTION;
    currentConfig.modResults.NSLocationAlwaysUsageDescription =
      LOCATION_USAGE_DESCRIPTION;

    return currentConfig;
  });

const getSchemeIntentFilter = (schemes: string[]): AndroidIntentFilter => ({
  action: [
    {
      $: {
        "android:name": "android.intent.action.VIEW",
      },
    },
  ],
  category: [
    {
      $: {
        "android:name": "android.intent.category.DEFAULT",
      },
    },
    {
      $: {
        "android:name": "android.intent.category.BROWSABLE",
      },
    },
  ],
  data: schemes.map((scheme) => ({
    $: {
      "android:scheme": scheme,
    },
  })),
});

const getIntentFilterSchemes = (filter: unknown) => {
  const data = (filter as AndroidIntentFilter | undefined)?.data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((entry) => entry.$?.["android:scheme"])
    .filter((scheme): scheme is string => Boolean(scheme));
};

const getIntentFilterActions = (filter: unknown) => {
  const actions = (filter as AndroidIntentFilter | undefined)?.action;

  if (!Array.isArray(actions)) {
    return [];
  }

  return actions
    .map((entry) => entry.$?.["android:name"])
    .filter((action): action is string => Boolean(action));
};

const getIntentFilterCategories = (filter: unknown) => {
  const categories = (filter as AndroidIntentFilter | undefined)?.category;

  if (!Array.isArray(categories)) {
    return [];
  }

  return categories
    .map((entry) => entry.$?.["android:name"])
    .filter((category): category is string => Boolean(category));
};

const hasLauncherIntentFilter = (alias: AndroidActivityAlias) =>
  (alias["intent-filter"] ?? []).some((filter) => {
    const actions = getIntentFilterActions(filter);
    const categories = getIntentFilterCategories(filter);

    return (
      actions.includes("android.intent.action.MAIN") &&
      categories.includes("android.intent.category.LAUNCHER")
    );
  });

const withMainActivityAliasSchemeIntentFilters = (config: ExpoConfig) =>
  withAndroidManifest(config, (currentConfig) => {
    const schemes = [config.scheme, config.slug ? `exp+${config.slug}` : undefined]
      .flat()
      .filter((scheme): scheme is string => Boolean(scheme));

    if (schemes.length === 0) {
      return currentConfig;
    }

    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      currentConfig.modResults
    ) as Record<string, unknown> & {
      "activity-alias"?: AndroidActivityAlias[];
    };
    const aliases = mainApplication["activity-alias"] ?? [];
    const schemeIntentFilter = getSchemeIntentFilter(schemes);

    aliases.forEach((alias) => {
      if (
        alias.$["android:targetActivity"] !== ".MainActivity" ||
        !hasLauncherIntentFilter(alias)
      ) {
        return;
      }

      const intentFilters = alias["intent-filter"] ?? [];
      const hasSchemeFilter = intentFilters.some((filter) => {
        const filterSchemes = getIntentFilterSchemes(filter);

        return schemes.every((scheme) => filterSchemes.includes(scheme));
      });

      if (!hasSchemeFilter) {
        alias["intent-filter"] = [...intentFilters, schemeIntentFilter];
      }
    });

    return currentConfig;
  });

const withNormalizedSwiftLibrarySearchPaths = (config: ExpoConfig) =>
  withDangerousMod(config, [
    "ios",
    async (currentConfig) => {
      const { platformProjectRoot } = currentConfig.modRequest;
      const entries = await readdir(platformProjectRoot, { withFileTypes: true });
      const xcodeProject = entries.find(
        (entry) => entry.isDirectory() && entry.name.endsWith(".xcodeproj")
      );

      if (!xcodeProject) {
        throw new Error(`Could not find an .xcodeproj in ${platformProjectRoot}`);
      }

      const projectPath = resolve(
        platformProjectRoot,
        xcodeProject.name,
        "project.pbxproj"
      );
      const contents = await readFile(projectPath, "utf8");

      if (!contents.includes(BROKEN_SWIFT_LIBRARY_SEARCH_PATH)) {
        return currentConfig;
      }

      await writeFile(
        projectPath,
        contents.split(BROKEN_SWIFT_LIBRARY_SEARCH_PATH).join(FIXED_SWIFT_LIBRARY_SEARCH_PATH),
        "utf8"
      );

      return currentConfig;
    },
  ]);

export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = (config.extra ?? {}) as Record<string, unknown>;
  const privyAppId =
    normalizeEnvValue(
      process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID
    ) ?? normalizeExtraValue(extra.privyAppId);
  const privyClientId =
    normalizeEnvValue(process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID) ??
    normalizeExtraValue(extra.privyClientId);
  const privyKeyQuorumId =
    normalizeEnvValue(
      process.env.EXPO_PUBLIC_PRIVY_KEY_QUORUM_ID ??
        process.env.PRIVY_KEY_QUORUM_ID
    ) ?? normalizeExtraValue(extra.privyKeyQuorumId);
  const privyGasSponsorPolicyIds =
    normalizeEnvValue(
      process.env.EXPO_PUBLIC_PRIVY_GAS_SPONSOR_POLICY_IDS ??
        process.env.PRIVY_GAS_SPONSOR_POLICY_IDS
    ) ?? normalizeExtraValue(extra.privyGasSponsorPolicyIds);
  const passkeyAssociatedDomain =
    normalizeEnvValue(
      process.env.EXPO_PUBLIC_PASSKEY_ASSOCIATED_DOMAIN ??
        process.env.PASSKEY_ASSOCIATED_DOMAIN
    ) ?? normalizeExtraValue(extra.passkeyAssociatedDomain);
  const privyExportPageUrl =
    normalizeEnvValue(
      process.env.EXPO_PUBLIC_PRIVY_EXPORT_PAGE_URL ??
        process.env.PRIVY_EXPORT_PAGE_URL
    ) ?? normalizeExtraValue(extra.privyExportPageUrl);
  const privyExportClientId =
    normalizeEnvValue(
      process.env.EXPO_PUBLIC_PRIVY_EXPORT_CLIENT_ID ??
        process.env.PRIVY_EXPORT_CLIENT_ID
    ) ?? normalizeExtraValue(extra.privyExportClientId);
  const crispWebsiteId =
    normalizeEnvValue(process.env.EXPO_PUBLIC_CRISP_WEBSITE_ID) ??
    normalizeExtraValue(extra.crispWebsiteId);

  if (!googleMapsApiKey) {
    console.warn(
      "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Google Maps will fail to load."
    );
  } else if (!isValidGoogleApiKey(googleMapsApiKey)) {
    console.warn(
      "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY does not look valid (expected a key starting with AIza...)."
    );
  }

  const hasValidGoogleMapsApiKey = isValidGoogleApiKey(googleMapsApiKey);
  const plugins = [...(config.plugins ?? [])].filter((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    return pluginName !== "react-native-maps" && pluginName !== "crisp-sdk-react-native";
  });
  const hasExpoAudioPlugin = plugins.some((plugin) =>
    Array.isArray(plugin) ? plugin[0] === "expo-audio" : plugin === "expo-audio"
  );
  const hasExpoLocationPlugin = plugins.some((plugin) =>
    Array.isArray(plugin) ? plugin[0] === "expo-location" : plugin === "expo-location"
  );
  if (!hasExpoAudioPlugin) {
    plugins.push("expo-audio");
  }
  if (!hasExpoLocationPlugin) {
    plugins.push([
      "expo-location",
      {
        locationWhenInUsePermission: LOCATION_USAGE_DESCRIPTION,
      },
    ]);
  }
  if (crispWebsiteId) {
    plugins.push([
      "crisp-sdk-react-native",
      {
        websiteId: crispWebsiteId,
        notifications: { enabled: false },
      },
    ]);
  } else {
    console.warn(
      "EXPO_PUBLIC_CRISP_WEBSITE_ID is not set. Crisp push notifications plugin is disabled."
    );
  }
  const nextConfig: ExpoConfig = {
    ...config,
    plugins,
    extra: {
      ...extra,
      ...(apiUrl ? { apiUrl } : {}),
      ...(privyAppId ? { privyAppId } : {}),
      ...(privyClientId ? { privyClientId } : {}),
      ...(privyKeyQuorumId ? { privyKeyQuorumId } : {}),
      ...(privyGasSponsorPolicyIds ? { privyGasSponsorPolicyIds } : {}),
      ...(passkeyAssociatedDomain ? { passkeyAssociatedDomain } : {}),
      ...(privyExportPageUrl ? { privyExportPageUrl } : {}),
      ...(privyExportClientId ? { privyExportClientId } : {}),
      ...(crispWebsiteId ? { crispWebsiteId } : {}),
    },
    ios: stripLegacyMapsConfig(config.ios),
    android: stripLegacyMapsConfig(config.android),
  };

  return withNormalizedSwiftLibrarySearchPaths(
    withLocationUsageDescriptions(
      withMainActivityAliasSchemeIntentFilters(
        withGoogleMapsNativeConfig(
          nextConfig,
          hasValidGoogleMapsApiKey ? googleMapsApiKey : undefined
        )
      )
    )
  );
};
