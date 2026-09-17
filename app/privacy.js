import LegalPage from "../components/LegalPage";

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="17 September 2026"
      intro="Between Us holds private things, so here is plainly what we keep, who can see it, and how to get rid of it."
      sections={[
        {
          heading: "What we keep",
          paragraphs: [
            "Your email address and password, which are held by our sign-in provider, Clerk. We never see your password.",
            "What you answer during onboarding: your name, birthday, country, gender, relationship status and your preferences, such as favourite food, love languages and communication style.",
            "What you save in the app: memories, dreams, goals, special dates, appreciation notes, check-ins and answers to the daily question.",
            "A notification token for your device, if you turn notifications on, so we can send reminders.",
            "We don't collect your location, your contacts, your photos library or anything you haven't typed in yourself.",
          ],
        },
        {
          heading: "Who can see it",
          paragraphs: [
            "The person you are connected with can see your shared space and the profile details that power trivia and insights. That is the point of the app.",
            "Before you connect, other people can find you by your first name or your exact email address, and can see your first name, country, gender and relationship status. Your email address is never shown to them.",
            "Nobody else sees your data. We don't sell it, share it with advertisers, or use it to train anything.",
          ],
        },
        {
          heading: "Where it lives",
          paragraphs: [
            "Your data is stored in a database run by Neon, and reached through a service run by Cloudflare. Sign-in is handled by Clerk. Notifications are delivered by Expo.",
            "Everything travels over an encrypted connection, and every request has to prove who it comes from, so one account can never read another's.",
          ],
        },
        {
          heading: "Getting rid of it",
          paragraphs: [
            "Delete your account from the Profile screen, and your profile, your answers and your shared space are removed permanently, including the things you saved with your partner.",
            "Unlinking from someone stops the sharing immediately without deleting your account.",
            "If you would rather ask us to delete it for you, email ellaukata@gmail.com from the address on your account.",
          ],
        },
        {
          heading: "Children",
          paragraphs: [
            "Between Us is for people aged 17 and over. We don't knowingly keep data about anyone younger. If you believe we have, email us and we will remove it.",
          ],
        },
      ]}
    />
  );
}
