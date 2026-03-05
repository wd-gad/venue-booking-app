"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from "react-leaflet";
import { Marker } from "react-leaflet";
import type { Venue } from "@/lib/types";

type VenueMapProps = {
  focusVenue?: Venue | null;
  focusZoom?: number;
  venues: Venue[];
};

const JAPAN_CENTER: [number, number] = [36.2048, 138.2529];
const DEFAULT_FOCUS_ZOOM = 8;
const focusMarkerIcon = L.divIcon({
  className: "map-focus-marker-shell",
  html: '<span class="map-focus-marker"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function VenueMap({ focusVenue, focusZoom = DEFAULT_FOCUS_ZOOM, venues }: VenueMapProps) {
  return (
    <MapContainer
      center={JAPAN_CENTER}
      zoom={5}
      scrollWheelZoom
      zoomControl={false}
      className="map"
    >
      <MapFocusController focusVenue={focusVenue} focusZoom={focusZoom} />
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {venues.map((venue) => (
        venue.id === focusVenue?.id ? (
          <Marker icon={focusMarkerIcon} key={venue.id} position={[venue.lat, venue.lng]}>
            <Popup>
              <strong>{venue.name}</strong>
              <br />
              {venue.status === "booked" ? "予約済み" : "予約候補"}
              <br />
              {new Intl.DateTimeFormat("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(new Date(venue.event_date))}
              <br />
              {venue.address}
              <br />
              {new Intl.NumberFormat("ja-JP", {
                style: "currency",
                currency: "JPY",
                maximumFractionDigits: 0,
              }).format(venue.fee)}
              <br />
              編集者: {venue.editor_email}
            </Popup>
          </Marker>
        ) : (
          <CircleMarker
            key={venue.id}
            center={[venue.lat, venue.lng]}
            radius={9}
            pathOptions={{
              color: "#fff8ec",
              weight: 3,
              fillOpacity: 0.95,
              fillColor: venue.status === "booked" ? "#0f766e" : "#d97706",
            }}
          >
            <Popup>
              <strong>{venue.name}</strong>
              <br />
              {venue.status === "booked" ? "予約済み" : "予約候補"}
              <br />
              {new Intl.DateTimeFormat("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(new Date(venue.event_date))}
              <br />
              {venue.address}
              <br />
              {new Intl.NumberFormat("ja-JP", {
                style: "currency",
                currency: "JPY",
                maximumFractionDigits: 0,
              }).format(venue.fee)}
              <br />
              編集者: {venue.editor_email}
            </Popup>
          </CircleMarker>
        )
      ))}
    </MapContainer>
  );
}

function MapFocusController({
  focusVenue,
  focusZoom,
}: {
  focusVenue?: Venue | null;
  focusZoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusVenue) {
      map.setView(JAPAN_CENTER, 5);
      return;
    }

    map.flyTo([focusVenue.lat, focusVenue.lng], focusZoom, {
      animate: true,
      duration: 0.8,
    });
  }, [focusVenue, focusZoom, map]);

  return null;
}
