# Paradigm IFS - Build Details

This document provides a comprehensive overview of the build system and toolchain used for the **Paradigm Integrated Field Services (IFS)** application.

## Core Technologies

- **Build Tool**: [Vite](https://vitejs.dev/) (`v7.2.4`) - Provides a fast development environment and optimized production builds using Rollup.
- **Frontend Framework**: [React](https://reactjs.org/) (`v18.2.0`) - Powering the user interface components.
- **Programming Language**: [TypeScript](https://www.typescriptlang.org/) (`v5.9.3`) - Ensuring type safety and better developer experience.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (`v4.1.18`) - Utilizing a utility-first CSS framework for rapid UI development.

## Mobile Integration

The application is designed to be multi-platform, using **Capacitor** to bridge the web application to native mobile environments:

- **Library**: [Capacitor](https://capacitorjs.com/) (`v7.4.4`)
- **Supported Platforms**:
  - [Android](file:///e:/onboarding%20all%20files/Paradigm%20Office%202/android)
  - [iOS](file:///e:/onboarding%20all%20files/Paradigm%20Office%202/ios)

## Key Commands

These scripts are defined in the project's [package.json](file:///e:/onboarding%20all%20files/Paradigm%20Office%202/package.json):

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Generates a production-ready web build in the `dist/` folder. |
| `npm run build:apk` | Bumps the version, builds the project, and syncs with the Android platform for native deployment. |
| `npm run server` | Starts the backend server (Node.js with ts-node). |

## Build Configuration

- **Configuration File**: [vite.config.ts](file:///e:/onboarding%20all%20files/Paradigm%20Office%202/vite.config.ts)
- **Features**:
  - **Path Aliases**: Clean imports using `@/` prefixes for services, components, hooks, etc.
  - **Optimized Bundling**: Manual chunking for vendor libraries (React, Supabase, Capacitor) to improve load times.
  - **PWA Ready**: Configuration for Progressive Web App features is included (currently commented out).

---
*Last Updated: 2026-03-15*
