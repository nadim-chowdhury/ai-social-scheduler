# AI Social Scheduler

A comprehensive SaaS platform for AI-powered social media content creation and scheduling. Built with Next.js, Supabase, and modern web technologies.

## 🚀 Features

### Core Features

- **AI Content Generation**: Generate engaging posts, captions, and hashtags using multiple AI providers
- **Multi-Platform Scheduling**: Schedule posts across Facebook, Instagram, Twitter, LinkedIn, and TikTok
- **Smart Analytics**: Track performance with real-time analytics and insights
- **Team Collaboration**: Workspace management with role-based permissions
- **Bulk Operations**: Import/export posts, bulk scheduling, and management

### AI Capabilities

- Text generation with OpenAI GPT and Anthropic Claude
- Image generation with DALL-E and Stable Diffusion
- Smart hashtag suggestions
- Content optimization for different platforms
- Fallback provider system for reliability

### Social Media Integration

- Facebook Pages and Instagram Business accounts
- Twitter/X API integration
- LinkedIn Company pages
- TikTok Business accounts
- Real-time posting and analytics

## 🛠 Tech Stack

### Frontend

- **Next.js 14** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **ShadCN UI** component library
- **Framer Motion** for animations
- **React Hook Form** with Zod validation
- **Redux Toolkit** for state management
- **RTK Query** for API data fetching

### Backend

- **Supabase** for database, auth, and real-time features
- **NextAuth.js** for authentication
- **PostgreSQL** database with Row Level Security
- **Redis** for background job queuing
- **BullMQ** for job processing

### AI & External Services

- **OpenAI API** for text and image generation
- **Anthropic Claude** for advanced text generation
- **Stability AI** for image generation
- **Meta Graph API** for Facebook/Instagram
- **Stripe** for payment processing

### Infrastructure

- **Vercel** for frontend deployment
- **Supabase** for backend services
- **GitHub Actions** for CI/CD
- **Sentry** for error monitoring

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages
│   ├── (dashboard)/              # Dashboard pages
│   ├── api/                      # API routes
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── dashboard/                # Dashboard-specific components
│   ├── providers/                # Context providers
│   └── ui/                       # ShadCN UI components
├── lib/                          # Utility libraries
│   ├── auth.ts                   # NextAuth configuration
│   ├── supabase.ts               # Supabase client
│   └── ai-providers.ts           # AI service providers
├── services/                     # API services
│   └── apiService.ts             # RTK Query API service
├── store/                        # Redux store
│   ├── slices/                   # Redux slices
│   └── index.ts                  # Store configuration
└── hooks/                        # Custom React hooks
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key
- Social media app credentials

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/ai-social-scheduler.git
   cd ai-social-scheduler
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.local.example .env.local
   ```

   Fill in your environment variables:

   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

   # NextAuth
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret

   # AI APIs
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key

   # Social Media APIs
   META_APP_ID=your_meta_app_id
   META_APP_SECRET=your_meta_app_secret

   # Payments
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
   ```

4. **Set up the database**

   ```bash
   # Run Supabase migrations
   npx supabase db push
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄 Database Schema

The application uses PostgreSQL with the following main tables:

- **users**: User accounts and profiles
- **workspaces**: Team workspaces with billing
- **workspace_members**: Team member relationships
- **social_accounts**: Connected social media accounts
- **posts**: Scheduled and published posts
- **analytics**: Post performance metrics
- **ai_requests**: AI generation tracking and billing
- **billing_subscriptions**: Stripe subscription data

## 🔐 Authentication

The app uses NextAuth.js with multiple providers:

- Email (magic links)
- Google OAuth
- GitHub OAuth

Social media accounts are connected via OAuth flows specific to each platform.

## 🤖 AI Integration

### Supported Providers

- **OpenAI**: GPT-4 for text, DALL-E for images
- **Anthropic**: Claude for advanced text generation
- **Stability AI**: Stable Diffusion for images

### Features

- Automatic fallback between providers
- Cost tracking and usage limits
- Content moderation and safety checks
- Custom prompt templates per platform

## 📊 Analytics & Monitoring

- Real-time post performance tracking
- Engagement metrics and insights
- AI usage and cost monitoring
- Error tracking with Sentry
- Performance monitoring

## 🚀 Deployment

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Supabase)

1. Create a new Supabase project
2. Run database migrations
3. Configure authentication providers
4. Set up webhooks for external services

### Background Workers

Deploy to your preferred platform:

- Render
- Fly.io
- Railway
- AWS/GCP/Azure

## 📈 Scaling Considerations

- **Database**: Use Supabase Pro for better performance
- **Caching**: Implement Redis for frequently accessed data
- **CDN**: Use Vercel's edge network for static assets
- **Background Jobs**: Scale workers based on queue length
- **AI APIs**: Implement rate limiting and cost controls

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
```

### Code Style

- ESLint for code linting
- Prettier for code formatting
- TypeScript for type safety
- Conventional commits for git messages

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Documentation: [docs.ai-social-scheduler.com](https://docs.ai-social-scheduler.com)
- Issues: [GitHub Issues](https://github.com/your-username/ai-social-scheduler/issues)
- Email: support@ai-social-scheduler.com

## 🗺 Roadmap

### Phase 1 (Current)

- ✅ Core scheduling functionality
- ✅ AI content generation
- ✅ Basic analytics
- ✅ Multi-platform support

### Phase 2 (Q2 2024)

- 🔄 Advanced analytics dashboard
- 🔄 Team collaboration features
- 🔄 Bulk import/export
- 🔄 Custom AI templates

### Phase 3 (Q3 2024)

- 📅 White-label solutions
- 📅 Enterprise features
- 📅 Advanced AI capabilities
- 📅 Mobile app

### Phase 4 (Q4 2024)

- 📅 Video content generation
- 📅 Advanced automation
- 📅 Marketplace integrations
- 📅 API for third-party developers

---

Built with ❤️ by the AI Social Scheduler team
