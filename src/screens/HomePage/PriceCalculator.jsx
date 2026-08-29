import React, { useState } from "react";
import { STATIONS, getStationCapacity, getStationRate } from "../../config/stations";

const DURATIONS = [0.25, 0.5, 1, 2];
const EVENT_RATE_PER_HOUR = 2000;
const WHATSAPP_NUMBER = "94778662814";

const formatDuration = (h) => {
  if (h === 0.25) return "15m";
  if (h === 0.5) return "30m";
  return `${h}h`;
};

const todayStr = () => new Date().toISOString().split("T")[0];

// livePlayers: the same array HomePage already builds from active sessions
// (each entry has { machine, endsAt }) — reused here so "is it free right
// now" reflects the exact same live data shown in the Live Sessions panel.
// reservations: today-onward reservations from Firestore, used to flag
// existing bookings on whatever date is picked (informational only — the
// admin still confirms the actual slot).
const PriceCalculator = ({ livePlayers, reservations }) => {
  const [mode, setMode] = useState("station"); // "station" | "event"
  const [date, setDate] = useState(todayStr());
  const [station, setStation] = useState(STATIONS[0].name);
  const [partySize, setPartySize] = useState(1);
  const [hours, setHours] = useState(1);
  const [eventHours, setEventHours] = useState(3);

  const capacity = getStationCapacity(station);
  const isToday = date === todayStr();
  // Switching to a solo-only station (e.g. Simulator) while Double was
  // picked shouldn't price/highlight as Double — clamp for display without
  // needing an effect just to mirror it back into state.
  const effectivePartySize = partySize > capacity ? 1 : partySize;

  const rate = getStationRate(station, effectivePartySize);
  const price = Math.round(rate * hours);
  const eventPrice = Math.round(eventHours * EVENT_RATE_PER_HOUR);

  const busySession = isToday ? livePlayers.find((p) => p.machine === station) : null;
  const bookingsThatDay = (reservations || [])
    .filter((r) => r.machine === station && r.date === date)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dateLabel = isToday ? "today" : new Date(date + "T00:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  const waMessage =
    mode === "station"
      ? `Hi! I'd like to book ${station} (${effectivePartySize === 2 ? "2 players" : "solo"}) for ${formatDuration(hours)} on ${dateLabel} — estimated around Rs. ${price}.` +
        (bookingsThatDay.length > 0
          ? ` I see it already has ${bookingsThatDay.length} booking(s) that day (${bookingsThatDay.map((b) => b.startTime).join(", ")}) — could you check a good time?`
          : " Is it available?")
      : `Hi! I'm planning an event on ${dateLabel} (~${eventHours}h, birthday-party rate) — estimated around Rs. ${eventPrice}. Can you confirm availability and final pricing?`;
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  const notifyMessage = `Hi! Let me know when ${station} is free today (currently busy till ${busySession?.endsAt}).`;
  const notifyLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(notifyMessage)}`;

  return (
    <div className="interface-box">
      <p className="is-size-7 has-text-grey is-uppercase mb-3">Price Calculator</p>

      <div className="buttons has-addons mb-3">
        <button
          className={`button is-small ${mode === "station" ? "is-primary" : "is-dark"}`}
          onClick={() => setMode("station")}
        >
          Stations
        </button>
        <button
          className={`button is-small ${mode === "event" ? "is-primary" : "is-dark"}`}
          onClick={() => setMode("event")}
        >
          Birthday / Event
        </button>
      </div>

      <p className="is-size-7 has-text-grey-light mb-1">Date</p>
      <input
        type="date"
        min={todayStr()}
        className="input is-small is-dark mb-2"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {mode === "station" ? (
        <>
          <p className="is-size-7 has-text-grey-light mb-1">Station</p>
          <div className="columns is-mobile is-multiline mb-2">
            {STATIONS.map((s) => (
              <div key={s.name} className="column is-6">
                <button
                  className={`button is-small is-fullwidth ${station === s.name ? "is-primary" : "is-dark"}`}
                  onClick={() => setStation(s.name)}
                >
                  {s.name}
                </button>
              </div>
            ))}
          </div>

          <p className="is-size-7 has-text-grey-light mb-1">Party Size</p>
          <div className="columns is-mobile mb-2">
            <div className="column">
              <button
                className={`button is-small is-fullwidth ${effectivePartySize === 1 ? "is-primary" : "is-dark"}`}
                onClick={() => setPartySize(1)}
              >
                Solo — Rs. {getStationRate(station, 1)}/hr
              </button>
            </div>
            <div className="column">
              <button
                disabled={capacity < 2}
                title={capacity < 2 ? `${station} is solo-only` : ""}
                className={`button is-small is-fullwidth ${effectivePartySize === 2 ? "is-primary" : "is-dark"}`}
                onClick={() => setPartySize(2)}
              >
                Double — Rs. {capacity < 2 ? "—" : getStationRate(station, 2)}/hr
              </button>
            </div>
          </div>

          <p className="is-size-7 has-text-grey-light mb-1">Duration</p>
          <div className="columns is-mobile mb-2">
            {DURATIONS.map((h) => (
              <div key={h} className="column">
                <button
                  className={`button is-small is-fullwidth ${hours === h ? "is-primary" : "is-dark"}`}
                  onClick={() => setHours(h)}
                >
                  {formatDuration(h)}
                </button>
              </div>
            ))}
          </div>

          <div
            className="box mt-3"
            style={{ background: "#111", border: `1px solid ${busySession ? "#ff3860" : bookingsThatDay.length ? "#ffdd57" : "#00d1b2"}` }}
          >
            <div className="level is-mobile mb-0">
              <div className="level-left">
                <div>
                  <p className="is-size-7 has-text-grey mb-0">Estimated Price</p>
                  <p className="title is-4 has-text-white mb-0">Rs. {price}</p>
                </div>
              </div>
              <div className="level-right">
                {busySession ? (
                  <span className="tag is-danger is-light">Busy till {busySession.endsAt}</span>
                ) : bookingsThatDay.length > 0 ? (
                  <span className="tag is-warning is-light">
                    {bookingsThatDay.length} booking(s): {bookingsThatDay.map((b) => b.startTime).join(", ")}
                  </span>
                ) : (
                  <span className="tag is-success is-light">No bookings yet</span>
                )}
              </div>
            </div>
          </div>

          {busySession ? (
            <a href={notifyLink} target="_blank" rel="noreferrer" className="button is-warning is-small is-fullwidth mt-3">
              Notify Me When Free
            </a>
          ) : (
            <a href={waLink} target="_blank" rel="noreferrer" className="button is-success is-small is-fullwidth mt-3">
              Book on WhatsApp
            </a>
          )}
        </>
      ) : (
        <>
          <p className="is-size-7 has-text-grey-light mb-1">
            Hours (standard birthday-party rate: Rs. {EVENT_RATE_PER_HOUR}/hr)
          </p>
          <div className="field has-addons mb-2">
            <div className="control is-expanded">
              <input
                type="number"
                min="1"
                step="0.5"
                className="input is-small is-dark"
                value={eventHours}
                onChange={(e) => setEventHours(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>
            <div className="control">
              <span className="button is-small is-static is-dark">hours</span>
            </div>
          </div>

          <div className="box mt-3" style={{ background: "#111", border: "1px solid #00d1b2" }}>
            <p className="is-size-7 has-text-grey mb-0">Estimated Price</p>
            <p className="title is-4 has-text-white mb-0">Rs. {eventPrice}</p>
          </div>

          <p className="is-size-7 has-text-grey-light mt-2" style={{ lineHeight: 1.4 }}>
            This is an estimate and may change depending on the scale and nature of the event.
            ±15 minutes on the day is fine, no extra charge.
          </p>

          <a href={waLink} target="_blank" rel="noreferrer" className="button is-success is-small is-fullwidth mt-2">
            Enquire on WhatsApp
          </a>
        </>
      )}
    </div>
  );
};

export default PriceCalculator;
