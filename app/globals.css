@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: #0b0b0b;
  --foreground: #f5f5f5;
  --card: #111111;
  --card-foreground: #ffffff;
  --popover: #111111;
  --popover-foreground: #f5f5f5;
  --primary: #60a5fa;
  --primary-foreground: #08111f;
  --secondary: #1f2937;
  --secondary-foreground: #f5f5f5;
  --muted: #1f2937;
  --muted-foreground: #cbd5e1;
  --accent: #818cf8;
  --accent-foreground: #f5f5f5;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: rgba(255,255,255,0.12);
  --input: #1f2937;
  --ring: #60a5fa;
  --radius: 0.625rem;
  --sidebar: #111111;
  --sidebar-foreground: #f5f5f5;
  --sidebar-primary: #60a5fa;
  --sidebar-primary-foreground: #08111f;
  --sidebar-accent: #1f2937;
  --sidebar-accent-foreground: #f5f5f5;
  --sidebar-border: rgba(255,255,255,0.12);
  --sidebar-ring: #60a5fa;
}

@theme inline {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  body {
    @apply bg-background text-foreground;
  }
}

html {
  scroll-behavior: smooth;
}

.tulleys-exact-page {
  font-family: "Oswald", Arial, sans-serif;
}

.tulleys-exact-page h1,
.tulleys-exact-page h2,
.tulleys-exact-page h3,
.tulleys-exact-page h4,
.tulleys-exact-page .tulleys-bebas {
  font-family: "Bebas Neue", Impact, sans-serif;
}


.tulleys-start-talking-btn {
  position: relative;
  overflow: visible;
  border-radius: 18px !important;
  animation: tulleysButtonPulse 1.9s ease-in-out infinite;
}

.tulleys-start-talking-btn::before,
.tulleys-start-talking-btn::after {
  content: "";
  position: absolute;
  inset: -8px;
  border-radius: 24px;
  border: 2px solid rgba(255, 226, 178, 0.35);
  pointer-events: none;
  opacity: 0;
}

.tulleys-start-talking-btn::before {
  animation: tulleysSignalRing 2.2s ease-out infinite;
}

.tulleys-start-talking-btn::after {
  animation: tulleysSignalRing 2.2s ease-out infinite 1.1s;
}

@keyframes tulleysButtonPulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 18px 35px rgba(31,17,10,0.35), 0 0 0 rgba(255, 214, 150, 0);
  }
  50% {
    transform: scale(1.035);
    box-shadow: 0 24px 44px rgba(31,17,10,0.42), 0 0 28px rgba(255, 214, 150, 0.28);
  }
}

@keyframes tulleysSignalRing {
  0% {
    opacity: 0.55;
    transform: scale(0.96);
  }
  70% {
    opacity: 0.12;
    transform: scale(1.08);
  }
  100% {
    opacity: 0;
    transform: scale(1.14);
  }
}


@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}


.shorefield-theme {
  font-family: Arial, Helvetica, sans-serif;
}

.shorefield-serif,
.shorefield-display {
  font-family: Georgia, "Times New Roman", serif;
}

.shorefield-script {
  font-family: "Brush Script MT", "Segoe Script", cursive;
}


.shorefield-george-cta,
.shorefield-george-mini {
  position: relative;
  overflow: visible;
}

.shorefield-george-cta:hover,
.shorefield-george-mini:hover {
  transform: translateY(-2px) scale(1.01);
}

.shorefield-george-cta::before,
.shorefield-george-mini::before {
  content: "";
  position: absolute;
  inset: -8px;
  border-radius: 999px;
  border: 2px solid rgba(245,191,34,0.24);
  opacity: 0;
  animation: shorefieldSignalRing 2.4s ease-out infinite;
  pointer-events: none;
}

.animate-shorefield-fade-up {
  animation: shorefieldFadeUp 700ms ease both;
}

@keyframes shorefieldFadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes shorefieldSignalRing {
  0% { opacity: 0.55; transform: scale(0.98); }
  70% { opacity: 0.1; transform: scale(1.05); }
  100% { opacity: 0; transform: scale(1.09); }
}
