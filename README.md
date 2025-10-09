<div align="center">

# 🏆 CodeNinja Sports Week

*A comprehensive web application for managing CodeNinja Consulting's annual sports tournament*

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## 📖 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [🚀 Getting Started](#-getting-started)
- [📋 Usage Guide](#-usage-guide)
- [🔧 Configuration](#-configuration)
- [🛠️ Development](#️-development)
- [🚀 Deployment](#-deployment)
- [📄 License](#-license)

---

## ✨ Features

<details>
<summary><strong>🔐 Authentication & User Management</strong></summary>

- **Domain-gated registration**: Only `@codeninjaconsulting.com` emails allowed
- **Passwordless authentication**: Simplified login process
- **Profile management**: User profiles with privacy controls
- **Role-based access**: Admin, User, and future Moderator roles

</details>

<details>
<summary><strong>🏟️ Tournament Management</strong></summary>

- **3 Contest Types**: Single Elimination, Round Robin (League), and Scoring Contest
- **Smart Scheduling**: Auto-generate pairings and pack across available courts
- **Multi-venue Support**: Multiple venues with configurable court counts
- **Drag-and-drop Editor**: Visual schedule management with real-time validation
- **Conflict Detection**: Prevents double-booking and enforces rest periods

</details>

<details>
<summary><strong>🎮 Game Registration</strong></summary>

- **Individual & Team Registration**: Support for both solo and team-based games
- **Skill Level Selection**: Beginner, Intermediate, Advanced levels
- **Category Limits**: Configurable per-person participation caps
- **Auto-team Assignment**: Optional admin assignment for individual players

</details>

<details>
<summary><strong>📊 Scoring & Leaderboards</strong></summary>

- **Weightage System**: Games have difficulty-based point values
- **Real-time Updates**: Instant leaderboard updates after results
- **Multiple Views**: Global, per-category, per-game leaderboards
- **Tiebreaker Logic**: Comprehensive tiebreaking system
- **Department Filtering**: Filter leaderboards by organizational department

</details>

<details>
<summary><strong>📧 Email System</strong></summary>

- **Microsoft 365 Integration**: SMTP/OAuth support
- **Template System**: Global, Category, and Game-specific templates
- **Variable Substitution**: Dynamic content with user/game variables
- **Bulk Sending**: Segment-based email campaigns
- **Auto Reminders**: 10-minute pre-match notifications

</details>

<details>
<summary><strong>💬 Community Features</strong></summary>

- **Feed System**: User posts with image support and reactions
- **News & Announcements**: Admin-only news with pinning capability
- **Comments & Reactions**: Interactive community engagement
- **Content Moderation**: Profanity filtering and reporting system

</details>

<details>
<summary><strong>🛡️ Safety & Moderation</strong></summary>

- **Profanity Filter**: Automatic content filtering
- **Rate Limiting**: Prevents spam and abuse
- **Content Reporting**: User-driven moderation system
- **User Blocking**: Admin controls for problematic users
- **Audit Logging**: Complete action history tracking

</details>

<details>
<summary><strong>📱 Responsive Design</strong></summary>

- **Mobile-first**: Optimized for phone usage
- **WCAG AA Compliance**: Full accessibility support
- **Dark Theme**: CodeNinja-branded dark interface
- **Touch-friendly**: Optimized for mobile interactions

</details>

---

## 🏗️ Architecture

### 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 15 with App Router, TypeScript, Tailwind CSS |
| **UI Components** | shadcn/ui with Radix UI primitives |
| **Database** | SQL Server with Prisma ORM |
| **Email** | Microsoft 365 SMTP/OAuth integration |
| **Drag & Drop** | @dnd-kit for schedule management |
| **Validation** | Zod for type-safe validation |
| **Caching** | In-memory caching with Redis-ready architecture |

### 📁 Project Structure

```
codeninja-sports-week/
├── 📁 src/
│   ├── 📁 app/                    # Next.js App Router pages
│   │   ├── 📁 admin/             # Admin panel pages
│   │   ├── 📁 api/               # API routes
│   │   ├── 📁 auth/              # Authentication pages
│   │   ├── 📁 feed/              # Community feed
│   │   ├── 📁 news/              # News & announcements
│   │   └── 📁 register/          # Game registration
│   ├── 📁 components/            # Reusable UI components
│   │   └── 📁 ui/               # shadcn/ui components
│   └── 📁 lib/                   # Utility libraries
│       ├── 📄 cache.ts          # Caching utilities
│       ├── 📄 email.ts          # Email service
│       ├── 📄 prisma.ts         # Database client
│       ├── 📄 profanity-filter.ts # Content moderation
│       ├── 📄 scheduling.ts     # Tournament algorithms
│       └── 📄 validation.ts     # Input validation
├── 📁 prisma/
│   └── 📄 schema.prisma         # Database schema
└── 📁 public/                   # Static assets
```

---

## 🚀 Getting Started

### 📋 Prerequisites

> **Note**: Ensure you have the following installed before proceeding:

- ![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js) Node.js 18+ and npm
- ![SQL Server](https://img.shields.io/badge/SQL%20Server-Instance-red?style=flat-square&logo=microsoft-sql-server) SQL Server instance
- ![Microsoft 365](https://img.shields.io/badge/Microsoft%20365-Account-blue?style=flat-square&logo=microsoft) Microsoft 365 account for email

### ⚡ Quick Start

1. **📥 Clone the repository**
   ```bash
   git clone <repository-url>
   cd codeninja-sports-week
   ```

2. **📦 Install dependencies**
   ```bash
   npm install
   ```

3. **⚙️ Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   > **Important**: Configure the following variables in your `.env` file:
   
   ```env
   # Database Configuration
   DATABASE_URL="postgresql://username:password@localhost:5432/your_database_name"
   
   # NextAuth Configuration
   NEXTAUTH_SECRET="your-nextauth-secret-key-here-generate-a-random-string"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Email Configuration (Gmail example)
   EMAIL_SMTP_HOST="smtp.gmail.com"
   EMAIL_SMTP_PORT="587"
   EMAIL_SMTP_USER="your-email@gmail.com"
   EMAIL_SMTP_PASSWORD="your-app-password-here"
   EMAIL_FROM="your-email@gmail.com"
   
   # Domain Configuration
   ALLOWED_EMAIL_DOMAIN="yourcompany.com"
   
   # Security
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   ```

4. **🗄️ Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **🚀 Start the development server**
   ```bash
   npm run dev
   ```

6. **🌐 Access the application**
   - **Main app**: http://localhost:3000
   - **Admin panel**: http://localhost:3000/admin

### 🎯 First-time Setup

> **Follow these steps to get your tournament up and running:**

1. ✅ **Create an admin user** by registering with an `@codeninjaconsulting.com` email
2. ✅ **Set up departments** in the admin panel
3. ✅ **Create event categories** with time windows and venues
4. ✅ **Configure games** with contest types and parameters
5. ✅ **Set up email templates** for notifications

---

## 📋 Usage Guide

### 👨‍💼 For Administrators

<details>
<summary><strong>🎪 Event Setup</strong></summary>

- Create categories (Indoor/Outdoor) with time windows
- Add venues and configure court counts
- Create games with appropriate contest types
- Set up email templates for notifications

</details>

<details>
<summary><strong>👥 User Management</strong></summary>

- Monitor user registrations
- Manage departments
- Handle content moderation
- Block/unblock users as needed

</details>

<details>
<summary><strong>🏆 Tournament Management</strong></summary>

- Generate schedules for games
- Drag-and-drop to adjust match times
- Enter match results and winners
- Monitor leaderboards and standings

</details>

<details>
<summary><strong>📢 Communication</strong></summary>

- Send bulk emails to participants
- Post news and announcements
- Pin important updates

</details>

### 👤 For Users

<details>
<summary><strong>📝 Registration</strong></summary>

- Register with your `@codeninjaconsulting.com` email
- Complete your profile with department and preferences
- Set privacy options for age/gender display

</details>

<details>
<summary><strong>🎮 Game Registration</strong></summary>

- Browse available games by category
- Register individually or create teams
- Respect category participation limits
- Check for schedule conflicts

</details>

<details>
<summary><strong>💬 Community Engagement</strong></summary>

- Post updates and photos in the feed
- React to posts and news
- Comment on community content
- Follow tournament progress

</details>

<details>
<summary><strong>🏅 Tournament Participation</strong></summary>

- Check your schedule regularly
- Receive email reminders before matches
- View live leaderboards and standings
- Celebrate victories! 🎉

</details>

---

## 🔧 Configuration

### 🏆 Contest Types

| Type | Description |
|------|-------------|
| **Single Elimination** | Traditional knockout tournament |
| **Round Robin (League)** | Everyone plays everyone once in a league format |
| **Scoring Contest** | Individual scoring-based competition where participants compete for the highest score |

### 📧 Email Templates

Templates support variable substitution:

| Variable | Description |
|----------|-------------|
| `{{first_name}}`, `{{last_name}}` | User details |
| `{{game_name}}`, `{{category_name}}` | Game information |
| `{{slot_time}}`, `{{venue_name}}` | Schedule details |
| `{{team_name}}`, `{{opponent}}` | Match details |

### 📊 Scoring System

- **Weightage Points**: Winners receive game weightage points
- **Table Points**: Win=3, Draw=1, Loss=0 (configurable)
- **Tiebreakers**: Total points → Head-to-head → Point differential → Most wins → Earliest win → Random

---

## 🛠️ Development

### 🗄️ Database Schema

The application uses 20+ Prisma models including:

- **User management**: User, Department, Team
- **Tournament structure**: Category, Game, Venue, Court
- **Scheduling**: Slot, Match
- **Results**: Winner, Standing, Leaderboard
- **Community**: Post, Comment, Reaction, News
- **System**: AuditLog, EmailTemplate, EmailLog

### 🔌 API Routes

RESTful API with comprehensive endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/api/auth/*` | Authentication |
| `/api/admin/*` | Admin operations |
| `/api/games/*` | Game management |
| `/api/registrations/*` | User registrations |
| `/api/posts/*` | Community feed |
| `/api/news/*` | Announcements |
| `/api/leaderboards/*` | Scoring data |

### ⚡ Performance Optimizations

- **Caching**: In-memory cache with TTL and cleanup
- **Lazy Loading**: Image preloading and lazy loading
- **Debouncing**: Search and input optimization
- **Throttling**: Scroll and resize event optimization
- **Performance Monitoring**: Built-in metrics collection

---

## 🧪 Testing

### ✅ Validation Testing
- Zod schema validation for all inputs
- Business logic validation (conflicts, limits)
- File upload validation (size, type)
- Tournament bracket validation

### 🔍 Edge Cases Covered
- Schedule conflicts and double-booking
- Category participation limits
- Tournament bracket sizing
- Email delivery failures
- Content moderation scenarios

---

## 🚀 Deployment

### ✅ Production Checklist

<details>
<summary><strong>🌐 Environment Setup</strong></summary>

- [ ] Configure production database
- [ ] Set up Microsoft 365 email service
- [ ] Configure domain and SSL certificates

</details>

<details>
<summary><strong>🔒 Security</strong></summary>

- [ ] Enable CSRF protection
- [ ] Configure rate limiting
- [ ] Set up content security policies
- [ ] Enable audit logging

</details>

<details>
<summary><strong>⚡ Performance</strong></summary>

- [ ] Set up Redis for caching
- [ ] Configure CDN for static assets
- [ ] Enable database connection pooling
- [ ] Set up monitoring and alerts

</details>

<details>
<summary><strong>💾 Backup & Recovery</strong></summary>

- [ ] Database backup strategy
- [ ] File storage backup
- [ ] Disaster recovery plan

</details>

---

## 📄 License

This project is proprietary software developed for CodeNinja Consulting's internal use.

---

## 🤝 Contributing

This is an internal project for CodeNinja Consulting. For questions or support, contact the development team.

---

<div align="center">

**Built with ❤️ for CodeNinja Sports Week 2024**

*May the best team win! 🏆*

---

<sub>© 2024 CodeNinja Consulting. All rights reserved.</sub>

</div>