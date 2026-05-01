import React, { useState } from "react";
import { db } from "../../firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from "firebase/firestore";

const MembershipSignup = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [method, setMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: "", msg: "" });

  const FEE = 1000;
  const VALID_DAYS = 30;

  const handleAdminUnlock = (e) => {
    e.preventDefault();
    if (password === import.meta.env.VITE_ADMIN_PASSWORD) {
      setIsAdmin(true);
    } else {
      alert("Wrong Access Key");
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", msg: "" });
    
    try {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setStatus({ type: "is-danger", msg: "Player not found. Please check the number." });
      } else {
        const userDoc = querySnapshot.docs[0];
        setFoundUser({ id: userDoc.id, ...userDoc.data() });
      }
    } catch (error) {
      setStatus({ type: "is-danger", msg: "Search error." });
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + VALID_DAYS);

      const userRef = doc(db, "users", foundUser.id);
      await updateDoc(userRef, {
        isMember: true,
        membershipExpiry: expiryDate.toISOString(),
        membershipType: "Standard 30-Day"
      });

      await addDoc(collection(db, "invoices"), {
        userId: foundUser.id,
        userName: foundUser.fullName,
        amountPaid: FEE, 
        type: "Membership",
        method: method, 
        expiryDate: expiryDate.toISOString(),
        timestamp: serverTimestamp()
      });

      setStatus({ type: "is-success", msg: `Membership activated for ${foundUser.fullName}!` });
      setFoundUser(null);
      setPhone("");
    } catch (error) {
      setStatus({ type: "is-danger", msg: "Processing error." });
    }
    setLoading(false);
  };

  // --- ADMIN LOCK SCREEN ---
  if (!isAdmin) {
    return (
      <section className="section" style={{ background: '#050505', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="container has-text-centered">
          <form className="box" style={{ maxWidth: '400px', margin: 'auto', background: '#1a1a1a', border: '1px solid #333' }} 
            onSubmit={handleAdminUnlock}>
            <h2 className="title has-text-white is-4">Membership Access</h2>
            <p className="subtitle is-7 has-text-grey">Enter Admin Key to process new memberships</p>
            <input 
              className="input is-dark mb-4" 
              type="password" 
              placeholder="Admin Key" 
              onChange={(e) => setPassword(e.target.value)} 
              autoFocus 
            />
            <button className="button is-primary is-fullwidth">Unlock System</button>
          </form>
        </div>
      </section>
    );
  }

  // --- SIGNUP FORM (POST-UNLOCK) ---
  return (
    <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
      <div className="container">
        <div className="columns is-centered">
          <div className="column is-4">
            <div className="box" style={{ background: "#1a1a1a", border: "1px solid #333", color: "white" }}>
              <div className="level is-mobile mb-5">
                <div className="level-left">
                  <h1 className="title is-5 has-text-white mb-0">Add Membership</h1>
                </div>
                <div className="level-right">
                  <button className="button is-dark is-small" onClick={() => setIsAdmin(false)}>Lock</button>
                </div>
              </div>
              
              {!foundUser ? (
                <form onSubmit={handleSearch}>
                  <div className="field">
                    <label className="label has-text-grey is-size-7">Player Phone Number</label>
                    <input 
                      className="input is-dark" 
                      type="text" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                      placeholder="07XXXXXXXX"
                      required 
                    />
                  </div>
                  <button className={`button is-primary is-fullwidth ${loading ? 'is-loading' : ''}`}>Verify Player</button>
                </form>
              ) : (
                <div>
                  <div className="notification is-dark has-text-centered mb-4" style={{border: '1px solid #444', background: '#0a0a0a'}}>
                    <p className="is-size-7 heading has-text-grey">Confirming for</p>
                    <p className="title is-5 has-text-white mb-1">{foundUser.fullName}</p>
                    <p className="is-size-7 has-text-primary">{foundUser.phone}</p>
                  </div>

                  <div className="field">
                    <label className="label has-text-grey is-size-7">Payment Method</label>
                    <div className="control">
                      <div className="select is-fullwidth is-dark">
                        <select value={method} onChange={(e) => setMethod(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="Online">Online / Card</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="message is-dark is-small">
                    <div className="message-body" style={{background: '#0a0a0a', border: '1px solid #333'}}>
                      Fee: <b className="has-text-white">Rs. {FEE}</b><br/>
                      Valid: <b className="has-text-white">{VALID_DAYS} Days</b><br/>
                      Expires: <b className="has-text-primary">{new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000).toLocaleDateString()}</b>
                    </div>
                  </div>

                  <div className="buttons mt-5">
                    <button className={`button is-fullwidth is-primary ${loading ? 'is-loading' : ''}`} onClick={handleConfirm}>
                      Confirm & Activate
                    </button>
                    <button className="button is-fullwidth is-text is-small has-text-grey" onClick={() => setFoundUser(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {status.msg && (
                <div className={`notification ${status.type} mt-4 is-size-7`}>{status.msg}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipSignup;