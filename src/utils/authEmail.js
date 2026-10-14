// Customers without an email log in with their phone number. Firebase Auth
// needs an email, so the phone is turned into <phone>@adoxgaming.com.
export const PHONE_EMAIL_DOMAIN = "adoxgaming.com";

// Accounts created before the domain change used this one.
const LEGACY_PHONE_EMAIL_DOMAIN = "adox.com";

// "077 123 4567", "+94771234567", "94771234567" -> "0771234567"
export const normalizePhone = (value) => {
  let digits = String(value || "").replace(/[\s\-()+]/g, "");
  if (/^94\d{9}$/.test(digits)) digits = "0" + digits.slice(2);
  return digits;
};

export const isPhone = (value) => /^[0-9]{10}$/.test(normalizePhone(value));

export const phoneToEmail = (phone) => `${normalizePhone(phone)}@${PHONE_EMAIL_DOMAIN}`;

// Email to create the Firebase account with: the real email if given,
// otherwise the phone-based one.
export const authEmailFor = ({ email, phone }) =>
  email && email.trim() ? email.trim() : phoneToEmail(phone);

// Emails to try at login, in order. Phone numbers also try the legacy domain.
export const loginEmailsFor = (identifier) => {
  const value = identifier.trim();
  if (!isPhone(value)) return [value];
  const phone = normalizePhone(value);
  return [`${phone}@${PHONE_EMAIL_DOMAIN}`, `${phone}@${LEGACY_PHONE_EMAIL_DOMAIN}`];
};
