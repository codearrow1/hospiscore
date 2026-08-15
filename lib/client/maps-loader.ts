/**
 * Client-side Google Maps JS loader for the Places Autocomplete widget.
 *
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (a client-safe key restricted to
 * your app origin). If the key is absent, PropertySearch falls back to the
 * plain text search — nothing here throws in that case.
 */

/** Minimal typing for the parts of the Maps API we touch. */
export interface AutocompleteInstance {
  getPlace(): { place_id?: string; name?: string } | undefined;
}

interface PlaceAutocompleteCtor {
  new (
    input: HTMLInputElement,
    options: { types: string[]; fields: string[] },
  ): AutocompleteInstance;
}

interface GMapPlaces {
  Autocomplete?: PlaceAutocompleteCtor;
  event?: {
    addListener(target: unknown, event: string, handler: () => void): unknown;
    removeListener(handle: unknown): void;
  };
}

interface GMapWindow extends Window {
  google?: { maps?: { places?: GMapPlaces } };
}

let loadPromise: Promise<void> | null = null;

export async function loadMapsApi(key: string): Promise<void> {
  const w = window as GMapWindow;
  if (typeof window === "undefined" || w.google?.maps?.places) return;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places`;
    script.async = true;
    script.onload = () => {
      if (w.google?.maps?.places) {
        resolve();
      } else {
        loadPromise = null;
        reject(new Error("google.maps.places was not loaded"));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load the Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

/** Attach a Places Autocomplete to an input; returns a dispose function. */
export function attachAutocomplete(
  input: HTMLInputElement,
  onPlace: (placeId: string, name: string) => void,
): () => void {
  const w = window as GMapWindow;
  const places = w.google?.maps?.places;
  if (!places?.Autocomplete || !places.event) return () => {};

  const autocomplete = new places.Autocomplete(input, {
    types: ["lodging", "establishment"],
    fields: ["place_id", "name"],
  });

  const listener = places.event.addListener(autocomplete, "place_changed", () => {
    const place = autocomplete.getPlace();
    if (!place?.place_id) return;
    onPlace(place.place_id, place.name ?? input.value);
  });

  return () => places.event?.removeListener(listener);
}