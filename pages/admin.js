// pages/admin.js
import { getSession } from "next-auth/react";
import Layout from "../components/layout";

export default function AdminPage() {
  return (
    <Layout currentPageName="Admin">
      <div className="p-8">
        <h2 className="text-2xl font-bold">Admin Access</h2>
        <p>Welcome, you have full access to the ProfitLens admin console.</p>
      </div>
    </Layout>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);

  // Redirect if not logged in or not admin
  if (!session || session.user.role !== "admin") {
    return { redirect: { destination: "/", permanent: false } };
  }

  return { props: {} };
}
