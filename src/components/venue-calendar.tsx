"use client";

import { useMemo, useState } from "react";
import type { Venue } from "@/lib/types";

type VenueCalendarProps = {
  focusVenue?: Venue | null;
  onVenueSelect?: (venueId: string) => void;
  venues: Venue[];
};

type CalendarCell = {
  date: Date;
  dayType: "weekday" | "saturday" | "sunday" | "holiday";
  holidayName: string | null;
  inMonth: boolean;
  isoDate: string;
  venues: Venue[];
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOLIDAYS_2026 = new Map<string, string>([
  ["2026-01-01", "元日"],
  ["2026-01-12", "成人の日"],
  ["2026-02-11", "建国記念の日"],
  ["2026-02-23", "天皇誕生日"],
  ["2026-03-20", "春分の日"],
  ["2026-04-29", "昭和の日"],
  ["2026-05-03", "憲法記念日"],
  ["2026-05-04", "みどりの日"],
  ["2026-05-05", "こどもの日"],
  ["2026-05-06", "休日"],
  ["2026-07-20", "海の日"],
  ["2026-08-11", "山の日"],
  ["2026-09-21", "敬老の日"],
  ["2026-09-22", "国民の休日"],
  ["2026-09-23", "秋分の日"],
  ["2026-10-12", "スポーツの日"],
  ["2026-11-03", "文化の日"],
  ["2026-11-23", "勤労感謝の日"],
]);

export function VenueCalendar({ focusVenue, onVenueSelect, venues }: VenueCalendarProps) {
  const [selectedCell, setSelectedCell] = useState<CalendarCell | null>(null);

  const monthStart = useMemo(() => {
    const baseDate = focusVenue ? new Date(focusVenue.event_date) : new Date();
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  }, [focusVenue]);

  const monthLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(monthStart);

  const cells = useMemo(() => {
    const start = new Date(monthStart);
    start.setDate(1 - start.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const isoDate = formatIsoDate(date);
      const holidayName = HOLIDAYS_2026.get(isoDate) ?? null;
      const weekday = date.getDay();
      const dayType =
        holidayName
          ? "holiday"
          : weekday === 0
            ? "sunday"
            : weekday === 6
              ? "saturday"
              : "weekday";

      return {
        date,
        dayType,
        holidayName,
        inMonth: date.getMonth() === monthStart.getMonth(),
        isoDate,
        venues: venues.filter((venue) => venue.event_date === isoDate),
      } satisfies CalendarCell;
    });
  }, [monthStart, venues]);

  return (
    <div className="calendar-surface">
      <div className="calendar-toolbar">
        <div>
          <p className="section-label">Calendar</p>
          <h3>{monthLabel}</h3>
        </div>
        {focusVenue ? (
          <p className="calendar-focus-note">
            フォーカス中:{" "}
            {new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric" }).format(
              new Date(focusVenue.event_date),
            )}
          </p>
        ) : null}
      </div>

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label, index) => (
          <span data-day-type={index === 0 ? "sunday" : index === 6 ? "saturday" : "weekday"} key={label}>
            {label}
          </span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((cell) => {
          const isFocused = focusVenue?.event_date === cell.isoDate;

          return (
            <button
              className="calendar-cell"
              data-day-type={cell.dayType}
              data-focused={isFocused}
              data-has-venue={cell.venues.length > 0}
              data-in-month={cell.inMonth}
              key={cell.isoDate}
              onClick={() => {
                if (cell.venues.length) {
                  setSelectedCell(cell);
                }
              }}
              type="button"
            >
              <div className="calendar-cell-head">
                <span className="calendar-day">{cell.date.getDate()}</span>
                {cell.venues.length ? <span className="calendar-count">{cell.venues.length}</span> : null}
              </div>
              <div className="calendar-cell-body">
                {cell.holidayName ? <div className="calendar-holiday-name">{cell.holidayName}</div> : null}
                {cell.venues.slice(0, 2).map((venue) => (
                  <div className="calendar-venue-chip" data-status={venue.status} key={venue.id}>
                    <span>{venue.name}</span>
                  </div>
                ))}
                {cell.venues.length > 2 ? <div className="calendar-more">+{cell.venues.length - 2}</div> : null}
              </div>
            </button>
          );
        })}
      </div>

      {selectedCell ? (
        <div className="calendar-popup-backdrop" onClick={() => setSelectedCell(null)} role="presentation">
          <section
            aria-label="対象会場"
            className="calendar-popup"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="calendar-popup-header">
              <div>
                <p className="section-label">Venue</p>
                <h4>
                  {new Intl.DateTimeFormat("ja-JP", {
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  }).format(selectedCell.date)}
                </h4>
              </div>
              <button className="note-icon-button" onClick={() => setSelectedCell(null)} type="button">
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="calendar-popup-list">
              {selectedCell.venues.map((venue) => (
                <button
                  className="calendar-popup-card"
                  key={venue.id}
                  onClick={() => {
                    onVenueSelect?.(venue.id);
                    setSelectedCell(null);
                  }}
                  type="button"
                >
                  {venue.name}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
