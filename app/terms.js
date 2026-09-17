import LegalPage from "../components/LegalPage";

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="17 September 2026"
      intro="Between Us is a private space for two people to stay close. By creating an account you agree to the following."
      sections={[
        {
          heading: "Who can use Between Us",
          paragraphs: [
            "You must be at least 17 years old to create an account. If we learn that an account belongs to someone younger, we will remove it.",
            "One account belongs to one person. Don't share your sign-in details with anyone, including the person you connect with.",
          ],
        },
        {
          heading: "Connecting with someone",
          paragraphs: [
            "You can be connected to one person at a time. Connecting needs both people to agree: you send a request, and nothing is shared until they accept it.",
            "Once connected, the two of you can see what you save together — memories, dreams, goals, check-ins, appreciation notes and answers to the daily question — along with the profile details that power trivia and insights.",
            "Either of you can unlink at any time from the Profile screen. Unlinking stops the sharing straight away.",
          ],
        },
        {
          heading: "What you write here",
          paragraphs: [
            "What you write stays yours. We don't sell it, we don't advertise against it, and we don't use it to train anything.",
            "Don't use Between Us to harass anyone, to post content you have no right to share, or to break the law. Accounts used that way can be removed.",
            "Remember that the person you connect with can read what you save to your shared space, and can keep their own copy of it by writing it down. Share accordingly.",
          ],
        },
        {
          heading: "Ending your account",
          paragraphs: [
            "You can delete your account at any time from the Profile screen. Deleting removes your profile, your answers and your shared space permanently. It cannot be undone.",
            "We may suspend or remove an account that breaks these terms or puts other people at risk.",
          ],
        },
        {
          heading: "What we can and can't promise",
          paragraphs: [
            "Between Us is provided as it is. We work to keep it running and your data safe, but we can't promise the service will never be unavailable or that nothing will ever go wrong.",
            "Keep your own copy of anything you would be heartbroken to lose.",
            "These terms may change as the app grows. If something important changes, we'll say so in the app.",
          ],
        },
      ]}
    />
  );
}
