"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeocoderAutocomplete } from "@geoapify/geocoder-autocomplete";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";
const TORONTO: [number, number] = [-79.3832, 43.6532];

export type GeoapifyPlace = {
  label: string;
  latitude: number;
  longitude: number;
};

type GeoapifyFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: { formatted?: string; address_line1?: string; address_line2?: string; lat?: number; lon?: number };
};

function featureToPlace(feature: GeoapifyFeature | null): GeoapifyPlace | null {
  if (!feature) return null;
  const longitude = Number(feature.properties?.lon ?? feature.geometry?.coordinates?.[0]);
  const latitude = Number(feature.properties?.lat ?? feature.geometry?.coordinates?.[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const label = feature.properties?.formatted
    ?? [feature.properties?.address_line1, feature.properties?.address_line2].filter(Boolean).join(", ");
  return { label, latitude, longitude };
}

function styleUrl() {
  return `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(GEOAPIFY_KEY)}`;
}

async function reverseGeocode(latitude: number, longitude: number): Promise<GeoapifyPlace> {
  if (!GEOAPIFY_KEY) return { label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude };
  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "geojson");
  url.searchParams.set("apiKey", GEOAPIFY_KEY);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to look up this map location.");
  const result = await response.json() as { features?: GeoapifyFeature[] };
  return featureToPlace(result.features?.[0] ?? null) ?? { label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude };
}

export function GeoapifyAutocompleteField({ value = "", placeholder, onSelect, className = "" }: {
  value?: string;
  placeholder: string;
  onSelect: (place: GeoapifyPlace) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<GeocoderAutocomplete | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !GEOAPIFY_KEY) return;
    let disposed = false;
    let instance: GeocoderAutocomplete | null = null;
    void import("@geoapify/geocoder-autocomplete").then(({ GeocoderAutocomplete }) => {
      if (disposed) return;
      instance = new GeocoderAutocomplete(container, GEOAPIFY_KEY, {
        placeholder,
        lang: "en",
        limit: 6,
        skipIcons: false,
        addDetails: true,
        filter: { countrycode: ["ca"] },
        bias: { proximity: { lon: TORONTO[0], lat: TORONTO[1] } },
      });
      instanceRef.current = instance;
      instance.on("select", (feature: GeoapifyFeature | null) => {
        const place = featureToPlace(feature);
        if (place) {
          onSelectRef.current(place);
          instance?.close();
        }
      });
    });
    return () => {
      disposed = true;
      instance?.off("select");
      instanceRef.current = null;
      container.replaceChildren();
    };
  }, [placeholder]);

  useEffect(() => {
    if (instanceRef.current && value && instanceRef.current.getValue() !== value) instanceRef.current.setValue(value);
  }, [value]);

  if (!GEOAPIFY_KEY) return <p className="geoapify-error">Geoapify is not configured.</p>;
  return <div className={`geoapify-autocomplete ${className}`} ref={containerRef} />;
}

export type MapListing = {
  id: string;
  title: string;
  latitude?: number | null;
  longitude?: number | null;
};

export function GeoapifyMarketplaceMap({ listings, selectedId, onSelect, focus }: {
  listings: MapListing[];
  selectedId?: string;
  onSelect: (id: string) => void;
  focus?: GeoapifyPlace | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !GEOAPIFY_KEY) return;
    let disposed = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl(),
        center: TORONTO,
        zoom: 10.8,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
      map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "bottom-left");
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      disposed = true;
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    const render = async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled) return;
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = listings.flatMap(listing => {
        const latitude = Number(listing.latitude);
        const longitude = Number(listing.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) return [];
        const element = document.createElement("button");
        element.type = "button";
        element.className = `booth-marker${listing.id === selectedId ? " selected" : ""}`;
        element.setAttribute("aria-label", `Preview ${listing.title}`);
        const markerImage = document.createElement("img");
        markerImage.src = "/artisto-map-marker.png";
        markerImage.alt = "";
        element.appendChild(markerImage);
        element.addEventListener("click", event => { event.stopPropagation(); onSelect(listing.id); });
        return [new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([longitude, latitude]).addTo(map)];
      });
    };
    void render();
    return () => { cancelled = true; };
  }, [listings, mapReady, onSelect, selectedId]);

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.longitude, focus.latitude], zoom: 14.5, essential: true });
  }, [focus]);

  return <div className="geoapify-map" ref={containerRef} aria-label="Marketplace map" />;
}

export function GeoapifyLocationPicker({ value, latitude, longitude, onChange }: {
  value: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (place: GeoapifyPlace) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const initialPositionRef = useRef({ latitude, longitude });
  const [lookupError, setLookupError] = useState("");
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const choosePoint = useCallback(async (lat: number, lon: number) => {
    try {
      setLookupError("");
      onChangeRef.current(await reverseGeocode(lat, lon));
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Unable to look up this location.");
      onChangeRef.current({ label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`, latitude: lat, longitude: lon });
    }
  }, []);

  const placeMarker = useCallback(async (lat: number, lon: number, shouldLookup: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const maplibregl = await import("maplibre-gl");
    markerRef.current?.remove();
    const element = document.createElement("div");
    element.className = "booth-marker seller-pin selected";
    const markerImage = document.createElement("img");
    markerImage.src = "/artisto-map-marker.png";
    markerImage.alt = "";
    element.appendChild(markerImage);
    const marker = new maplibregl.Marker({ element, anchor: "bottom", draggable: true }).setLngLat([lon, lat]).addTo(map);
    marker.on("dragend", () => {
      const point = marker.getLngLat();
      void choosePoint(point.lat, point.lng);
    });
    markerRef.current = marker;
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 14), essential: true });
    if (shouldLookup) await choosePoint(lat, lon);
  }, [choosePoint]);

  useEffect(() => {
    if (!containerRef.current || !GEOAPIFY_KEY) return;
    let disposed = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !containerRef.current) return;
      const initialPosition = initialPositionRef.current;
      const hasPosition = Number.isFinite(initialPosition.latitude) && Number.isFinite(initialPosition.longitude);
      const center: [number, number] = hasPosition ? [initialPosition.longitude as number, initialPosition.latitude as number] : TORONTO;
      const map = new maplibregl.Map({ container: containerRef.current, style: styleUrl(), center, zoom: hasPosition ? 14 : 10.5, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl(), "bottom-right");
      map.on("click", event => { void placeMarker(event.lngLat.lat, event.lngLat.lng, true); });
      mapRef.current = map;
      if (hasPosition) void placeMarker(initialPosition.latitude as number, initialPosition.longitude as number, false);
    });
    return () => {
      disposed = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [placeMarker]);

  const select = (place: GeoapifyPlace) => {
    onChange(place);
    void placeMarker(place.latitude, place.longitude, false);
  };

  return <div className="location-picker">
    <GeoapifyAutocompleteField value={value} placeholder="Start typing an address or neighbourhood" onSelect={select} className="seller-geocoder" />
    <div className="seller-map" ref={containerRef} aria-label="Choose the listing location on the map" />
    <small>Choose a Geoapify suggestion, click the map, or drag the marker.</small>
    {lookupError && <small className="geoapify-error">{lookupError}</small>}
  </div>;
}
