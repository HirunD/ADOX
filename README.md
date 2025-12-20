# ADOX Portal 🚀

A digital ID system built with React, Firebase, and Bulma CSS. This application allows users to register, generate a unique QR code containing their profile data, and provides an Admin Panel for scanning and verifying users.

## ✨ Features

- **User Authentication:** Secure Sign Up and Login using Firebase Auth.
- **Digital ID Generation:** Automatically generates a QR code containing User UID and Profile details.
- **Firestore Integration:** Stores extended profile data (Age, School, Phone Number).
- **Admin Panel:** Password-protected area with a real-time QR scanner to fetch and display user data from the database.
- **Responsive Design:** Built with Bulma CSS for a clean, mobile-friendly interface.

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite)
- **Styling:** Bulma CSS & FontAwesome Icons
- **Database & Auth:** Firebase (Authentication & Cloud Firestore)
- **QR Engine:** `react-qr-code` (Generation) & `qr-scanner` (Scanning)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- A Firebase Project

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone [https://github.com/your-username/adox-portal.git](https://github.com/your-username/adox-portal.git)
cd adox-portal
npm install