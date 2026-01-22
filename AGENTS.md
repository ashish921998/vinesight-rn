# AI Agent Guide - VineSight RN

Welcome! This guide provides the necessary context for autonomous agents to develop, test, and maintain the VineSight React Native application.

## Project Overview
VineSight is a vineyard management mobile application built with Expo SDK 54 and React Native. It uses Supabase for backend services and TanStack Query for data fetching.

## Tech Stack
- **Framework**: Expo (SDK 54), React Native
- **Language**: TypeScript (Strict mode enabled)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand
- **Backend**: Supabase
- **Data Fetching**: TanStack Query (React Query)
- **AI Integration**: OpenAI SDK

## Core Commands
- `npm start`: Start the Expo development server.
- `npm run android`: Run on Android emulator/device.
- `npm run ios`: Run on iOS simulator/device.
- `npm run lint`: Run ESLint to check for code quality issues.
- `npm run format`: Format the codebase using Prettier.
- `npm run typecheck`: Run TypeScript compiler to check for type errors.
- `npm run test`: Run unit tests using Jest.

## Project Structure
- `app/`: Expo Router file-based routing.
- `src/components/`: Reusable UI components (ui/, cards/, screens/).
- `src/hooks/`: Custom React hooks for business logic and data fetching.
- `src/services/`: Service layer for API calls (Supabase, OpenAI, Weather).
- `src/stores/`: Zustand store definitions for global state.
- `src/types/`: TypeScript type and interface definitions.
- `src/utils/`: Utility functions and constants.

## Development Guidelines
- **Linting & Formatting**: ESLint and Prettier are enforced via pre-commit hooks (Husky + lint-staged). Always run `npm run lint` before submitting changes.
- **Environment Variables**: Required variables are documented in `.env.example`. Ensure you have a local `.env` file for development.
- **Styling**: Use Tailwind classes via NativeWind's `className` prop. Avoid inline styles where possible.
- **Types**: Use strict typing. Avoid `any` at all costs. Prefer interfaces over types for object definitions.
- **Data Fetching**: Always use TanStack Query hooks in `src/hooks/` for backend interactions.

## Agent-Specific Tips
- When adding new features, check `src/hooks/` and `src/services/` first to see if relevant logic already exists.
- Follow the existing pattern for Supabase queries: use service methods and wrap them in custom hooks.
- For UI components, refer to `src/components/ui/` for primitive elements (Button, Input, etc.).
