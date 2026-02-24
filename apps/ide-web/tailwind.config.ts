import type { Config } from "tailwindcss";

export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                scifi: ["Orbitron", "ui-sans-serif", "system-ui"],
                tech: ["Rajdhani", "ui-sans-serif", "system-ui"],
            },
            colors: {
                bgDeep: "var(--bg-deep)",
                neonCyan: "var(--neon-cyan)",
                neonGold: "var(--neon-gold)",
                neonGreen: "var(--neon-green)",
                glassBg: "var(--glass-bg)",
                glassBorder: "var(--glass-border)",
            },
        },
    },
    plugins: [],
} satisfies Config;
