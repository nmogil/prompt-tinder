import { Routes, Route, Navigate } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignIn } from "./routes/auth/SignIn";
import { Home } from "./routes/Home";

export function App() {
  return (
    <Routes>
      <Route path="/auth/sign-in" element={<AuthGatePublic />} />
      <Route path="/*" element={<AuthGateProtected />} />
    </Routes>
  );
}

function AuthGatePublic() {
  return (
    <>
      <Authenticated>
        <Navigate to="/" replace />
      </Authenticated>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
    </>
  );
}

function AuthGateProtected() {
  return (
    <>
      <Authenticated>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </Authenticated>
      <Unauthenticated>
        <Navigate to="/auth/sign-in" replace />
      </Unauthenticated>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
    </>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground text-sm">Loading...</div>
    </div>
  );
}
