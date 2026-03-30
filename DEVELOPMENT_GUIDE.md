# REDNERDS Web Application Development Guide

## Quick Start

### Get the project running in 3 steps:

1. **Install dependencies:**
```bash
npm install
```

2. **Start development server:**
```bash
npm run dev
```

3. **Open in browser:**
```
http://localhost:5173
```

## Project Architecture

This is a **React + TypeScript + Vite** application with the following structure:

### Folder Organization

```
src/
├── components/       # Reusable UI components (Layout, ProtectedRoute, etc.)
├── features/        # Feature-specific components (organize by feature)
├── pages/           # Full page components (each route gets a page)
├── services/        # API service layer
├── store/           # Redux state management
├── types/           # TypeScript interfaces and types
├── hooks/           # Custom React hooks
├── utils/           # Helper functions and utilities
├── App.tsx          # Main application component
└── main.tsx         # React entry point
```

### Key Patterns

#### 1. API Services Pattern

All API calls go through services in `src/services/`:

```typescript
// services/projects.ts
import { apiClient } from './api';
import { Project, ApiResponse } from '@/types';

export const projectService = {
  async createProject(data): Promise<Project> {
    const response = await apiClient.post('/projects', data);
    return response.data.data;
  },
  // ... more methods
};
```

Usage in components:

```typescript
import { projectService } from '@/services';

const project = await projectService.createProject(formData);
```

#### 2. Redux State Management

Redux slices handle global state:

```typescript
// store/projectSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload;
    },
  },
});
```

Usage in components:

```typescript
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setProjects } from '@/store/projectSlice';

const dispatch = useAppDispatch();
const { projects } = useAppSelector(state => state.projects);

// Dispatch action
dispatch(setProjects(newProjects));
```

#### 3. Protected Routes

All authenticated routes use the `ProtectedRoute` wrapper:

```typescript
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  }
/>
```

The wrapper automatically redirects unauthenticated users to `/login`.

#### 4. Form Handling

Use React Hook Form + Zod for all forms:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <p>{errors.name.message}</p>}
    </form>
  );
}
```

## Core Features Implementation

### 1. Authentication Flow

**Files involved:**
- `services/auth.ts` - Auth service
- `store/authSlice.ts` - Auth state
- `pages/LoginPage.tsx` - Login UI
- `components/ProtectedRoute.tsx` - Route protection

**Implementation:**
1. User submits login form
2. `authService.login()` is called
3. API returns token + user data
4. Both stored in Redux and localStorage
5. User redirected to dashboard
6. Protected routes check auth state

### 2. Project Management

**Files involved:**
- `services/projects.ts` - Project API calls
- `store/projectSlice.ts` - Project state
- `pages/ProjectsPage.tsx` - Projects list
- `pages/ProjectDetailsPage.tsx` - Project details

**Implementation:**
1. Fetch projects via `projectService.getProjects()`
2. Store in Redux with `setProjects()`
3. Display in table
4. Click to view details
5. Edit/delete via corresponding service methods

### 3. Test Logging

**Files involved:**
- `services/testLogs.ts` - Test log API
- `pages/TestingPage.tsx` - Testing UI

**Implementation:**
1. Operator selects product and test station
2. Records test result (pass/fail/partial)
3. Captures symptoms if failed
4. `testLogService.createTestLog()` saves to DB
5. Product status auto-updates based on result

### 4.  Repair Management

**Files involved:**
- `services/repairs.ts` - Repair APIs
- `pages/RepairsPage.tsx` - Repair UI

**Implementation:**
1. Create repair intake with customer complaint
2. Create repair sessions for actual work
3. Track parts replaced
4. Update repair status through workflow
5. Mark as returned to close case

## Adding New Features

### Step 1: Define Types

Add to `src/types/index.ts`:

```typescript
export interface MyFeature {
  _id: string;
  name: string;
  description: string;
  createdAt: Date;
}
```

### Step 2: Create Service

Create `src/services/myfeature.ts`:

```typescript
import { apiClient } from './api';
import { MyFeature, ApiResponse } from '@/types';

export const myFeatureService = {
  async create(data): Promise<MyFeature> {
    const response = await apiClient.post('/my-feature', data);
    return response.data.data;
  },
  async getAll(): Promise<MyFeature[]> {
    const response = await apiClient.get('/my-feature');
    return response.data.data;
  },
  // ... more methods
};
```

### Step 3: Create Redux Slice

Create `src/store/myFeatureSlice.ts`:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MyFeature } from '@/types';

interface MyFeatureState {
  items: MyFeature[];
  isLoading: boolean;
  error: string | null;
}

const initialState: MyFeatureState = {
  items: [],
  isLoading: false,
  error: null,
};

const myFeatureSlice = createSlice({
  name: 'myFeature',
  initialState,
  reducers: {
    setItems: (state, action: PayloadAction<MyFeature[]>) => {
      state.items = action.payload;
    },
    // ... more reducers
  },
});

export default myFeatureSlice.reducer;
```

### Step 4: Add to Store

Update `src/store/index.ts`:

```typescript
import myFeatureReducer from './myFeatureSlice';

export const store = configureStore({
  reducer: {
    // ... existing reducers
    myFeature: myFeatureReducer,
  },
});
```

### Step 5: Create Page Component

Create `src/pages/MyFeaturePage.tsx`:

```typescript
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { myFeatureService } from '@/services';
import { setItems } from '@/store/myFeatureSlice';

function MyFeaturePage() {
  const dispatch = useAppDispatch();
  const { items, isLoading } = useAppSelector(state => state.myFeature);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const data = await myFeatureService.getAll();
      dispatch(setItems(data));
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  };

  return (
    <div>
      {/* Display items here */}
    </div>
  );
}
```

### Step 6: Add Route

Update `src/App.tsx`:

```typescript
<Route
  path="/my-feature"
  element={
    <ProtectedRoute>
      <MyFeaturePage />
    </ProtectedRoute>
  }
/>
```

## Working with API Responses

The API client automatically handles:
- **Authentication**: Adds JWT token to all requests
- **Errors**: Handles API errors and displays them
- **Token Refresh**: Automatically refreshes expired tokens
- **Interceptors**: Applies request/response transformations

### Response format:

```typescript
{
  "message": "Success",
  "data": {
    // Actual data
  }
}
```

The service automatically extracts and returns just the `data` field.

## Debugging

### Redux DevTools

Enable in browser:
1. Install Redux DevTools browser extension
2. Open DevTools (F12)
3. Go to Redux tab
4. Watch state changes in real-time

### API Debugging

View all API calls:
1. Open browser Network tab (F12)
2. Look for XHR/Fetch requests
3. Click to view request/response

### Component Debugging

Use React DevTools browser extension:
1. Install React DevTools extension
2. Open DevTools
3. Go to React tab
4. Inspect components and their props

## Common Issues & Solutions

### Issue: "401 Unauthorized" errors

**Solution:** Check that:
- JWT token is valid and not expired
- Token is stored in localStorage
- Backend secret matches client

### Issue: CORS errors

**Solution:** Ensure backend has CORS enabled and:
- `Access-Control-Allow-Origin` includes frontend URL
- `Access-Control-Allow-Credentials` is true

### Issue: Styled components not applying

**Solution:**
- Check MUI theme configuration in `main.tsx`
- Use `sx` prop for MUI components
- Use `styled` from `@emotion/styled` for custom components

### Issue: Form validation not working

**Solution:**
- Ensure Zod schema is defined correctly
- Use `zodResolver` in useForm hook
- Check that form field names match schema keys

## Performance Optimization

### Best Practices

1. **Code Splitting** - Routes are automatically code-split by Vite
2. **Image Optimization** - Use WebP format when possible
3. **Bundle Analysis** - Check bundle size with: `npm run build`
4. **Lazy Loading** - Use React.lazy() for components not always needed

### Profiling

Use React Profiler:
1. Open DevTools → Profiler
2. Record interactions
3. Identify slow components

## Testing

### Running Tests

```bash
npm test
```

### Writing Tests

Example test file `MyComponent.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Deployment

### Build for Production

```bash
npm run build
```

Creates optimized build in `dist/` directory.

### Deploy to Vercel

```bash
npm i -g vercel
vercel
```

### Deploy to Netlify

```bash
npm run build
# Drag & drop dist/ to Netlify
```

## Environment

Production environment variables:
```env
VITE_API_BASE_URL=https://api.production.com
VITE_APP_NAME=REDNERDS Manufacturing System
VITE_APP_VERSION=1.0.0
```

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Redux Toolkit Docs](https://redux-toolkit.js.org)
- [Material-UI Docs](https://mui.com)
- [React Router Docs](https://reactrouter.com)
- [Vite Docs](https://vitejs.dev)

## Support

For questions or issues:
1. Check this guide first
2. Review backend documentation
3. Check Redux DevTools for state issues
4. Review browser console for errors
