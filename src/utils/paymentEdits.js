import { collection, doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";

// Corrections for payments recorded by mistake. Sessions live in an array on
// the user doc, so a session is found by the same machine + startTime key the
// revenue screens de-dupe on. Voided records are never thrown away: they're
// moved to an archive (`voidedSessions` on the user doc, or the
// `voided_event_invoices` collection) that no revenue screen reads.

const sameSession = (a, b) => a.machine === b.machine && a.startTime === b.startTime;

const updateUserSessions = (userId, original, apply) =>
  runTransaction(db, async (tx) => {
    const ref = doc(db, "users", userId);
    const snap = await tx.get(ref);
    const sessions = snap.data()?.sessions || [];
    const index = sessions.findIndex((s) => sameSession(s, original));
    if (index === -1) throw new Error("Payment not found. It may already have been changed; refresh and try again.");
    tx.update(ref, apply(sessions, index, snap.data()));
  });

// `changes` may hold amountPaid, method, machine, duration.
export const editSession = (userId, original, changes) =>
  updateUserSessions(userId, original, (sessions, index) => {
    const prev = sessions[index];
    const updated = { ...prev, ...changes, editedAt: new Date().toISOString() };
    if (prev.amountBeforeEdit === undefined && Number(changes.amountPaid) !== Number(prev.amountPaid)) {
      updated.amountBeforeEdit = prev.amountPaid;
    }
    return { sessions: sessions.map((s, i) => (i === index ? updated : s)) };
  });

export const voidSession = (userId, original, reason) =>
  updateUserSessions(userId, original, (sessions, index, data) => ({
    sessions: sessions.filter((_, i) => i !== index),
    voidedSessions: [
      ...(data.voidedSessions || []),
      { ...sessions[index], voidedAt: new Date().toISOString(), voidReason: reason || null },
    ],
  }));

export const editEventInvoice = (invoiceId, changes) =>
  runTransaction(db, async (tx) => {
    const ref = doc(db, "event_invoices", invoiceId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Invoice not found.");
    const prev = snap.data();
    const update = { ...changes, editedAt: new Date().toISOString() };
    if (prev.amountBeforeEdit === undefined && Number(changes.amountPaid) !== Number(prev.amountPaid)) {
      update.amountBeforeEdit = prev.amountPaid;
    }
    tx.update(ref, update);
  });

export const voidEventInvoice = (invoiceId, reason) =>
  runTransaction(db, async (tx) => {
    const ref = doc(db, "event_invoices", invoiceId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Invoice not found.");
    tx.set(doc(collection(db, "voided_event_invoices"), invoiceId), {
      ...snap.data(),
      voidedAt: new Date().toISOString(),
      voidReason: reason || null,
    });
    tx.delete(ref);
  });
