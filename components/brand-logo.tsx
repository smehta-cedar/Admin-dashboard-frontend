import Image from "next/image";
import logoFull from "@/assests/logo-fullcolor.jpg";
import logoFullOnDark from "@/assests/logo-fullColorTransparent.png";
import logoMark from "@/assests/logo.png";

/**
 * Cedar Grove wordmark, or just the pinecone mark with `compact`. Rendered at
 * a fixed height; the width follows the asset's aspect ratio so next/image
 * serves a right-sized file instead of the multi-thousand-pixel source.
 *
 * The wordmark is dark-on-white, so dark mode swaps in the white knockout
 * asset. Both are rendered and one is hidden by CSS: picking in JS would need
 * the resolved theme, which is not known until after hydration, and the logo
 * would flash. The mark is already transparent and works on either.
 */
export function BrandLogo({ compact = false, height = 28 }: { compact?: boolean; height?: number }) {
  const alt = "Cedar Grove Senior Health Solutions";

  if (compact) {
    const width = Math.round((logoMark.width / logoMark.height) * height);
    return (
      <Image src={logoMark} alt={alt} width={width} height={height} loading="eager" className="block shrink-0" />
    );
  }

  // Each variant keeps its own aspect ratio; the two crops are not identical.
  const scale = (asset: typeof logoFull) => Math.round((asset.width / asset.height) * height);

  return (
    <>
      {/* `display: none` takes the hidden one out of the accessibility tree,
          so both carrying the real alt names the logo exactly once. */}
      <Image
        src={logoFull}
        alt={alt}
        width={scale(logoFull)}
        height={height}
        loading="eager"
        // The JPG has a white background; multiply lets tinted surfaces show through.
        className="block shrink-0 mix-blend-multiply dark:hidden"
      />
      <Image
        src={logoFullOnDark}
        alt={alt}
        width={scale(logoFullOnDark)}
        height={height}
        loading="eager"
        className="hidden shrink-0 dark:block"
      />
    </>
  );
}
