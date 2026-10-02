import { Redirect } from 'expo-router';
import { WelcomeScreen } from '@/features/welcome';
import { useAuthStore } from '@/stores';

export default function WelcomeRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Welcome is pre-auth only. A signed-in user who lands here (e.g. via a deep
  // link) goes back through the index resolver instead of seeing login.
  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <WelcomeScreen />;
}
