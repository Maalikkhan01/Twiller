🚀 Twiller — Advanced Production-Grade Social Media Platform


Twiller is a full-stack social media platform inspired by Twitter (X), built using the MERN stack with a modern Next.js 16 App Router frontend and a modular Express.js backend.

This project goes beyond a basic clone and demonstrates real-world production architecture including secure authentication, subscription controls, OTP validation, time-restricted access, multilingual support, and advanced feature gating.

🌐 Live Demo

🔗 Website: https://twiller-liard.vercel.app
📦 GitHub Repository: https://github.com/Maalikkhan01/Twiller

🏗 Architecture Overview
🔹 Frontend

Next.js 16 (App Router)

TypeScript

TailwindCSS

Suspense-based client/server separation

Browser Notification API

i18n Multi-language support

🔹 Backend

Node.js

Express.js

MongoDB (Mongoose)

Versioned API architecture (/api/v2)

Modular folder structure

Rate limiting middleware

OTP services

Payment integration

🔹 Deployment

Frontend: Vercel

Backend: Node production server

✨ Core Features
🔔 1. Intelligent Keyword Notifications

Uses Browser Notification API

Triggers popup when tweet contains:

"cricket"

"science"

Shows full tweet content in notification

Users can enable/disable notifications from profile

User preferences always respected

🎙 2. Secure Audio Tweet System

Record or upload voice tweets

OTP verification via registered email required

Upload limits enforced:

Max duration: 5 minutes

Max size: 100MB

Time restricted upload window:

2:00 PM – 7:00 PM IST

Uploads blocked outside allowed time

🔐 3. Forgot Password with Security Controls

Reset via email or phone

Limit: 1 reset per day

Warning displayed if exceeded

Built-in password generator:

Uppercase + lowercase letters only

No numbers

No special characters

💳 4. Subscription-Based Tweet Limits
Plan	Price	Tweet Limit
Free	₹0	1 tweet
Bronze	₹100/month	3 tweets
Silver	₹300/month	5 tweets
Gold	₹1000/month	Unlimited
Features:

Stripe / Razorpay integration

Invoice email sent after payment

Payment window restricted:

10:00 AM – 11:00 AM IST

Payments blocked outside time window

🌍 5. Multi-Language Support (6 Languages)

Supported languages:

English

Spanish

Hindi

Portuguese

Chinese

French

Secure Language Switching:

French → OTP via email

Other languages → OTP via mobile

Language applied only after verification

🔎 6. Advanced Login Security

Each login stores:

Browser type

Operating system

Device category

IP address

Timestamp

Conditional Authentication Rules:

Chrome → OTP via email required

Microsoft browser → No additional OTP

Mobile login allowed only:

10:00 AM – 1:00 PM IST

Login attempts outside allowed window are blocked.

Login history is visible in user profile.

🧠 Engineering Highlights

Versioned backend architecture (/api/v2)

Defensive API fallback logic

Atomic counter updates

Suspense-compatible Next.js 16 structure

Rate limiting middleware

OTP-based feature gating

Time-based access control

Modular scalable folder design

Interaction QA helper (window.twillerRunUiSanity())
