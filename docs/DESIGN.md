## Vibe
- Swiss Grid × Enterprise SaaS — tight typographic hierarchy, strict column alignment, crisp data tables; authority expressed through proportion and weight, not decoration

## Color
- Primary: #2563EB
- On Primary: #FFFFFF
- Accent: #D97706
- On Accent: #0F172A
- Background: #FAFAF9
- Foreground: #0F172A
- Muted: #F2F0EC
- Border: #E3E2DE
- Secondary: #3B82F6

## Typography
- Heading: HarmonyOS Sans (family: HarmonyOSSans, weight: Bold, url: https://resource-static.bj.bcebos.com/fonts-skill/HarmonyOSSans_Bold.ttf)
- Body: Be Vietnam Pro (family: BeVietnamPro, weight: Regular, url: https://resource-static.bj.bcebos.com/fonts-skill/BeVietnamPro_Regular.ttf)

## Visual Language
- Core visual signature: typographic weight contrast — ultra-bold KPI numerals anchored with small-caps labels; data hierarchy communicated entirely through size, weight, and spacing
- Material & depth: white cards with 1px border on off-white shell; subtle box-shadow (0 1px 3px rgba(0,0,0,0.08)) for card elevation; sidebar slightly darker than main canvas
- Containers & buttons: rounded-md cards with border; primary CTA filled bg-primary; secondary actions use Muted fill + Foreground text; status badges use traffic-light system (success/warning/destructive)
- Layout rhythm: sidebar fixed left, content scrolls; KPI row at top of each section; Primary accent on active nav item only; Accent amber for financial highlights and warnings

## Animation
- Entrance: page sections fade-in translateY(8px) → 0 over 200ms ease-out
- Interaction: button press scale(0.98) 100ms; row hover bg-muted transition 150ms

## Forbidden
- No large gradient backgrounds or hero banners
- No glassmorphism / frosted blur overlays
- No emoji in navigation, headings, or data cells

## Additional Notes
- Login page: split-screen — left panel solid Primary with logo + tagline, right panel white with PIN input form
- Uzbek language UI: all labels, headings, table headers in Uzbek
- Sidebar collapsed state (icon-only) on mobile via Sheet
