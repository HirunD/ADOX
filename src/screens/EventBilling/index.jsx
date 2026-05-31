import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, addDoc, onSnapshot } from "firebase/firestore";

const EventBilling = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // --- FORM STATE ---
  const [clientName, setClientName] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("14:00");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  // --- REVENUE HISTORY STATE ---
  const [invoices, setInvoices] = useState([]);
  const [totalEventRevenue, setTotalEventRevenue] = useState(0);
  const [receiptData, setReceiptData] = useState(null);

  // --- BLOCKING ACCORDION FOR REVENUE ---
  const [historyOpen, setHistoryOpen] = useState(true);

  // --- AUTHENTICATION CHECK ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAdmin(true);
    } else {
      alert("Unauthorized Access Key");
    }
  };

  // --- LIVE DATA FETCH FOR EVENT INVOICES ---
  useEffect(() => {
    if (!isAdmin) return;

    const unsubInvoices = onSnapshot(collection(db, "event_invoices"), (snapshot) => {
      let list = [];
      let total = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data });
        total += Number(data.amountPaid) || 0;
      });
      // Sort newest bookings first
      setInvoices(list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setTotalEventRevenue(total);
    });

    return () => unsubInvoices();
  }, [isAdmin]);

  // --- SUBMIT AND GENERATE INVOICE RECEIPT ---
  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    if (!clientName || !eventDate || !startTime || !endTime || !price) {
      return alert("Please fill in all essential fields!");
    }

    setIsSaving(true);

    const invoiceData = {
      clientName,
      eventDate,
      timeRange: `${startTime} - ${endTime}`,
      amountPaid: Number(price),
      method: paymentMethod,
      notes: notes || null,
      createdAt: new Date().toISOString(),
    };

    try {
      await addDoc(collection(db, "event_invoices"), invoiceData);
      
      setReceiptData(invoiceData);

      // Reset Form State fields
      setClientName("");
      setPrice("");
      setNotes("");
      setIsSaving(false);

      // Trigger standard continuous thermal printing layout
      setTimeout(() => {
        window.print();
      }, 500);

    } catch (err) {
      console.error("Firestore Save Error: ", err);
      alert("Error saving event invoice to registry database.");
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
        <form
          className="box"
          style={{ maxWidth: "400px", margin: "100px auto", background: "#1a1a1a", border: "1px solid #333" }}
          onSubmit={handleLogin}
        >
          <h1 className="title has-text-white is-5 uppercase tracking-wide">Event Console Login</h1>
          <input
            className="input is-dark mb-3"
            type="password"
            placeholder="Security Access Code"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="button is-primary is-fullwidth has-text-weight-bold">AUTHORIZE</button>
        </form>
      </div>
    );
  }

  return (
    <div className="section" style={{ background: "#050505", minHeight: "100vh", padding: "1.5rem 0.75rem" }}>
      
      {/* NAVIGATION TABS HEADER */}
      <div className="tabs is-boxed mb-5">
        <ul style={{ borderBottomColor: '#333' }}>
          <li>
            <a href="/admin" style={{ color: '#fff' }}>
              <span className="icon is-small"><i className="fas fa-terminal"></i></span>
              <span>Console</span>
            </a>
          </li>
          <li className="is-active">
            <a style={{ background: '#1a1a1a', color: '#00d1b2', borderColor: '#333' }}>
              <span className="icon is-small"><i className="fas fa-calendar-alt"></i></span>
              <span>Event Invoicing</span>
            </a>
          </li>
        </ul>
      </div>

      {/* THERMAL SLIP INVOICE PRINT ELEMENT */}
      <div id="receipt-print" style={{ display: "none" }}>
        {receiptData && (
          <div style={{ width: "75mm", padding: "10px", color: "black", fontFamily: "monospace" }}>
            <center>
              <h2>ADOX GAMING</h2>
              <p>--- EVENT INVOICE ---</p>
            </center>
            <p><b>CLIENT:</b> {receiptData.clientName}</p>
            <p><b>DATE:</b> {receiptData.eventDate}</p>
            <p><b>RESERVED:</b> {receiptData.timeRange}</p>
            <p><b>METHOD:</b> {receiptData.method}</p>
            {receiptData.notes && <p><b>DETAILS:</b> {receiptData.notes}</p>}
            <hr style={{ borderTop: "1px dashed #000" }} />
            <h2 style={{ textAlign: "right", margin: 0 }}>Total: Rs. {receiptData.amountPaid.toLocaleString()}</h2>
          </div>
        )}
      </div>

      <div className="container is-fluid">
        <div className="columns is-desktop">
          
          {/* BILLING CONFIGURATOR CONTROLS */}
          <div className="column is-5-desktop">
            <div className="box" style={{ background: "#1a1a1a", border: "1px solid #00d1b2" }}>
              <h2 className="subtitle is-5 has-text-white mb-4">⚡ Create Event Invoice</h2>
              
              <form onSubmit={handleCreateInvoice}>
                <div className="field mb-3">
                  <label className="label is-small has-text-grey">CLIENT / COMPANY NAME *</label>
                  <input
                    className="input is-dark"
                    type="text"
                    placeholder="e.g. Corporate Booking / Birthday"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                  />
                </div>

                <div className="field mb-3">
                  <label className="label is-small has-text-grey">BOOKING DATE *</label>
                  <input
                    className="input is-dark"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </div>

                <div className="columns is-mobile mb-0">
                  <div className="column">
                    <div className="field">
                      <label className="label is-small has-text-grey">FROM *</label>
                      <input
                        className="input is-dark"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="column">
                    <div className="field">
                      <label className="label is-small has-text-grey">UNTIL *</label>
                      <input
                        className="input is-dark"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="field mb-3">
                  <label className="label is-small has-text-grey">TOTAL SETTLED PRICE (RS.) *</label>
                  <input
                    className="input is-dark"
                    type="number"
                    placeholder="Enter fixed price rate"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>

                <div className="field mb-4">
                  <label className="label is-small has-text-grey">PAYMENT METHOD</label>
                  <div className="control">
                    <div className="select is-dark is-fullwidth">
                      <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                        <option value="CASH">CASH</option>
                        <option value="CARD">CREDIT / DEBIT CARD</option>
                        <option value="BANK_TRANSFER">BANK TRANSFER</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="field mb-4">
                  <label className="label is-small has-text-grey">BOOKING NOTES / BOOKED STATIONS (OPTIONAL)</label>
                  <textarea
                    className="textarea is-dark"
                    rows="3"
                    placeholder="Mention specific details, special configurations, or setup details here..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`button is-primary is-fullwidth has-text-weight-bold ${isSaving ? "is-loading" : ""}`}
                >
                  🚀 INVOICE & PRINT RECEIPT
                </button>
              </form>
            </div>
          </div>

          {/* HISTORIC INVOICES RECORDS REPORT */}
          <div className="column is-7-desktop">
            <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", marginBottom: "1rem" }} onClick={() => setHistoryOpen(!historyOpen)}>
              <h2 className="title is-5 has-text-white">🗓️ Historic Event Invoices</h2>
              <span style={{ color: "#666" }}>{historyOpen ? "▲" : "▼"}</span>
            </div>

            {historyOpen && (
              <>
                <div style={{ background: "linear-gradient(135deg, #00d1b2 0%, #006b5a 100%)", borderRadius: "12px", padding: "1.25rem", marginBottom: "1rem" }}>
                  <p style={{ color: "white", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px" }}>Accumulated Event Revenue</p>
                  <h2 style={{ color: "white", fontSize: "1.75rem", fontWeight: 800 }}>Rs. {totalEventRevenue.toLocaleString()}</h2>
                </div>

                <div className="box" style={{ background: "#1a1a1a", padding: "0", border: "1px solid #333", overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="table is-fullwidth is-dark" style={{ background: "transparent", minWidth: "550px" }}>
                      <thead>
                        <tr>
                          <th>Client Detail</th>
                          <th>Reserved Slot</th>
                          <th>Method</th>
                          <th>Notes</th>
                          <th className="has-text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.length > 0 ? (
                          invoices.map((inv) => (
                            <tr key={inv.id} style={{ borderBottom: "1px solid #222" }}>
                              <td className="is-size-7">
                                <span className="has-text-weight-bold has-text-white">{inv.clientName}</span>
                              </td>
                              <td className="is-size-7">
                                <span className="has-text-primary">{inv.eventDate}</span>
                                <br />
                                <span className="has-text-grey" style={{ fontSize: "0.65rem" }}>({inv.timeRange})</span>
                              </td>
                              <td className="is-size-7"><span className="tag is-dark">{inv.method}</span></td>
                              <td className="is-size-7" style={{ maxWidth: "180px", whiteSpace: "normal", wordBreak: "break-word" }}>
                                {inv.notes ? inv.notes : <span className="has-text-grey-dark italic">None</span>}
                              </td>
                              <td className="has-text-right has-text-weight-bold has-text-success">
                                Rs. {inv.amountPaid.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="has-text-centered has-text-grey py-4 italic is-size-7">No logged event invoices found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      <style>{`
        @media print { 
          body * { visibility: hidden; } 
          #receipt-print { display: block !important; visibility: visible; position: absolute; left: 0; top: 0; } 
          #receipt-print * { visibility: visible; } 
        }
      `}</style>
    </div>
  );
};

export default EventBilling;