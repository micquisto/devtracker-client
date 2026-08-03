import AccountabilitiesPage from "./Accountabilities/Accountabilities.page";

export default function PublicAccountabilitiesPage() {
  const params = new URLSearchParams(window.location.search);

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: 1400,
        padding: "20px 24px 40px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <AccountabilitiesPage
        showCommentActions={false}
        showFilters={false}
        showPublicViewButton={false}
        initialYear={params.get("year") ?? ""}
        initialMonth={params.get("month") ?? ""}
      />
    </main>
  );
}
