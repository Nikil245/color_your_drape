---
name: Heritage Boutique System
colors:
  surface: '#fff8f6'
  surface-dim: '#ead6cd'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1eb'
  surface-container: '#ffeae0'
  surface-container-high: '#f9e4db'
  surface-container-highest: '#f3ded5'
  on-surface: '#241914'
  on-surface-variant: '#584045'
  inverse-surface: '#3a2e28'
  inverse-on-surface: '#ffede5'
  outline: '#8c7075'
  outline-variant: '#e0bec4'
  surface-tint: '#b51a57'
  primary: '#8c003f'
  on-primary: '#ffffff'
  primary-container: '#b21755'
  on-primary-container: '#ffc7d2'
  inverse-primary: '#ffb1c2'
  secondary: '#755b00'
  on-secondary: '#ffffff'
  secondary-container: '#fed255'
  on-secondary-container: '#735a00'
  tertiary: '#004e42'
  on-tertiary: '#ffffff'
  tertiary-container: '#006859'
  on-tertiary-container: '#8de5d1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd9e0'
  primary-fixed-dim: '#ffb1c2'
  on-primary-fixed: '#3f0018'
  on-primary-fixed-variant: '#8f0040'
  secondary-fixed: '#ffe08e'
  secondary-fixed-dim: '#ecc246'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#9af3df'
  tertiary-fixed-dim: '#7ed6c3'
  on-tertiary-fixed: '#00201b'
  on-tertiary-fixed-variant: '#005045'
  background: '#fff8f6'
  on-background: '#241914'
  surface-variant: '#f3ded5'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style

The design system is centered on the concept of "Artisanal Luxury." It targets a discerning audience looking for the tactile beauty of handloom sarees within a modern, seamless digital boutique experience. The personality is warm, elegant, and deeply rooted in heritage, yet polished enough for a premium e-commerce environment.

The visual style is a blend of **Modern Minimalism** and **Tactile Elegance**. It utilizes a sophisticated warm ivory backdrop to mimic high-quality paper or fine silk, avoiding the clinical coldness of pure white. Transitions should be fluid and graceful, evoking the drape of the fabric itself. 

Emotional Response:
- **Trust:** Established through sturdy, classical typography.
- **Warmth:** Evoked by the cream and gold palette.
- **Aspiration:** Driven by high-contrast accents and generous whitespace.

## Colors

The palette is inspired by traditional Indian pigments. 

- **Primary Accent (#B21755):** A deep magenta-rose used for primary calls to action, active navigation states, and critical highlights. It provides high energy against the neutral base.
- **Secondary Accent (#C9A227):** A muted gold used for decorative borders, iconography, and subtle price indicators. It adds the "boutique" premium feel.
- **Supporting Palette:** Teal, Burnt Orange, and Plum are reserved for data visualization (KPI charts) and category tagging to ensure variety without breaking the brand's sophisticated tone.
- **Neutral (#3A2E28):** A deep charcoal-brown replaces pure black for all text to maintain warmth and readability against the ivory background.

## Typography

This design system uses a high-contrast typographic pairing to balance tradition and modernity.

- **Headlines:** *Playfair Display* is used for all headings. Its high-contrast serifs and elegant curves reflect the craftsmanship of the sarees. Use tighter letter-spacing for large display titles.
- **Body & Labels:** *Plus Jakarta Sans* provides a clean, contemporary counterpoint. Its soft, rounded terminals echo the approachable nature of the boutique while ensuring maximum legibility for product descriptions and tabular data.
- **Scale:** On mobile devices, display sizes should scale down significantly to ensure elegant wrapping and prevent awkward word breaks in long product names.

## Layout & Spacing

The design system utilizes a **Fluid Grid** with fixed maximum widths for desktop to preserve the editorial feel of the boutique.

- **Grid:** A 12-column grid on desktop, 8-column on tablet, and 4-column on mobile.
- **Rhythm:** An 8px linear scale governs all padding and margins. 
- **Forms:** Support both single-column (mobile/focused tasks) and double-column (desktop/detailed ordering) layouts.
- **Responsive Behavior:** Tables are designed to be "Reflowable." On mobile viewports, table rows transform into individual cards with labeled data points to maintain the premium aesthetic without sacrificing functionality.

## Elevation & Depth

Depth is achieved through **Ambient Shadows** and **Tonal Layering**. 

- **Surface 0:** The main background (#F5EFDC) is the lowest layer.
- **Surface 1 (Cards):** Elevated via a very soft, diffused shadow (0px 4px 20px rgba(58, 46, 40, 0.08)). These surfaces use the #FFFDF8 "Off-White" color to subtly pop from the background.
- **Interactive States:** Buttons and clickable cards gain a slightly more pronounced shadow upon hover to simulate a tactile "lift."
- **Accents:** The Gold (#C9A227) is used as a 1px border for containers that require structural definition without the weight of a shadow.

## Shapes

The shape language is "Soft-Modern." All primary containers, including product cards and KPI blocks, utilize a 12px - 16px corner radius. This avoids the harshness of sharp corners, aligning with the organic curves of draped fabric. 

- **Buttons:** Medium rounded corners (8px) for a sturdy yet approachable feel.
- **Input Fields:** 8px roundedness to match buttons.
- **KPI Cards:** 16px roundedness to emphasize them as distinct, high-value data points.

## Components

- **Buttons:** Primary buttons use the #B21755 background with white text. Secondary buttons use a #C9A227 1px border with #3A2E28 text.
- **KPI Cards:** High-contrast blocks using the supporting palette (Teal, Orange, Plum) as subtle top-border accents. The value is set in Playfair Display for emphasis.
- **Tables-to-Cards:** On mobile, tables lose their headers; each row becomes a #FFFDF8 card with the Gold border (#C9A227) on the left side to denote a list item.
- **Input Fields:** Use a subtle ivory fill with a 1px border in a muted version of the Neutral color. Active states transition the border to Primary Magenta.
- **Chips/Badges:** Small, 4px rounded tags using low-opacity versions of the tertiary colors for "In Stock" (Teal) or "Limited Edition" (Plum).