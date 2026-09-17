import Image from "next/image";
import logoFull from "@/assests/logo-fullcolor.jpg";
import logoMark from "@/assests/logo.png";

/**
 * Cedar Grove wordmark, or just the pinecone mark with `compact`. Rendered at
 * a fixed height; the width follows the asset's aspect ratio so next/image
 * serves a right-sized file instead of the multi-thousand-pixel source.
 */
export function BrandLogo({ compact = false, height = 28 }: { compact?: boolean; height?: number }) {
  const src = compact ? logoMark : logoFull;
  const width = Math.round((src.width / src.height) * height);

  return (
    <Image
      src={src}
      alt="Cedar Grove Senior Health Solutions"
      width={width}
      height={height}
      loading="eager"
      // The JPG has a white background; multiply lets tinted surfaces show through.
      className="block shrink-0 mix-blend-multiply"
    />
  );
}
