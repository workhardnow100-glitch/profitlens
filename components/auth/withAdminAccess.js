import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function withAdminAccess(Component, allowedRoles = ["admin"]) {
  return function AdminWrapper(props) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
      if (status !== "loading") {
        const role = session?.user?.role?.toLowerCase();
        if (!allowedRoles.map(r => r.toLowerCase()).includes(role)) {
          router.push("/unauthorized"); // ✅ safer redirect
        }
      }
    }, [status, session, router]);

    if (status === "loading") {
      return <div className="p-6 text-slate-500">Loading...</div>;
    }

    const role = session?.user?.role?.toLowerCase();
    if (!allowedRoles.map(r => r.toLowerCase()).includes(role)) {
      return null;
    }

    return <Component {...props} />;
  };
}

