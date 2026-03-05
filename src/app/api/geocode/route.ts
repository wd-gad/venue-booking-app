import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim();

  if (!address) {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }

  const gsiParams = new URLSearchParams({ q: address });

  try {
    const gsiResponse = await fetch(
      `https://msearch.gsi.go.jp/address-search/AddressSearch?${gsiParams.toString()}`,
      {
        headers: {
          "User-Agent": "venue-booking-manager/1.0",
        },
        next: { revalidate: 0 },
      },
    );

    if (gsiResponse.ok) {
      const gsiData = (await gsiResponse.json()) as Array<{
        geometry?: { coordinates?: [number, number] };
      }>;
      const coordinates = gsiData[0]?.geometry?.coordinates;

      if (coordinates && coordinates.length === 2) {
        return NextResponse.json({
          lat: coordinates[1],
          lng: coordinates[0],
          provider: "gsi",
        });
      }
    }
  } catch {
    // Fall through to the secondary provider.
  }

  const osmParams = new URLSearchParams({
    q: address,
    format: "jsonv2",
    limit: "1",
    countrycodes: "jp",
  });

  try {
    const osmResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?${osmParams.toString()}`,
      {
        headers: {
          "Accept-Language": "ja",
          "User-Agent": "venue-booking-manager/1.0",
        },
        next: { revalidate: 0 },
      },
    );

    if (!osmResponse.ok) {
      return NextResponse.json({ error: "geocoding failed" }, { status: 502 });
    }

    const osmData = (await osmResponse.json()) as Array<{ lat: string; lon: string }>;
    const result = osmData[0];

    if (!result) {
      return NextResponse.json({ error: "address not found" }, { status: 404 });
    }

    return NextResponse.json({
      lat: Number(result.lat),
      lng: Number(result.lon),
      provider: "nominatim",
    });
  } catch {
    return NextResponse.json({ error: "geocoding failed" }, { status: 502 });
  }
}
