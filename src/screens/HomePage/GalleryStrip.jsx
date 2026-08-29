import React, { useEffect, useState } from "react";

// Looks for /gallery/1.jpg, 2.png, ... in the public folder (jpg/jpeg/png/webp,
// numbered 1-12). Only files that actually load are shown, so this renders
// nothing (not broken-image icons) until photos are dropped into public/gallery/.
const CANDIDATE_COUNT = 12;
const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

const GalleryStrip = () => {
  const [images, setImages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const foundByIndex = {};
    let pending = CANDIDATE_COUNT * EXTENSIONS.length;

    const finish = () => {
      pending -= 1;
      if (pending === 0 && !cancelled) {
        const ordered = Array.from({ length: CANDIDATE_COUNT }, (_, i) => foundByIndex[i + 1]).filter(Boolean);
        setImages(ordered);
      }
    };

    for (let i = 1; i <= CANDIDATE_COUNT; i++) {
      EXTENSIONS.forEach((ext) => {
        const src = `/gallery/${i}.${ext}`;
        const img = new Image();
        img.onload = () => {
          if (!foundByIndex[i]) foundByIndex[i] = src;
          finish();
        };
        img.onerror = finish;
        img.src = src;
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  if (images.length === 0) return null;

  return (
    <div className="interface-box">
      <p className="is-size-7 has-text-grey is-uppercase mb-3">Inside ADOX</p>
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
        {images.map((src) => (
          <img
            key={src}
            src={src}
            alt="Inside ADOX"
            style={{
              height: "110px",
              width: "150px",
              objectFit: "cover",
              borderRadius: "14px",
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default GalleryStrip;
