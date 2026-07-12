import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in/sso-callback")({
  component: SSOCallback,
});

function SSOCallback() {
  return <AuthenticateWithRedirectCallback />;
}