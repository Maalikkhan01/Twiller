Twiller — Advanced Production-Grade Social Media Platform

Twiller is a full-stack social media platform inspired by Twitter (X), built using the MERN stack with a modern Next.js 16 App Router frontend and a modular Express.js backend.

This project demonstrates real-world production architecture including secure authentication, OTP validation, subscription-based access control, browser notifications, time-restricted feature gating, multilingual support, and advanced login security.

Live Demo

 Website: https://twiller-liard.vercel.app  
 GitHub Repository: https://github.com/Maalikkhan01/Twiller  

Tech Stack
Frontend
- Next.js 16 (App Router)
- TypeScript
- TailwindCSS
- Suspense-based client/server separation
- Browser Notification API
- i18n Multi-language Support
Backend
- Node.js
- Express.js
- MongoDB (Mongoose)
- Versioned API Architecture (`/api/v2`)
- Modular folder structure
- Rate limiting middleware
- OTP services (Email + Mobile)
- Payment integration (Stripe / Razorpay ready)
- Redis support (optional)

 Core Features

1. Intelligent Keyword Notifications

- Uses Browser Notification API
- Triggers popup if tweet contains:
  - "cricket"
  - "science"
- Displays full tweet content in popup
- Users can enable/disable notifications in profile
- System always respects user preference

2. Secure Audio Tweet System

- Record or upload voice tweets
- OTP verification via registered email required
- Upload limits enforced:
  - Max duration: 5 minutes
  - Max size: 100MB
- Time-restricted upload window:
  - 2:00 PM – 7:00 PM IST
- Uploads blocked outside allowed time

3. Forgot Password with Security Controls

- Reset via email or phone
- Limit: 1 reset per day
- Warning shown if exceeded
- Built-in password generator:
  - Uppercase + lowercase letters only
  - No numbers
  - No special characters

4. Subscription-Based Tweet Limits

| Plan   | Price | Tweet Limit |
|--------|-------|------------|
| Free   | ₹0    | 1 tweet |
| Bronze | ₹100/month | 3 tweets |
| Silver | ₹300/month | 5 tweets |
| Gold   | ₹1000/month | Unlimited |

Features:
- Stripe / Razorpay integration
- Invoice email after successful payment
- Payment allowed only between:
  - 10:00 AM – 11:00 AM IST
- Payments blocked outside time window

5. Multi-Language Support (i18n)

Supported languages:
- English
- Spanish
- Hindi
- Portuguese
- Chinese
- French

Verification rules:
- French → OTP via email
- All other languages → OTP via mobile
- Language applied only after successful OTP

6. Advanced Login Security

System stores:
- Browser type
- Operating system
- Device category
- IP address

Login behavior rules:
- Chrome → Email OTP required
- Microsoft browser → No additional OTP
- Mobile login allowed only:
  - 10:00 AM – 1:00 PM IST
- Login blocked outside allowed time

Login history displayed in user profile.

 Project Structure
/backend
/audio
/subscriptions
/forgot-password
/login-security
/language
/v2
/twiller (frontend)


 Production Deployment

Frontend: Vercel  
Backend: Node Production Server  
Database: MongoDB Atlas  


What This Project Demonstrates

- Real-world feature gating
- OTP-based verification flows
- Secure payment handling
- Subscription logic control
- Role-based + time-based access restrictions
- Advanced authentication rules
- Production-ready folder architecture



Developed By

**Abdul Maalik Khan**  
Full Stack Developer  
MERN Stack | Next.js | Production Architecture  


If you found this project impressive, feel free to star the repository.

