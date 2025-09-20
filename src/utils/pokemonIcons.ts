import { DEFAULT_GYM_IMAGE } from "./gymImages";

/**
 * Generates Pokemon sprite URL using wwm-uicons format
 */
export const getPokemonIconUrl = (pokemonId: number): string => {
  // Base URL for wwm-uicons repository
  const baseUrl =
    "https://raw.githubusercontent.com/WatWowMap/wwm-uicons/main/pokemon";

  // For wwm-uicons, it's just the pokemon ID
  // Forms are handled differently - typically separate Pokemon IDs are assigned for forms
  // For example, Alolan Raichu has its own ID rather than being 26_f61
  return `${baseUrl}/${pokemonId}.png`;
};

/**
 * Fallback function using PogoAssets format
 * Can be used as a backup if UIcons doesn't have the sprite
 */
export const getPogoAssetsIconUrl = (
  pokemonId: number,
  form?: number
): string => {
  const paddedId = pokemonId.toString().padStart(3, "0");
  const formSuffix = form && form > 0 ? form.toString().padStart(2, "0") : "00";
  return `https://raw.githubusercontent.com/ZeChrales/PogoAssets/master/pokemon_icons/pokemon_icon_${paddedId}_${formSuffix}.png`;
};

/**
 * Get Pokemon sprite with fallback support
 * Tries wwm-uicons first, then falls back to PogoAssets
 */
export const getPokemonSprite = (pokemonId: number): string => {
  // Use wwm-uicons as primary source
  return getPokemonIconUrl(pokemonId);
};

/**
 * Handle image loading errors by falling back to alternative sources
 */
export const handlePokemonImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  pokemonId: number,
  form?: number
) => {
  const img = e.currentTarget;
  const currentSrc = img.src;

  // If wwm-uicons failed, try PogoAssets
  if (currentSrc.includes("WatWowMap/wwm-uicons")) {
    img.src = getPogoAssetsIconUrl(pokemonId, form);
    return;
  }

  // Final fallback to placeholder
  if (!currentSrc.includes("PogoAssets")) {
    img.src = DEFAULT_GYM_IMAGE;
  }
};

// Note: In wwm-uicons, forms are often handled as separate Pokemon IDs
export const getFormPokemonId = (baseId: number, formId?: number): number => {
  if (!formId || formId === 0) return baseId;

  return baseId;
};
