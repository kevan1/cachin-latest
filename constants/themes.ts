
export const THEMES = [
  {
    id: 'blue',
    name: 'Personal',
    currency: 'EUR',
    category: 'glow',
    colors: {
      light: {
        primary: [
          "#00C2FF", "#2D5BFF", "#7C3AED",
          "#7C3AED", "#00C2FF", "#2D5BFF",
          "#2D5BFF", "#7C3AED", "#00C2FF",
        ],
        secondary: [
          "#2D5BFF", "#7C3AED", "#00C2FF",
          "#00C2FF", "#2D5BFF", "#7C3AED",
          "#7C3AED", "#00C2FF", "#2D5BFF",
        ],
        background: "#FFFFFF",
      },
      dark: {
        primary: [
          "#00A7E6", "#1E40AF", "#6D28D9",
          "#6D28D9", "#00A7E6", "#1E40AF",
          "#1E40AF", "#6D28D9", "#00A7E6",
        ],
        secondary: [
          "#1E40AF", "#6D28D9", "#00A7E6",
          "#00A7E6", "#1E40AF", "#6D28D9",
          "#6D28D9", "#00A7E6", "#1E40AF",
        ],
        background: "#05060A",
      }
    }
  },
  {
    id: 'orange',
    name: 'Flexible',
    currency: 'USD',
    category: 'glow',
    colors: {
      light: {
        primary: [
          "#FF4D4D", "#F9CB28", "#FF4D4D",
          "#F9CB28", "#FF4D4D", "#F9CB28",
          "#FF4D4D", "#F9CB28", "#FF4D4D",
        ],
        secondary: [
          "#F9CB28", "#FF4D4D", "#F9CB28",
          "#FF4D4D", "#F9CB28", "#FF4D4D",
          "#F9CB28", "#FF4D4D", "#F9CB28",
        ],
        background: "#FFFFFF",
      },
      dark: {
        primary: [
          "#B91C1C", "#D97706", "#B91C1C",
          "#D97706", "#B91C1C", "#D97706",
          "#B91C1C", "#D97706", "#B91C1C",
        ],
        secondary: [
          "#D97706", "#B91C1C", "#D97706",
          "#B91C1C", "#D97706", "#B91C1C",
          "#D97706", "#B91C1C", "#D97706",
        ],
        background: "#05060A",
      }
    }
  },
  {
    id: 'green',
    name: 'Business',
    currency: 'GBP',
    category: 'glow',
    colors: {
      light: {
        primary: [
          "#10B981", "#3B82F6", "#10B981",
          "#3B82F6", "#10B981", "#3B82F6",
          "#10B981", "#3B82F6", "#10B981",
        ],
        secondary: [
          "#3B82F6", "#10B981", "#3B82F6",
          "#10B981", "#3B82F6", "#10B981",
          "#3B82F6", "#10B981", "#3B82F6",
        ],
        background: "#FFFFFF",
      },
      dark: {
        primary: [
          "#047857", "#1D4ED8", "#047857",
          "#1D4ED8", "#047857", "#1D4ED8",
          "#047857", "#1D4ED8", "#047857",
        ],
        secondary: [
          "#1D4ED8", "#047857", "#1D4ED8",
          "#047857", "#1D4ED8", "#047857",
          "#1D4ED8", "#047857", "#1D4ED8",
        ],
        background: "#05060A",
      }
    }
  },
  {
    id: 'monad',
    name: 'Monad',
    currency: 'MON',
    category: 'glow',
    colors: {
      light: {
        primary: [
          "#B949FF", "#8B4DFF", "#2A1140",
          "#D06DFF", "#A855F7", "#35125C",
          "#7C3AED", "#C084FC", "#000000",
        ],
        secondary: [
          "#5B21B6", "#A855F7", "#140A24",
          "#9333EA", "#C084FC", "#24123F",
          "#6D28D9", "#B794F4", "#05030B",
        ],
        background: "#05030B",
      },
      dark: {
        primary: [
          "#A833F3", "#7C3AED", "#180A2A",
          "#B653F6", "#9333EA", "#26113E",
          "#6D28D9", "#A855F7", "#000000",
        ],
        secondary: [
          "#4C1D95", "#7E22CE", "#10071C",
          "#6D28D9", "#A855F7", "#1D0E32",
          "#5B21B6", "#9333EA", "#030208",
        ],
        background: "#000000",
      }
    }
  },
  {
    id: 'mono',
    name: 'Minimal',
    currency: 'USD',
    category: 'mono',
    colors: {
      light: {
        primary: [
          "#E5E5E5", "#F5F5F5", "#FFFFFF",
          "#F5F5F5", "#E5E5E5", "#F5F5F5",
          "#FFFFFF", "#F5F5F5", "#E5E5E5",
        ],
        secondary: [
          "#F5F5F5", "#FFFFFF", "#E5E5E5",
          "#E5E5E5", "#F5F5F5", "#FFFFFF",
          "#FFFFFF", "#E5E5E5", "#F5F5F5",
        ],
        background: "#FFFFFF",
      },
      dark: {
        primary: [
          "#111111", "#222222", "#000000",
          "#222222", "#111111", "#222222",
          "#000000", "#222222", "#111111",
        ],
        secondary: [
          "#222222", "#000000", "#111111",
          "#111111", "#222222", "#000000",
          "#000000", "#111111", "#222222",
        ],
        background: "#000000",
      }
    }
  }
];

export const MESH_POINTS = [
  [0.0, 0.0],
  [0.4, 0.0],
  [1.0, 0.0],
  [0.0, 0.45],
  [0.5, 0.7],
  [1.0, 0.35],
  [0.0, 1.0],
  [0.55, 1.0],
  [1.0, 1.0],
];

export type ThemeTabColors = {
  active: string;
  inactive: string;
  indicator: string;
  activePill: string;
};

const THEME_TAB_COLORS: Record<string, ThemeTabColors> = {
  blue: {
    active: "#5C5AF6",
    inactive: "rgba(13,32,45,0.72)",
    indicator: "rgba(92,90,246,0.18)",
    activePill: "rgba(92,90,246,0.22)",
  },
  orange: {
    active: "#F97316",
    inactive: "rgba(89,57,26,0.72)",
    indicator: "rgba(249,115,22,0.2)",
    activePill: "rgba(249,115,22,0.2)",
  },
  green: {
    active: "#10B981",
    inactive: "rgba(16,74,63,0.72)",
    indicator: "rgba(16,185,129,0.2)",
    activePill: "rgba(16,185,129,0.2)",
  },
  monad: {
    active: "#A855F7",
    inactive: "rgba(71,31,109,0.74)",
    indicator: "rgba(168,85,247,0.22)",
    activePill: "rgba(168,85,247,0.22)",
  },
  mono: {
    active: "#374151",
    inactive: "rgba(55,65,81,0.7)",
    indicator: "rgba(55,65,81,0.16)",
    activePill: "rgba(55,65,81,0.16)",
  },
};

export function getThemeTabColors(themeId: string): ThemeTabColors {
  return THEME_TAB_COLORS[themeId] ?? THEME_TAB_COLORS.blue;
}
