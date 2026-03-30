# REDNERDS Manufacturing Management System - Web Application

Professional production-grade web application for managing manufacturing workflows, including projects, batches, products, production testing, customer repairs, and quality assurance.

## Technology Stack

- **Frontend Framework:** React 18+ with TypeScript
- **UI Library:** Material-UI (MUI) v5+
- **State Management:** Redux Toolkit
- **API Client:** Axios with React Query
- **Routing:** React Router v6+
- **Form Handling:** React Hook Form + Zod
- **Charts & Analytics:** Recharts
- **Build Tool:** Vite
- **Real-time Updates:** Socket.io-client

## Project Structure

```
src/
├── components/        # Shared UI components
│   ├── Layout.tsx
│   └── ProtectedRoute.tsx
├── features/          # Feature modules (projects, batches, products, etc.)
├── pages/            # Page components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── ProjectsPage.tsx
│   ├── BatchesPage.tsx
│   ├── ProductsPage.tsx
│   ├── TestingPage.tsx
│   └── RepairsPage.tsx
├── services/         # API services
│   ├── api.ts        # API client configured
│   ├── auth.ts
│   ├── projects.ts
│   ├── batches.ts
│   ├── products.ts
│   ├── testLogs.ts
│   └── repairs.ts
├── store/            # Redux store
│   ├── authSlice.ts
│   ├── projectSlice.ts
│   ├── batchSlice.ts
│   ├── productSlice.ts
│   └── index.ts
├── types/            # TypeScript type definitions
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── App.tsx           # Main app component
└── main.tsx          # Entry point
```

## Setup & Installation

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables:
```env
VITE_API_BASE_URL=http://localhost:3030
VITE_APP_NAME=REDNERDS Manufacturing System
VITE_APP_VERSION=1.0.0
```

4. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Core Features

### 1. Authentication & Authorization
- JWT-based authentication with refresh tokens
- Protected routes and role-based access control
- Automatic token refresh on expiration

### 2. Project Management
- Create and manage projects
- Define project metadata (name, description, status)
- View all projects with pagination
- Search and filter projects

### 3. Batch Management
- Create batches linked to projects
- Track production goals and quantities
- Monitor batch status (planned → in_progress → completed)
- Update production quantities in real-time

### 4. Product Management
- Create products with auto-generated IDs
- Track product lifecycle stages
- Link products to batches
- Search by product ID or MAC address
- Assign products to customers

### 5. Production Testing
- Log test results from testing stations
- Record pass/fail/partial results
- Capture symptom descriptions for failures
- Track test metrics and station performance

### 6. Debug & Repair Management
- Create debug sessions for failed products
- Document issues and root causes
- Track repair intake from customers
- Create repair sessions with parts tracking
- Monitor repair status and warranty claims

### 7. Dashboard & Analytics
- View production statistics
- Monitor test results trends
- Track active repairs and issues
- Display key metrics and KPIs

## API Integration

The application connects to the REDNERDS backend API at `http://localhost:3030`. 

### Base API Endpoints
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/projects` - List projects
- `GET /api/v1/batches` - List batches
- `GET /api/v1/products` - List products
- `POST /api/v1/test-logs` - Create test log
- `POST /api/v1/debug-sessions` - Create debug session
- `POST /api/v1/customer-repairs` - Create repair intake
- `POST /api/v1/repair-sessions` - Create repair session

For complete API documentation, see the backend documentation in `MONGODB_SETUP.md` and `POSTMAN_CURLS.md`.

## State Management (Redux)

The application uses Redux Toolkit for state management with the following slices:

- **authSlice** - Authentication state (user, token, login status)
- **projectSlice** - Projects list and details
- **batchSlice** - Batches list and details
- **productSlice** - Products list and details

### Using Redux in Components

```typescript
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setProjects } from '@/store/projectSlice';

function MyComponent() {
  const dispatch = useAppDispatch();
  const { projects, isLoading } = useAppSelector((state) => state.projects);
  
  // Use dispatch and selector...
}
```

## Routing

The application uses React Router v6 with the following main routes:

- `/login` - Login page
- `/` - Dashboard
- `/manufacturing/projects` - Projects list
- `/manufacturing/projects/:projectId` - Project details
- `/manufacturing/batches` - Batches list
- `/manufacturing/products` - Products list
- `/quality/testing` - Testing station
- `/quality/repairs` - Repair management

### Protected Routes

All routes except `/login` are protected and require authentication. The `ProtectedRoute` component is used to wrap protected routes.

## Environment Configuration

The application supports the following environment variables:

```env
VITE_API_BASE_URL=http://localhost:3030          # Backend API base URL
VITE_APP_NAME=REDNERDS Manufacturing System       # Application name
VITE_APP_VERSION=1.0.0                            # Application version
```

## Development Guidelines

### Component Structure
- Use functional components with hooks
- Keep components focused and reusable
- Use TypeScript for type safety
- Apply Material-UI components for consistency

### API Calls
- Use services in `src/services/` for all API calls
- Implement error handling and loading states
- Use Redux for global state management when needed
- Use React Query for server state management (optional)

### Form Validation
- Use React Hook Form + Zod for form validation
- Define validation schemas at the form level
- Display error messages to users

### Styling
- Use Material-UI's `sx` prop for inline styling
- Follow Material Design principles
- Use theme colors from the theme configuration

## Building for Production

```bash
npm run build
```

The production build will be created in the `dist` directory. This can be deployed to services like:
- Vercel
- Netlify
- AWS Amplify
- Any static hosting service

##Troubleshooting

### API Connection Issues
- Ensure the backend is running on `http://localhost:3030`
- Check that `VITE_API_BASE_URL` environment variable is correct
- Verify CORS is properly configured on the backend

### Authentication Issues
- Clear browser local storage if tokens become corrupted
- Ensure refresh token endpoint is working on the backend
- Check JWT expiration times in backend configuration

### Build Issues
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist`
- Ensure TypeScript types are correct: `npm run type-check`

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Copyright © 2026 REDNERDS Manufacturing

## Support

For issues, questions, or suggestions, please refer to the backend documentation or contact the development team.
