import React, { useState } from "react";
import { auth, db } from "../../firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { DEFAULT_PASSWORD } from "../../config/defaultPassword";

// Blocking overlay for accounts flagged `mustChangePassword` (created or reset
// by an admin). The user can't dismiss it until they set their own password.
const ForcePasswordChange = () => {
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (newPassword.length < 6) return setError("Password must be at least 6 characters.");
        if (newPassword === DEFAULT_PASSWORD) return setError("Please choose a different password.");
        if (newPassword !== confirm) return setError("Passwords don't match.");

        const user = auth.currentUser;
        setSaving(true);
        try {
            try {
                await updatePassword(user, newPassword);
            } catch (err) {
                // Older sessions need a fresh login; they're still on the default password.
                if (err.code !== "auth/requires-recent-login") throw err;
                await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, DEFAULT_PASSWORD));
                await updatePassword(user, newPassword);
            }
            await updateDoc(doc(db, "users", user.uid), { mustChangePassword: false });
        } catch (err) {
            console.error(err);
            setError("Couldn't update password. Please log out and sign in again.");
        } finally {
            setSaving(false);
        }
    };

    const inputStyle = { background: '#252525', color: 'white', border: '1px solid #444' };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <form
                className="box"
                style={{ width: '100%', maxWidth: '380px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '20px' }}
                onSubmit={handleSubmit}
            >
                <h1 className="title is-4 has-text-white mb-2">Set Your Password</h1>
                <p className="is-size-7 has-text-grey-light mb-5">
                    You're using a temporary password. Please choose a new one to continue.
                </p>

                {error && <div className="notification is-danger is-light py-2 is-size-7">{error}</div>}

                <div className="field">
                    <label className="label has-text-grey-light is-size-7">NEW PASSWORD</label>
                    <input className="input" style={inputStyle} type="password" placeholder="Min 6 characters"
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                    <label className="label has-text-grey-light is-size-7">CONFIRM PASSWORD</label>
                    <input className="input" style={inputStyle} type="password"
                        value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </div>

                <button
                    className={`button is-primary is-fullwidth has-text-weight-bold mt-5 ${saving ? 'is-loading' : ''}`}
                    style={{ background: '#00d1b2', color: '#000', border: 'none' }}
                    type="submit"
                    disabled={saving}
                >
                    SAVE PASSWORD
                </button>
            </form>
        </div>
    );
};

export default ForcePasswordChange;
