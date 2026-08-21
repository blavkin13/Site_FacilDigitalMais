import type {
  Metadata,
} from "next";

import {
  cookies,
} from "next/headers";

import {
  redirect,
} from "next/navigation";

import {
  AdminDashboard,
} from "../../components/admin-dashboard";

import {
  ADMIN_SESSION_COOKIE,
  resolveAdminSession,
} from "../../lib/admin-auth";


export const metadata:
  Metadata =
  {
    title:
      "Painel Administrativo",

    description:
      "Dashboard do administrador.",

    robots: {
      index:
        false,

      follow:
        false,
    },
  };


export const dynamic =
  "force-dynamic";


export default async function AdminPage() {
  const cookieStore =
    await cookies();


  const token =
    cookieStore.get(
      ADMIN_SESSION_COOKIE
    )?.value;


  const session =
    await resolveAdminSession(
      token
    );


  if (
    session.status ===
    "unauthenticated"
  ) {
    redirect(
      "/login?returnTo=%2Fadmin"
    );
  }


  if (
    session.status ===
    "forbidden"
  ) {
    redirect(
      "/?error=forbidden"
    );
  }


  return (
    <AdminDashboard />
  );
}