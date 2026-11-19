/** Illustrated stand-ins until venues upload real photos. */
const BY_CATEGORY: Record<string, string> = {
  "Music & variety": "stage",
  "Dinner shows": "stage",
  "Comedy & magic": "stage",
  "Faith & family": "stage",
  "Theme parks": "park",
  "On the lake": "lake",
  "Family fun": "karts",
  Museums: "museum",
  "Outdoor adventure": "outdoor",
};

export function artFor(category: string, name = "") {
  const n = name.toLowerCase();
  if (/golf|putt/.test(n)) return "/art/golf.svg";
  if (/kart|race/.test(n)) return "/art/karts.svg";
  if (/cruise|boat|lake/.test(n)) return "/art/lake.svg";
  return `/art/${BY_CATEGORY[category] ?? "stage"}.svg`;
}
